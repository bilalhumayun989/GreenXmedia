const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getManagerHome,
    updateOfficeIp,
    getOfficeIpStatus,
    toggleIpRestriction,
} = require('../controllers/managerController');

// All manager routes require authentication
router.use(protect);

// Manager dashboard data (Manager + Admin can access)
router.get('/home', getManagerHome);

// Manager pushes their detected public IP as the current office IP
router.post('/update-ip', updateOfficeIp);

// Admin: get current office IP status
router.get('/ip-status', getOfficeIpStatus);

// Admin: toggle IP restriction on/off
router.put('/ip-restriction', toggleIpRestriction);

module.exports = router;
