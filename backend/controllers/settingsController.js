const OfficeSettings = require('../models/OfficeSettings');

// @desc    Update or create office IP
// @route   POST /api/settings/office-ip
// @access  Private (Admin or Manager)
const updateOfficeIp = async (req, res) => {
    try {
        const adminId = req.adminId || req.user.adminId || req.user._id;
        
        // Get IP from request (handling proxy headers)
        let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (clientIp && clientIp.includes(',')) {
            clientIp = clientIp.split(',')[0].trim();
        }
        
        let settings = await OfficeSettings.findOne({ adminId });
        if (settings) {
            settings.currentIp = clientIp;
            await settings.save();
        } else {
            settings = await OfficeSettings.create({
                adminId,
                currentIp: clientIp,
            });
        }
        
        res.json({ message: 'Office IP updated successfully', currentIp: clientIp });
    } catch (error) {
        console.error('Error updating office IP:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get current office IP
// @route   GET /api/settings/office-ip
// @access  Private (Admin)
const getOfficeIp = async (req, res) => {
    try {
        const adminId = req.adminId || req.user.adminId || req.user._id;
        const settings = await OfficeSettings.findOne({ adminId });
        
        res.json({ currentIp: settings ? settings.currentIp : null });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    updateOfficeIp,
    getOfficeIp,
};
