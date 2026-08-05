const express = require('express');
const router = express.Router();
const { applyForLeave, getMyLeaves, getAllLeaves, updateLeaveStatus, getLeaveStats } = require('../controllers/leaveController');
const { protect, admin } = require('../middleware/authMiddleware');

// Employee routes
router.post('/apply', protect, applyForLeave);
router.get('/my', protect, getMyLeaves);
router.get('/stats', protect, getLeaveStats);

// Admin routes
router.get('/all', protect, admin, getAllLeaves);
router.put('/:id/status', protect, admin, updateLeaveStatus);

module.exports = router;
