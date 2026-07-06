const express = require('express');
const router = express.Router();
const { getFilteredEmployees, bulkUpdateEmployees, applyForLeave, getMyLeaves, getAllLeaves, updateLeaveStatus } = require('../controllers/leaveController');
const { protect, admin } = require('../middleware/authMiddleware');

// Get employees with optional attendance filters
router.post('/filter', protect, admin, getFilteredEmployees);

// Bulk update employee leave and salary rules
router.put('/bulk-update', protect, admin, bulkUpdateEmployees);

// Leave application routes
router.post('/apply', protect, applyForLeave);
router.get('/my', protect, getMyLeaves);
router.get('/all', protect, admin, getAllLeaves);
router.put('/:id/status', protect, admin, updateLeaveStatus);

module.exports = router;
