import { API_BASE_URL } from '../../config';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle,
    Clock, Shield, ShieldOff, Globe, Loader2,
} from 'lucide-react';

const AUTO_REFRESH_MS  = 5 * 60 * 1000; // 5 minutes
const IPIFY_URL        = 'https://api.ipify.org?format=json';

// ── Fetch the real public IP from the browser ─────────────────────────────────
// api.ipify.org is free, no API key, returns { "ip": "x.x.x.x" }
// We use the browser to call it so we always get the correct public IP
// regardless of whether the backend and frontend share the same machine.
const fetchPublicIp = async () => {
    try {
        const res  = await fetch(IPIFY_URL, { cache: 'no-store' });
        const data = await res.json();
        return data.ip || null;
    } catch {
        return null;
    }
};

// ── Format seconds → M:SS ─────────────────────────────────────────────────────
const fmtCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const formatDateTime = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString('en-PK', {
        timeZone: 'Asia/Karachi',
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const formatTime = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString('en-PK', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
};

// ─────────────────────────────────────────────────────────────────────────────

const ManagerHome = () => {
    const [publicIp,   setPublicIp]   = useState(null);   // real public IP from ipify
    const [ipLoading,  setIpLoading]  = useState(true);   // fetching public IP
    const [status,     setStatus]     = useState(null);   // data from /api/manager/home
    const [pageLoading, setPageLoading] = useState(true);
    const [updating,   setUpdating]   = useState(false);
    const [message,    setMessage]    = useState({ type: '', text: '' });
    const [lastRefresh, setLastRefresh] = useState(null);
    const [countdown,  setCountdown]  = useState(AUTO_REFRESH_MS / 1000);

    // ── Step 1: get real public IP from browser ───────────────────────────────
    const refreshPublicIp = useCallback(async () => {
        setIpLoading(true);
        const ip = await fetchPublicIp();
        setPublicIp(ip);
        setIpLoading(false);
        return ip;
    }, []);

    // ── Step 2: fetch dashboard status, passing public IP in header ───────────
    const fetchStatus = useCallback(async (ip, silent = false) => {
        if (!silent) setPageLoading(true);
        try {
            const headers = { 'X-Role-Context': 'Employee' };
            if (ip) headers['X-Client-IP'] = ip;   // tells server our real public IP

            const res = await fetch(`${API_BASE_URL}/manager/home`, {
                headers,
                credentials: 'include',
            });
            if (res.ok) {
                setStatus(await res.json());
                setLastRefresh(new Date());
                setCountdown(AUTO_REFRESH_MS / 1000);
            }
        } catch {
            if (!silent) setMessage({ type: 'error', text: 'Could not reach server.' });
        } finally {
            if (!silent) setPageLoading(false);
        }
    }, []);

    // ── Combined refresh ──────────────────────────────────────────────────────
    const doRefresh = useCallback(async (silent = false) => {
        const ip = await refreshPublicIp();
        await fetchStatus(ip, silent);
    }, [refreshPublicIp, fetchStatus]);

    // ── Push current public IP as office IP ──────────────────────────────────
    const updateOfficeIp = async () => {
        if (!publicIp) {
            setMessage({ type: 'error', text: 'Cannot detect your public IP. Check your internet connection.' });
            return;
        }
        setUpdating(true);
        setMessage({ type: '', text: '' });
        try {
            const res  = await fetch(`${API_BASE_URL}/manager/update-ip`, {
                method: 'POST',
                headers: {
                    'X-Role-Context': 'Employee',
                    'X-Client-IP':    publicIp,   // send the browser-detected public IP
                },
                credentials: 'include',
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: `✓ Office IP set to ${data.detectedIp}` });
                await fetchStatus(publicIp, true);
            } else {
                setMessage({ type: 'error', text: data.message || 'Update failed.' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Connection error. Try again.' });
        } finally {
            setUpdating(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 5000);
        }
    };

    // ── On mount: full refresh ────────────────────────────────────────────────
    useEffect(() => { doRefresh(); }, [doRefresh]);

    // ── Auto-refresh every 5 minutes ─────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => doRefresh(true), AUTO_REFRESH_MS);
        return () => clearInterval(interval);
    }, [doRefresh]);

    // ── Countdown ticker ─────────────────────────────────────────────────────
    useEffect(() => {
        const tick = setInterval(() => {
            setCountdown(prev => (prev <= 1 ? AUTO_REFRESH_MS / 1000 : prev - 1));
        }, 1000);
        return () => clearInterval(tick);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────

    if (pageLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 pt-24">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading office IP status…</p>
            </div>
        );
    }

    const isSynced              = !!(publicIp && status?.storedIp && status.storedIp === publicIp);
    const ipRestrictionEnabled  = status?.ipRestrictionEnabled;
    const storedIp              = status?.storedIp;

    return (
        <div className="space-y-5 animate-in fade-in duration-400 pt-4">

            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Wifi className="w-6 h-6 text-amber-500" />
                    Office IP Dashboard
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Keep this page open on the office computer. It auto-updates the office IP every 5 minutes.
                </p>
            </div>

            {/* Toast */}
            {message.text && (
                <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
                    message.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                    {message.type === 'success'
                        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                        : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {message.text}
                </div>
            )}

            {/* IP Restriction status banner */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                ipRestrictionEnabled
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
                {ipRestrictionEnabled
                    ? <Shield className="w-4 h-4 shrink-0 text-emerald-600" />
                    : <ShieldOff className="w-4 h-4 shrink-0 text-rose-600" />}
                <span>
                    IP restriction is <strong className={ipRestrictionEnabled ? 'text-emerald-800' : 'text-rose-800'}>
                        {ipRestrictionEnabled ? 'ENABLED' : '⚠️ DISABLED'}
                    </strong>
                    {ipRestrictionEnabled
                        ? ' — employees must be on the office network to mark attendance.'
                        : ' — ⚠️ WARNING: Employees can mark attendance from anywhere! Admin must enable IP restriction in Settings.'}
                </span>
            </div>

            {/* Main card */}
            <div className={`bg-card rounded-xl border shadow-sm overflow-hidden ${
                isSynced ? 'border-emerald-200' : storedIp ? 'border-amber-200' : 'border-border/40'
            }`}>

                {/* Card header strip */}
                <div className={`px-5 py-3 flex items-center justify-between ${
                    isSynced ? 'bg-emerald-50' : storedIp ? 'bg-amber-50' : 'bg-muted/30'
                }`}>
                    <div className="flex items-center gap-2">
                        {isSynced
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            : storedIp
                            ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                            : <Globe className="w-4 h-4 text-muted-foreground" />}
                        <span className={`text-xs font-semibold uppercase tracking-wider ${
                            isSynced ? 'text-emerald-700'
                            : storedIp ? 'text-amber-700'
                            : 'text-muted-foreground'
                        }`}>
                            {isSynced
                                ? 'Synced — Office IP is current'
                                : storedIp
                                ? 'IP changed — update required'
                                : 'No office IP set yet'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Auto-refresh in {fmtCountdown(countdown)}
                    </div>
                </div>

                <div className="p-5 space-y-5">

                    {/* Your current public IP */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Your Current Public IP (this device)
                            </p>
                            <Globe className="w-3 h-3 text-muted-foreground" />
                        </div>
                        {ipLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">Detecting…</span>
                            </div>
                        ) : publicIp ? (
                            <p className="text-2xl font-bold font-mono text-foreground tracking-wider">
                                {publicIp}
                            </p>
                        ) : (
                            <p className="text-sm text-rose-500 font-medium">
                                Could not detect IP — check internet connection
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Detected via browser (api.ipify.org) — this is your real public IP
                        </p>
                    </div>

                    <div className="border-t border-border/40" />

                    {/* Stored office IP */}
                    <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Stored Office IP
                        </p>
                        <p className={`text-xl font-bold font-mono tracking-wider ${
                            storedIp ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                            {storedIp || 'Not set yet'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Last updated: {formatDateTime(status?.officeIpUpdatedAt)}
                        </p>
                    </div>

                    {/* Match / mismatch indicator */}
                    {storedIp && publicIp && (
                        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg ${
                            isSynced
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                            {isSynced
                                ? <><CheckCircle2 className="w-4 h-4 shrink-0" /> Your IP matches the stored office IP — no update needed.</>
                                : <><AlertTriangle className="w-4 h-4 shrink-0" /> IP has changed from <code className="font-mono bg-amber-100 px-1 rounded">{storedIp}</code> to <code className="font-mono bg-amber-100 px-1 rounded">{publicIp}</code>. Click below to update.</>}
                        </div>
                    )}

                    {/* Action buttons row */}
                    <div className="flex gap-3">
                        {/* Set as Office IP */}
                        <button
                            onClick={updateOfficeIp}
                            disabled={updating || isSynced || !publicIp || ipLoading}
                            className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-lg font-semibold text-sm transition-all disabled:cursor-not-allowed ${
                                isSynced
                                    ? 'bg-muted text-muted-foreground'
                                    : !publicIp || ipLoading
                                    ? 'bg-muted text-muted-foreground'
                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-[0.98]'
                            }`}
                        >
                            {updating ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                            ) : isSynced ? (
                                <><CheckCircle2 className="w-4 h-4" /> Office IP is Current</>
                            ) : (
                                <><Wifi className="w-4 h-4" /> Set {publicIp || '…'} as Office IP</>
                            )}
                        </button>

                        {/* Manual refresh */}
                        <button
                            onClick={() => doRefresh()}
                            disabled={ipLoading || pageLoading}
                            title="Refresh IP now"
                            className="h-11 w-11 shrink-0 flex items-center justify-center rounded-lg border border-border/40 bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${(ipLoading || pageLoading) ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* How it works */}
            <div className="bg-card border border-border/40 rounded-xl p-4 space-y-3 shadow-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">How it works</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                    {[
                        'Keep this page open on any office computer — it auto-refreshes every 5 minutes.',
                        'Your browser fetches your real public IP via api.ipify.org — works even on dynamic IPs.',
                        'When your ISP assigns a new IP, the yellow alert appears and you click "Set as Office IP".',
                        'Employees must be on the same public IP (office network) to mark attendance.',
                        "If this page isn't logged in, the last saved IP is used as a fallback.",
                        'Admin can enable or disable IP restriction from Admin Settings.',
                    ].map((tip, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="mt-0.5 w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                                {i + 1}
                            </span>
                            {tip}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Footer */}
            <p className="text-xs text-center text-muted-foreground pb-4">
                Last checked: {lastRefresh ? formatTime(lastRefresh) : '—'}
                {' · '}
                <button onClick={() => doRefresh()} className="underline hover:text-foreground transition-colors">
                    Refresh now
                </button>
            </p>

        </div>
    );
};

export default ManagerHome;
