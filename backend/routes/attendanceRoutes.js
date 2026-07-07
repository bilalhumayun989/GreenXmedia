const express = require('express');
const router = express.Router();
const {
    checkIn,
    checkOut,
    overtimeIn,
    overtimeOut,
    getAttendanceStatus,
    getStats,
    getAllAttendance,
    updateAttendance,
    getUserAttendanceHistory,
    getMyAttendanceHistory,
    requestEarlyGo,
    resolveLate,
    resolveEarlyGo,
    getPendingEarlyGo,
    approveOvertime,
    triggerManualReport,
    enrollFace,
    getFaceDescriptors,
    faceCheckIn,
    addCustomAttendance,
    unenrollFace,
    unenrollOwnFace,
    unenrollAllFaces
} = require('../controllers/attendanceController');
const { protect, admin, requirePermission } = require('../middleware/authMiddleware');

// Public Face Recognition routes
router.get('/face-descriptors', protect, getFaceDescriptors); // Must be authenticated
router.post('/face-checkin', protect, faceCheckIn); // Must be authenticated — only own userId allowed

// Self face removal — registered BEFORE router.use(protect) and BEFORE /:userId wildcard
// so Express matches this exact path and never confuses it with /enroll-face/:userId
router.delete('/enroll-face-self', protect, unenrollOwnFace);

router.use(protect); // All attendance routes below are protected

// Employee routes
router.post('/checkin', checkIn);
router.post('/checkout', checkOut);
router.post('/overtime-in', overtimeIn);
router.post('/overtime-out', overtimeOut);
router.get('/status', getAttendanceStatus);
router.get('/stats', getStats);
router.get('/my-history', getMyAttendanceHistory);
router.post('/request-early-go', requestEarlyGo);


// Admin routes
router.get('/', admin, requirePermission('attendance', 'view'), getAllAttendance);
router.get('/pending-early-go', admin, requirePermission('attendance', 'view'), getPendingEarlyGo);
router.get('/user/:userId', admin, requirePermission('attendance', 'view'), getUserAttendanceHistory);
router.post('/report/send', admin, requirePermission('attendance', 'view'), triggerManualReport);
router.put('/overtime/approve/:id', admin, requirePermission('attendance', 'edit'), approveOvertime);
router.post('/:id/resolve-late', admin, requirePermission('attendance', 'edit'), resolveLate);
router.post('/:id/resolve-early-go', admin, requirePermission('attendance', 'edit'), resolveEarlyGo);
router.post('/custom', admin, requirePermission('attendance', 'edit'), addCustomAttendance);
router.put('/:id', admin, requirePermission('attendance', 'edit'), updateAttendance);

// Face Recognition routes
router.post('/enroll-face', enrollFace);
router.delete('/enroll-face-all', admin, unenrollAllFaces);
router.delete('/enroll-face/:userId', admin, unenrollFace);

module.exports = router;

