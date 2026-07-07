import { API_BASE_URL } from '../../config';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, LogIn, LogOut, CheckCircle, UserCheck, Maximize2, Minimize2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import * as faceapi from 'face-api.js';

// Helper: format "HH:MM" 24h string to "H:MM AM/PM"
const fmt12 = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

// ── Enrollment takes 8 diverse samples at different angles/distances ──
const ENROLL_SAMPLES_NEEDED = 8;
// Attendance verification: must match this many CONSECUTIVE frames before acting
// High value = much harder to spoof with a photo or wrong person
const VERIFY_FRAMES_NEEDED = 5;
// Strict euclidean distance threshold. face-api.js: same person ≈ 0.4–0.6, different ≈ 0.6+
// 0.38 is tight enough to reject similar faces while accepting genuine matches
const MATCH_THRESHOLD = 0.38;
// Minimum ms between enrollment captures (forces diverse angles)
const ENROLL_CAPTURE_INTERVAL = 1500;

const MarkAttendance = () => {
    const { employeeUser, adminUser, updateEmployeeUser, refreshEmployeeFromServer } = useAuth();
    const rawUser = employeeUser || adminUser;
    const [localUser, setLocalUser] = useState(rawUser);
    const user = localUser || rawUser;

    const [attendanceData, setAttendanceData] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [userReady, setUserReady] = useState(false);

    // Camera & UI state
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [modelsLoaded, setModelsLoaded] = useState(false);

    // Use a ref for myDescriptor so scan loop always sees latest value without restart
    const myDescriptorRef = useRef(null);
    const [myDescriptorState, setMyDescriptorState] = useState(null); // for UI reactivity

    const [faceStatus, setFaceStatus] = useState('Starting AI models...');
    const [enrollCues, setEnrollCues] = useState([]); // list of pose cues to guide user
    const scanPauseRef = useRef(false);
    const [isFaceDetected, setIsFaceDetected] = useState(false);
    const [isFaceVerified, setIsFaceVerified] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Enrollment state
    const enrollModeRef = useRef(false);
    const [enrollModeState, setEnrollModeState] = useState(false);
    const enrollSamplesRef = useRef([]);
    const enrollSavingRef = useRef(false);
    const lastCaptureMsRef = useRef(0);
    const [enrollProgress, setEnrollProgress] = useState(0); // 0–ENROLL_SAMPLES_NEEDED

    const [isExpanded, setIsExpanded] = useState(false);
    const validationCountRef = useRef(0);
    const lastVocalRef = useRef(0);
    const scanLoopActive = useRef(false);
    const tabHiddenRef = useRef(false); // tracks tab visibility for scan loop gating
    const modelsLoadingRef = useRef(false); // prevents concurrent loadModels calls

    // ── Helpers ──────────────────────────────────────────────────────
    const speakOnce = (text) => {
        const now = Date.now();
        if (now - lastVocalRef.current > 4000) {
            try {
                const u = new SpeechSynthesisUtterance(text);
                u.rate = 1.0; u.lang = 'en-US';
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(u);
            } catch (_) {}
            lastVocalRef.current = now;
        }
    };

    const fmt = (d) => d
        ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '--:--';

    // ── Attendance status ─────────────────────────────────────────────
    const fetchAttendanceStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/attendance/status`, {
                headers: { 'X-Role-Context': 'Employee' },
                credentials: 'include'
            });
            if (res.ok) setAttendanceData(await res.json());
        } catch (e) { console.error('Fetch attendance error:', e); }
    }, []);

    // ── Camera helpers ────────────────────────────────────────────────
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    const startCamera = useCallback(async () => {
        stopCamera();
        setCameraError('');
        try {
            const ms = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            });
            streamRef.current = ms;
            if (videoRef.current) {
                videoRef.current.srcObject = ms;
                await videoRef.current.play().catch(() => {});
            }
            setCameraActive(true);
            console.log('✅ Camera started');
        } catch (err) {
            console.error('❌ Camera error:', err);
            setCameraError('Camera access denied or unavailable. Please allow camera access.');
        }
    }, [stopCamera]);

    // Re-attach stream to video element if it loses the srcObject (e.g. after DOM re-render)
    const ensureVideoAttached = useCallback(() => {
        if (streamRef.current && videoRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(() => {});
            console.log('🔗 Re-attached stream to video element');
        }
    }, []);

    // ── Load models then start camera ─────────────────────────────────
    const loadModels = useCallback(async () => {
        if (modelsLoadingRef.current) return; // prevent concurrent calls
        modelsLoadingRef.current = true;
        try {
            setFaceStatus('Loading AI models… (1/4)');
            // Sequential loading — keeps browser responsive between each model
            // Parallel Promise.all blocks the main thread and causes "not responding" on tab switch
            await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
            if (tabHiddenRef.current) { modelsLoadingRef.current = false; return; } // aborted
            setFaceStatus('Loading AI models… (2/4)');
            await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
            if (tabHiddenRef.current) { modelsLoadingRef.current = false; return; }
            setFaceStatus('Loading AI models… (3/4)');
            await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
            if (tabHiddenRef.current) { modelsLoadingRef.current = false; return; }
            setFaceStatus('Loading AI models… (4/4)');
            await faceapi.nets.faceRecognitionNet.loadFromUri('/models');

            modelsLoadingRef.current = false;
            setModelsLoaded(true);

            // Only start camera if tab is visible
            if (!tabHiddenRef.current) {
                setFaceStatus('Camera starting…');
                await startCamera();
            } else {
                setFaceStatus('Models ready. Camera will start when you return to this tab.');
            }
        } catch (err) {
            modelsLoadingRef.current = false;
            setFaceStatus('Error loading AI models: ' + err.message);
        }
    }, [startCamera]);


    // ── Fetch and store enrolled descriptor ───────────────────────────
    const fetchMyDescriptor = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/attendance/face-descriptors`, {
                headers: { 'X-Role-Context': 'Employee' },
                credentials: 'include'
            });
            if (!res.ok) { setFaceStatus('Failed to load face data. Check your connection.'); return; }
            const data = await res.json();
            const me = (data.employees || []).find(
                e => e._id && user._id && e._id.toString() === user._id.toString()
            );
            if (me && me.faceDescriptors && me.faceDescriptors.length > 0) {
                const descriptors = me.faceDescriptors.map(d => new Float32Array(d));
                myDescriptorRef.current = descriptors;
                setMyDescriptorState(descriptors);
                setFaceStatus('✅ Face recognition ready. Look at the camera.');
                enrollModeRef.current = false;
                setEnrollModeState(false);
                console.log(`✅ Loaded ${descriptors.length} face descriptor(s)`);
            } else {
                setFaceStatus('Face data missing. Contact your admin to re-enroll.');
                enrollModeRef.current = false;
                setEnrollModeState(false);
            }
        } catch (e) {
            setFaceStatus('Failed to load face data. Check your connection.');
        }
    }, [user?._id]);

    // ── Save enrollment to server ─────────────────────────────────────
    const saveEnrollment = useCallback(async (samples) => {
        if (enrollSavingRef.current) return;

        // ── Hard guard: always re-check from server before saving ──────
        // This prevents stale React state from allowing re-enrollment
        try {
            const checkRes = await fetch(`${API_BASE_URL}/attendance/face-descriptors`, {
                headers: { 'X-Role-Context': 'Employee' },
                credentials: 'include'
            });
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                const me = (checkData.employees || []).find(
                    e => e._id && user._id && e._id.toString() === user._id.toString()
                );
                if (me && me.faceDescriptors && me.faceDescriptors.length > 0) {
                    // Face already enrolled on server — abort enrollment silently
                    console.warn('⚠️ Server says face already enrolled. Aborting enrollment, loading descriptor.');
                    enrollSamplesRef.current = [];
                    enrollSavingRef.current = false;
                    setEnrollProgress(0);
                    const updatedUser = { ...user, faceEnrolled: true };
                    setLocalUser(updatedUser);
                    if (updateEmployeeUser) updateEmployeeUser(updatedUser);
                    enrollModeRef.current = false;
                    setEnrollModeState(false);
                    await fetchMyDescriptor();
                    return;
                }
            }
        } catch (_) { /* network error during check — proceed to try enrollment */ }

        if (samples.length < ENROLL_SAMPLES_NEEDED) return;

        enrollSavingRef.current = true;
        setFaceStatus(`Saving ${samples.length} face samples securely…`);
        try {
            const res = await fetch(`${API_BASE_URL}/attendance/enroll-face`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Role-Context': 'Employee' },
                credentials: 'include',
                body: JSON.stringify({ userId: user._id, descriptors: samples })
            });
            const d = await res.json();

            if (res.ok) {
                setFaceStatus('✅ Face enrolled! Starting attendance recognition…');
                setEnrollProgress(ENROLL_SAMPLES_NEEDED);
                enrollSamplesRef.current = [];
                enrollSavingRef.current = false;

                const updatedUser = { ...user, faceEnrolled: true };
                setLocalUser(updatedUser);
                if (updateEmployeeUser) updateEmployeeUser(updatedUser);

                await fetchAttendanceStatus();
                await fetchMyDescriptor(); // sets enrollModeRef to false and loads descriptor
                if (isExpanded) setTimeout(() => setIsExpanded(false), 1500);
            } else {
                if (d.code === 'FACE_ALREADY_ENROLLED') {
                    // Someone already enrolled — stop immediately and load their descriptor
                    setFaceStatus('⚠️ Face already registered. Loading your recognition data…');
                    enrollSamplesRef.current = [];
                    enrollSavingRef.current = false;
                    setEnrollProgress(0);
                    enrollModeRef.current = false;
                    setEnrollModeState(false);
                    const updatedUser = { ...user, faceEnrolled: true };
                    setLocalUser(updatedUser);
                    if (updateEmployeeUser) updateEmployeeUser(updatedUser);
                    await fetchMyDescriptor();
                } else {
                    setFaceStatus('❌ ' + (d.message || 'Enrollment failed. Please try again.'));
                    enrollSamplesRef.current = [];
                    enrollSavingRef.current = false;
                    setEnrollProgress(0);
                    setTimeout(() => setFaceStatus('Look at the camera. Enrollment will restart.'), 4000);
                }
            }
        } catch (e) {
            setFaceStatus('❌ Connection error. Retrying enrollment…');
            enrollSamplesRef.current = [];
            enrollSavingRef.current = false;
            setEnrollProgress(0);
        }
    }, [user, updateEmployeeUser, fetchAttendanceStatus, fetchMyDescriptor, isExpanded]);


    // ── Attendance action ─────────────────────────────────────────────
    const handleAttendanceAction = useCallback(async () => {
        setActionLoading(true);
        let freshAttendance = null;
        try {
            const statusRes = await fetch(`${API_BASE_URL}/attendance/status`, {
                headers: { 'X-Role-Context': 'Employee' }, credentials: 'include'
            });
            if (statusRes.ok) { freshAttendance = await statusRes.json(); setAttendanceData(freshAttendance); }
        } catch (_) { freshAttendance = attendanceData; }

        const alreadyCheckedIn = freshAttendance?.checkIn;
        const alreadyCheckedOut = freshAttendance?.checkOut;

        if (alreadyCheckedIn && alreadyCheckedOut) {
            setMessage({ type: 'info', text: 'Shift complete for today. See you tomorrow!' });
            speakOnce('Shift complete for today');
            setTimeout(() => { scanPauseRef.current = false; setIsFaceVerified(false); }, 3000);
            setActionLoading(false);
            return;
        }

        const action = alreadyCheckedIn ? 'checkout' : 'checkin';

        if (action === 'checkout' && alreadyCheckedIn) {
            const elapsed = Date.now() - new Date(alreadyCheckedIn).getTime();
            if (elapsed < 5 * 60 * 1000) {
                const remaining = Math.ceil((5 * 60 * 1000 - elapsed) / 1000);
                const msg = `Please wait ${Math.floor(remaining / 60)}m ${remaining % 60}s before checking out.`;
                setMessage({ type: 'warning', text: msg });
                speakOnce('Please wait before checking out');
                setTimeout(() => { scanPauseRef.current = false; setIsFaceVerified(false); }, 3000);
                setActionLoading(false);
                return;
            }
        }

        try {
            let clientIp = null;
            try {
                const ipRes = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
                clientIp = (await ipRes.json()).ip;
            } catch (_) {}

            const headers = { 'X-Role-Context': 'Employee' };
            if (clientIp) headers['X-Client-IP'] = clientIp;

            const res = await fetch(`${API_BASE_URL}/attendance/${action}`, {
                method: 'POST', headers, credentials: 'include'
            });
            const data = await res.json();

            if (res.ok) {
                const msg = action === 'checkin'
                    ? `Welcome, ${user.name}! Checked in.`
                    : `Goodbye, ${user.name}! Checked out.`;
                setMessage({ type: 'success', text: msg });
                speakOnce(msg);
                await fetchAttendanceStatus();
                setTimeout(() => setMessage({ type: '', text: '' }), 4000);
                if (isExpanded) setIsExpanded(false);
            } else if (data.code === 'TOO_EARLY_CHECKOUT') {
                setMessage({ type: 'warning', text: data.message });
                speakOnce(data.message);
            } else {
                setMessage({ type: 'error', text: data.message || 'Action failed' });
                speakOnce(data.message || 'Action failed');
            }
        } catch (_) {
            setMessage({ type: 'error', text: 'Connection error. Try again.' });
        } finally {
            setActionLoading(false);
            setTimeout(() => {
                scanPauseRef.current = false;
                validationCountRef.current = 0;
                setIsFaceVerified(false);
                setFaceStatus('Face recognition ready. Look at the camera.');
            }, 3000);
        }
    }, [attendanceData, user, fetchAttendanceStatus, isExpanded]);


    // ── MAIN SCAN LOOP ────────────────────────────────────────────────
    // Single unified loop handles BOTH enrollment and attendance scanning.
    // Uses setTimeout (not rAF) so async work never queues up.
    useEffect(() => {
        if (!modelsLoaded || !cameraActive) return;

        scanLoopActive.current = true;
        let timer = null;

        const loop = async () => {
            if (!scanLoopActive.current) return;

            // ── Tab hidden guard — skip ALL faceapi work when tab is not visible ──
            // This prevents WASM queue buildup that causes "page not responding"
            if (tabHiddenRef.current) {
                timer = setTimeout(loop, 500); // poll slowly while hidden
                return;
            }

            // Ensure video is still attached (fixes "camera not detecting" after enrollment)
            ensureVideoAttached();

            const video = videoRef.current;
            if (!video || video.readyState < 2 || video.paused || video.videoWidth === 0) {
                timer = setTimeout(loop, 200);
                return;
            }

            // ──── ENROLLMENT MODE ────────────────────────────────────
            if (enrollModeRef.current && !enrollSavingRef.current) {
                if (enrollSamplesRef.current.length >= ENROLL_SAMPLES_NEEDED) {
                    await saveEnrollment(enrollSamplesRef.current);
                    return; // saveEnrollment will flip enrollModeRef to false after success
                }

                try {
                    // Two-stage: TinyFace for fast pre-check, SSD for quality descriptor
                    const tiny = await faceapi.detectSingleFace(
                        video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 })
                    );

                    if (!tiny) {
                        setFaceStatus('👤 No face detected. Look directly at the camera.');
                        timer = setTimeout(loop, 150);
                        return;
                    }

                    const full = await faceapi
                        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
                        .withFaceLandmarks()
                        .withFaceDescriptor();

                    if (!full) {
                        setFaceStatus('Face partially visible. Keep your full face in frame.');
                        timer = setTimeout(loop, 150);
                        return;
                    }

                    const { box } = full.detection;
                    const score = full.detection.score || 0;
                    const vw = video.videoWidth || 640;
                    const vh = video.videoHeight || 480;
                    const cx = box.x + box.width / 2;
                    const cy = box.y + box.height / 2;
                    const centered = Math.abs(cx - vw / 2) < vw * 0.38 && Math.abs(cy - vh / 2) < vh * 0.42;

                    if (box.width < vw * 0.12) { setFaceStatus('Too far. Move closer.'); timer = setTimeout(loop, 100); return; }
                    if (box.width > vw * 0.80) { setFaceStatus('Too close. Move back a little.'); timer = setTimeout(loop, 100); return; }
                    if (score < 0.50) { setFaceStatus('Poor lighting. Ensure your face is well lit.'); timer = setTimeout(loop, 100); return; }
                    if (!centered) { setFaceStatus('Center your face in the frame.'); timer = setTimeout(loop, 100); return; }

                    // Enforce capture interval — so each sample is from a slightly different moment
                    const now = Date.now();
                    if (now - lastCaptureMsRef.current < ENROLL_CAPTURE_INTERVAL) {
                        const count = enrollSamplesRef.current.length;
                        const cues = ['Look straight', 'Tilt slightly left', 'Tilt slightly right', 'Move a little closer', 'Look straight again'];
                        setFaceStatus(`✅ Hold still… Capturing sample ${count + 1}/${ENROLL_SAMPLES_NEEDED} — ${cues[count] || 'look at camera'}`);
                        timer = setTimeout(loop, 80);
                        return;
                    }

                    lastCaptureMsRef.current = now;
                    const newSamples = [...enrollSamplesRef.current, Array.from(full.descriptor)];
                    enrollSamplesRef.current = newSamples;
                    setEnrollProgress(newSamples.length);

                    if (newSamples.length >= ENROLL_SAMPLES_NEEDED) {
                        setFaceStatus(`✅ ${ENROLL_SAMPLES_NEEDED}/${ENROLL_SAMPLES_NEEDED} captured! Saving…`);
                        await saveEnrollment(newSamples);
                        return;
                    }
                    const nextCues = ['Look straight', 'Tilt slightly left', 'Tilt slightly right', 'Move a little closer', 'Look straight again'];
                    setFaceStatus(`✅ Sample ${newSamples.length}/${ENROLL_SAMPLES_NEEDED} saved! Next: ${nextCues[newSamples.length] || 'hold still'}`);
                } catch (e) {
                    console.warn('Enrollment frame error:', e);
                }
                timer = setTimeout(loop, 80);
                return;
            }

            // ──── ATTENDANCE VERIFICATION MODE ───────────────────────
            if (enrollModeRef.current || scanPauseRef.current) {
                timer = setTimeout(loop, 200);
                return;
            }

            if (!myDescriptorRef.current) {
                setFaceStatus('Loading face data…');
                timer = setTimeout(loop, 500);
                return;
            }

            try {
                const detection = await faceapi
                    .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.55 }))
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (!detection) {
                    setIsFaceDetected(false);
                    setIsFaceVerified(false);
                    if (validationCountRef.current > 0) {
                        validationCountRef.current = 0; // reset streak — face left frame
                        setFaceStatus('Face left frame. Streak reset. Look at the camera.');
                    } else {
                        setFaceStatus('No face detected. Look at the camera.');
                    }
                    timer = setTimeout(loop, 100);
                    return;
                }

                setIsFaceDetected(true);
                const { box } = detection.detection;
                const score = detection.detection.score || 0;
                const vw = video.videoWidth || 640;
                const vh = video.videoHeight || 480;
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;
                const centered = Math.abs(cx - vw / 2) < vw * 0.40 && Math.abs(cy - vh / 2) < vh * 0.45;

                if (box.width < vw * 0.10) {
                    validationCountRef.current = 0;
                    setFaceStatus('Too far. Move closer.');
                    timer = setTimeout(loop, 80); return;
                }
                if (box.width > vw * 0.85) {
                    validationCountRef.current = 0;
                    setFaceStatus('Too close. Move back.');
                    timer = setTimeout(loop, 80); return;
                }
                if (score < 0.55) {
                    validationCountRef.current = 0;
                    setFaceStatus('Face not clear. Improve lighting.');
                    timer = setTimeout(loop, 80); return;
                }
                if (!centered) {
                    validationCountRef.current = 0;
                    setFaceStatus('Center your face in the frame.');
                    timer = setTimeout(loop, 80); return;
                }

                // ── Strict identity verification ───────────────────────
                // Compare against THIS user's stored descriptors only
                // Use best (minimum) distance across all stored samples
                const distances = myDescriptorRef.current.map(
                    saved => faceapi.euclideanDistance(detection.descriptor, saved)
                );
                const bestDist = Math.min(...distances);

                // Hard threshold: 0.38 — rejects lookalikes, different people, photos
                const verified = bestDist <= MATCH_THRESHOLD;

                if (verified) {
                    validationCountRef.current += 1;
                    setFaceStatus(
                        `Verifying identity… ${validationCountRef.current}/${VERIFY_FRAMES_NEEDED} ` +
                        `(confidence: ${Math.round((1 - bestDist) * 100)}%)`
                    );

                    // Only act after VERIFY_FRAMES_NEEDED consecutive matched frames
                    if (validationCountRef.current >= VERIFY_FRAMES_NEEDED) {
                        validationCountRef.current = 0;
                        setIsFaceVerified(true);
                        setFaceStatus('✅ Identity confirmed! Processing…');
                        scanPauseRef.current = true;
                        await handleAttendanceAction();
                        return;
                    }
                } else {
                    // Any non-match immediately resets the streak — no partial credit
                    if (validationCountRef.current > 0) {
                        console.log(`❌ Match broken at frame ${validationCountRef.current}. Dist: ${bestDist.toFixed(3)}`);
                    }
                    validationCountRef.current = 0;
                    setIsFaceVerified(false);
                    if (bestDist < 0.55) {
                        setFaceStatus('Face looks similar but not matched. Hold still and face forward.');
                    } else {
                        setFaceStatus('Face not recognized. Are you the registered user?');
                    }
                }
            } catch (e) {
                console.warn('Scan error:', e);
            }

            timer = setTimeout(loop, 80);
        };

        // Small initial delay to let video element fully initialize
        timer = setTimeout(loop, 300);

        return () => {
            scanLoopActive.current = false;
            if (timer) clearTimeout(timer);
        };
    }, [modelsLoaded, cameraActive, saveEnrollment, handleAttendanceAction, ensureVideoAttached]);


    // ── Lifecycle effects ─────────────────────────────────────────────

    // 1. On mount: load fresh user from server
    useEffect(() => {
        const init = async () => {
            if (refreshEmployeeFromServer && rawUser && rawUser.role !== 'Admin') {
                const fresh = await refreshEmployeeFromServer();
                if (fresh) setLocalUser(fresh);
            }
            setUserReady(true);
        };
        init();
        fetchAttendanceStatus();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 2. Start loading models once user is ready
    useEffect(() => {
        if (userReady && !modelsLoaded) loadModels();
        return () => { stopCamera(); };
    }, [userReady]); // eslint-disable-line react-hooks/exhaustive-deps

    // 3. Once models loaded + user ready: decide enroll vs verify
    // Always re-check server state — never rely purely on stale React user object
    useEffect(() => {
        if (!modelsLoaded || !userReady) return;

        const decide = async () => {
            // Always fetch fresh server state for faceEnrolled check
            let serverFaceEnrolled = user?.faceEnrolled || false;
            try {
                const res = await fetch(`${API_BASE_URL}/attendance/face-descriptors`, {
                    headers: { 'X-Role-Context': 'Employee' },
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    const me = (data.employees || []).find(
                        e => e._id && user?._id && e._id.toString() === user._id.toString()
                    );
                    serverFaceEnrolled = !!(me && me.faceDescriptors && me.faceDescriptors.length > 0);

                    if (serverFaceEnrolled && !user?.faceEnrolled) {
                        // Server says enrolled but local state doesn't — sync it
                        const updatedUser = { ...user, faceEnrolled: true };
                        setLocalUser(updatedUser);
                        if (updateEmployeeUser) updateEmployeeUser(updatedUser);
                    }
                }
            } catch (_) { /* use local state as fallback */ }

            if (serverFaceEnrolled) {
                enrollModeRef.current = false;
                setEnrollModeState(false);
                fetchMyDescriptor();
            } else {
                enrollModeRef.current = true;
                setEnrollModeState(true);
                setIsExpanded(true);
                setFaceStatus('📸 Face enrollment required. Look at the camera.');
            }
        };

        decide();
    }, [modelsLoaded, userReady]); // eslint-disable-line react-hooks/exhaustive-deps

    // 4. Tab visibility — gate scan loop immediately, stop/restart camera
    useEffect(() => {
        const onVisibility = () => {
            if (document.hidden) {
                // Set ref FIRST — scan loop checks this at top of every tick
                // This stops all faceapi WASM calls immediately, before camera even stops
                tabHiddenRef.current = true;
                stopCamera();
            } else {
                tabHiddenRef.current = false;
                if (modelsLoaded) {
                    // Small delay to let browser settle after tab switch
                    setTimeout(() => startCamera(), 300);
                }
            }
        };
        // Sync ref with current visibility state immediately on mount
        tabHiddenRef.current = document.hidden;
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [modelsLoaded, stopCamera, startCamera]);

    // 5. Page unload cleanup
    useEffect(() => {
        const cleanup = () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        };
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('pagehide', cleanup);
        return () => {
            window.removeEventListener('beforeunload', cleanup);
            window.removeEventListener('pagehide', cleanup);
        };
    }, []);

    // 6. After camera starts, attach stream to video element
    useEffect(() => {
        if (cameraActive && streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(() => {});
        }
    }, [cameraActive, isExpanded]); // isExpanded triggers re-attach after layout shift

    // ── Manual camera retry ───────────────────────────────────────────
    const handleCameraRetry = useCallback(async () => {
        setCameraError('');
        await startCamera();
    }, [startCamera]);


    // ── RENDER ────────────────────────────────────────────────────────
    const enrollMode = enrollModeState;

    return (
        <div className={`space-y-6 mx-auto transition-all duration-500 ${isExpanded ? 'max-w-7xl' : 'max-w-6xl'}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        {enrollMode ? 'Face Enrollment' : 'Mark Attendance'}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {enrollMode
                            ? `Step ${Math.min(enrollProgress + 1, ENROLL_SAMPLES_NEEDED)} of ${ENROLL_SAMPLES_NEEDED} — One-time face registration.`
                            : 'Face recognition marks attendance automatically.'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!enrollMode && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg border border-border/40 transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            <span>{isExpanded ? 'Minimize' : 'Expand'}</span>
                        </button>
                    )}
                    {!cameraActive && modelsLoaded && (
                        <button
                            onClick={handleCameraRetry}
                            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg border border-primary/30 transition-all text-sm font-medium text-primary"
                        >
                            <RefreshCw className="w-4 h-4" /> Retry Camera
                        </button>
                    )}
                </div>
            </div>

            {/* Message banner */}
            {message.text && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border font-medium text-sm animate-in slide-in-from-top-2 ${
                    message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    message.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                    'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                    {message.text}
                </div>
            )}

            <div className={`grid gap-6 transition-all duration-500 ${isExpanded ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>

                {/* ── Left panel ── */}
                {!isExpanded && (
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        {enrollMode ? (
                            /* Enrollment guide */
                            <div className="bg-card border border-border/40 shadow-sm rounded-xl p-6 space-y-5 h-full flex flex-col justify-center">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                                    <AlertCircle className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="font-bold text-lg text-foreground text-center">Face Enrollment Required</h3>

                                {/* Progress dots */}
                                <div className="flex items-center justify-center gap-3">
                                    {Array.from({ length: ENROLL_SAMPLES_NEEDED }).map((_, i) => (
                                        <div key={i} className={`transition-all duration-300 rounded-full ${
                                            i < enrollProgress
                                                ? 'w-8 h-8 bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-sm'
                                                : i === enrollProgress
                                                ? 'w-8 h-8 bg-primary/20 border-2 border-primary animate-pulse'
                                                : 'w-6 h-6 bg-muted border border-border/60'
                                        }`}>
                                            {i < enrollProgress ? '✓' : ''}
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2 text-sm text-muted-foreground text-center">
                                    <p className="font-medium text-foreground">Tips for accurate enrollment:</p>
                                    <ul className="text-left space-y-1 text-xs bg-muted/30 rounded-lg p-3 border border-border/40">
                                        <li>• Keep your face well-lit (face the light source)</li>
                                        <li>• Look directly at the camera</li>
                                        <li>• Between captures: slightly tilt left/right</li>
                                        <li>• Remove glasses if possible for first sample</li>
                                        <li>• Distance: arm's length from screen</li>
                                    </ul>
                                </div>
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-medium text-center">
                                    One-time process. Admin required for re-enrollment.
                                </div>
                            </div>
                        ) : (
                            /* Attendance panel */
                            <div className="bg-card border border-border/40 shadow-sm rounded-xl p-6 space-y-5">
                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Today's Shift</h3>

                                <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${attendanceData?.checkIn ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/30 border-border/40'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${attendanceData?.checkIn ? 'bg-emerald-100' : 'bg-background border border-border/40'}`}>
                                            <LogIn className={`w-5 h-5 ${attendanceData?.checkIn ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-foreground">Check In</p>
                                            <p className="text-muted-foreground text-xs">{attendanceData?.checkIn ? fmt(attendanceData.checkIn) : 'Not marked yet'}</p>
                                        </div>
                                    </div>
                                    {attendanceData?.checkIn && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                                </div>

                                <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${attendanceData?.checkOut ? 'bg-rose-50 border-rose-200' : 'bg-muted/30 border-border/40'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${attendanceData?.checkOut ? 'bg-rose-100' : 'bg-background border border-border/40'}`}>
                                            <LogOut className={`w-5 h-5 ${attendanceData?.checkOut ? 'text-rose-600' : 'text-muted-foreground'}`} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-foreground">Check Out</p>
                                            <p className="text-muted-foreground text-xs">{attendanceData?.checkOut ? fmt(attendanceData.checkOut) : 'Not marked yet'}</p>
                                        </div>
                                    </div>
                                    {attendanceData?.checkOut && <CheckCircle className="w-5 h-5 text-rose-500" />}
                                </div>

                                {(user?.shiftStart || user?.shiftEnd) && (
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200/60">
                                        <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Your Shift</p>
                                            <p className="text-sm font-semibold text-blue-900 truncate">
                                                {fmt12(user.shiftStart || '09:00')} – {fmt12(user.shiftEnd || '17:00')}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs text-blue-500">Grace</p>
                                            <p className="text-xs font-bold text-blue-700">{user.lateGraceMinutes ?? 15} min</p>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-muted/40 rounded-lg p-4 text-center border border-border/40">
                                    <UserCheck className="w-7 h-7 mx-auto text-primary mb-2" />
                                    <p className="text-sm font-semibold text-foreground">
                                        {!attendanceData?.checkIn ? 'Look at the camera to Check In'
                                            : !attendanceData?.checkOut ? 'Look at the camera to Check Out'
                                            : 'Shift complete for today!'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">Face recognition is automatic</p>
                                </div>

                                {user?.isOvertimeAllowed && (
                                    <div className="pt-4 border-t border-border/40 grid grid-cols-2 gap-3">
                                        <button
                                            disabled={!attendanceData?.checkOut || !!attendanceData?.overtimeIn}
                                            onClick={async () => {
                                                const res = await fetch(`${API_BASE_URL}/attendance/overtime-in`, { method: 'POST', headers: { 'X-Role-Context': 'Employee' }, credentials: 'include' });
                                                const d = await res.json();
                                                setMessage({ type: res.ok ? 'success' : 'error', text: d.message });
                                                if (res.ok) fetchAttendanceStatus();
                                                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
                                            }}
                                            className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-all"
                                        >Overtime In</button>
                                        <button
                                            disabled={!attendanceData?.overtimeIn || !!attendanceData?.overtimeOut}
                                            onClick={async () => {
                                                const res = await fetch(`${API_BASE_URL}/attendance/overtime-out`, { method: 'POST', headers: { 'X-Role-Context': 'Employee' }, credentials: 'include' });
                                                const d = await res.json();
                                                setMessage({ type: res.ok ? 'success' : 'error', text: d.message });
                                                if (res.ok) fetchAttendanceStatus();
                                                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
                                            }}
                                            className="py-2.5 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-all"
                                        >Overtime Out</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Camera widget ── */}
                <div className={`bg-black border border-border/20 rounded-xl overflow-hidden flex flex-col shadow-xl relative transition-all duration-500 ${isExpanded ? 'min-h-[75vh] col-span-1' : 'min-h-[520px] lg:col-span-7'}`}>

                    {/* Top status bar */}
                    <div className="absolute top-0 w-full z-20 px-6 py-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 rounded-lg backdrop-blur-md">
                                <Camera className="w-5 h-5 text-emerald-400" />
                            </div>
                            <span className="font-black uppercase tracking-widest text-sm text-white drop-shadow-md">
                                {enrollMode ? 'Enrollment Wizard' : 'AI Scanner'}
                            </span>
                        </div>
                        {cameraActive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full backdrop-blur-md">
                                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-red-400 text-xs font-bold uppercase tracking-widest">LIVE</span>
                            </div>
                        )}
                    </div>

                    {/* Video area */}
                    <div className="relative flex-1 flex items-center justify-center bg-gray-950">
                        {cameraError ? (
                            <div className="flex flex-col items-center gap-4 text-center p-8">
                                <Camera className="w-12 h-12 text-rose-400/60" />
                                <p className="text-rose-400 text-sm font-medium">{cameraError}</p>
                                <button
                                    onClick={handleCameraRetry}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" /> Retry Camera
                                </button>
                            </div>
                        ) : cameraActive ? (
                            <>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className={`w-full h-full object-cover scale-x-[-1] absolute inset-0`}
                                />

                                {/* Enrollment guide oval */}
                                {enrollMode && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="relative" style={{ width: '260px', height: '320px' }}>
                                            <div className="absolute inset-0 rounded-[50%] border-2 border-dashed border-emerald-400/60 shadow-[0_0_40px_rgba(52,211,153,0.15)]" />
                                            <div className="absolute inset-2 rounded-[50%] border border-white/10" />
                                        </div>
                                    </div>
                                )}

                                {/* Attendance guide box */}
                                {!enrollMode && (
                                    <div className={`absolute pointer-events-none rounded-3xl transition-all duration-500 border-2 w-56 h-72 ${
                                        isFaceVerified
                                            ? 'border-emerald-400 shadow-[0_0_60px_rgba(52,211,153,0.5)] bg-emerald-500/10'
                                            : isFaceDetected
                                            ? 'border-blue-400/80 shadow-[0_0_30px_rgba(59,130,246,0.3)] bg-blue-500/5'
                                            : 'border-white/20 border-dashed'
                                    }`}>
                                        <div className={`absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 rounded-tl-xl ${isFaceVerified ? 'border-emerald-400' : 'border-white/50'}`} />
                                        <div className={`absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 rounded-tr-xl ${isFaceVerified ? 'border-emerald-400' : 'border-white/50'}`} />
                                        <div className={`absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 rounded-bl-xl ${isFaceVerified ? 'border-emerald-400' : 'border-white/50'}`} />
                                        <div className={`absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 rounded-br-xl ${isFaceVerified ? 'border-emerald-400' : 'border-white/50'}`} />
                                    </div>
                                )}

                                {/* Enrollment progress bar overlay */}
                                {enrollMode && (
                                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-64 z-10">
                                        <div className="bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/10">
                                            <div
                                                className="h-2 bg-emerald-400 rounded-full transition-all duration-500"
                                                style={{ width: `${(enrollProgress / ENROLL_SAMPLES_NEEDED) * 100}%` }}
                                            />
                                        </div>
                                        <p className="text-white/80 text-xs text-center mt-1.5 font-medium">
                                            {enrollProgress}/{ENROLL_SAMPLES_NEEDED} samples
                                        </p>
                                    </div>
                                )}

                                {/* Status pill */}
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 max-w-[90%]">
                                    <div className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-xl border shadow-2xl transition-all text-center ${
                                        isFaceVerified ? 'bg-emerald-600/90 border-emerald-400 text-white'
                                        : enrollMode && enrollProgress > 0 ? 'bg-blue-600/80 border-blue-400 text-white'
                                        : 'bg-black/50 border-white/20 text-white/90'
                                    }`}>
                                        {actionLoading ? '⚡ Processing attendance…' : faceStatus}
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Camera loading state */
                            <div className="flex flex-col items-center gap-4 text-center p-8">
                                <div className="w-12 h-12 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                                <p className="text-white/60 text-sm">{faceStatus}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarkAttendance;
