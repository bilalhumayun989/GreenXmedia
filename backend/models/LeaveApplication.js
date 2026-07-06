const mongoose = require('mongoose');

const leaveApplicationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        startDate: {
            type: String, // YYYY-MM-DD
            required: true,
        },
        endDate: {
            type: String, // YYYY-MM-DD
            required: true,
        },
        reason: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending',
        },
        adminNote: {
            type: String,
            default: '',
        },
        isPaid: {
            type: Boolean,
            default: false,
        },
        daysCount: {
            type: Number,
            default: 1,
        }
    },
    {
        timestamps: true,
    }
);

const LeaveApplication = mongoose.model('LeaveApplication', leaveApplicationSchema);

module.exports = LeaveApplication;
