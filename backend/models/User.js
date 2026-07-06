const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        employeeId: {
            type: String,
            required: true,
            unique: true,
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: false,
        },

        password: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            required: true,
            default: 'Employee',
        },
        department: {
            type: String,
            required: true,
        },

        status: {
            type: String,
            required: true,
            default: 'Active',
        },
        joinDate: {
            type: String,
            required: true,
            default: () => new Date().toISOString().split('T')[0],
        },
        salary: {
            type: Number,
            default: 0,
        },
        phone: {
            type: String,
            default: '',
        },
        address: {
            type: String,
            default: '',
        },
        bio: {
            type: String,
            default: '',
        },
        leaveQuota: {
            type: Number,
            default: 0,
        },
        offDays: {
            type: [Number],
            default: [0], // Default Sunday off (0 = Sunday)
        },
        vacations: {
            type: [String], // Array of 'YYYY-MM-DD' strings
            default: [],
        },
        extraHourlyRate: {
            type: Number,
            default: 0,
        },
        isOvertimeAllowed: {
            type: Boolean,
            default: false,
        },
        // Shift timing — "HH:MM" 24-hour format, e.g. "09:00"
        shiftStart: {
            type: String,
            default: '09:00',
        },
        shiftEnd: {
            type: String,
            default: '17:00',
        },
        // Grace period in minutes before marking Late (default 15 min)
        lateGraceMinutes: {
            type: Number,
            default: 15,
        },
        shortTimeHourlyRate: {
            type: Number,
            default: 0, // 0 means use standard per-minute calculation
        },
        title: {
            type: String,
            default: '',
        },
        adminId: {

            type: require('mongoose').Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        faceDescriptors: {
            type: [[Number]],
            default: [],
        },
        faceEnrolled: {
            type: Boolean,
            default: false,
        },
        // IP-based attendance: stored on the Admin record for the tenant
        officeIp: {
            type: String,
            default: null,          // null = IP restriction disabled
        },
        officeIpUpdatedAt: {
            type: Date,
            default: null,
        },
        ipRestrictionEnabled: {
            type: Boolean,
            default: false,         // Admin must explicitly enable it
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        verificationToken: {
            type: String,
            default: null,
        },
        resetPasswordToken: {
            type: String,
            default: null,
        },
        resetPasswordExpire: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);



const User = mongoose.model('User', userSchema);

module.exports = User;
