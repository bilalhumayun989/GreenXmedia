const express = require('express');
const router = express.Router();
const { updateOfficeIp, getOfficeIp } = require('../controllers/settingsController');
const { protect } = require('../middleware/authMiddleware');

router.post('/office-ip', protect, updateOfficeIp);
router.get('/office-ip', protect, getOfficeIp);

module.exports = router;
