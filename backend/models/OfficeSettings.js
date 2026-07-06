const mongoose = require('mongoose');

const officeSettingsSchema = new mongoose.Schema(
    {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        currentIp: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const OfficeSettings = mongoose.model('OfficeSettings', officeSettingsSchema);

module.exports = OfficeSettings;
