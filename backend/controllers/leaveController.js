const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveApplication = require('../models/LeaveApplication');
const { formatInTimeZone } = require('date-fns-tz');
const { createNotification } = require('./notificationController');

// @desc    Get employees with optional attendance filters
// @route   POST /api/admin-leave/filter
// @access  Private/Admin
const getFilteredEmployees = async (req, res) => {
    try {
        const { offOnSundayOnly, workedWeekend, month, search, department, role } = req.body;
        
        let query = { role: { $ne: 'Admin' }, adminId: req.adminId };
        
        // Basic Filters
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { employeeId: { $regex: search, $options: 'i' } }
            ];
        }
        if (department) query.department = department;
        if (role) query.role = role;

        // Fetch filtered employees
        let employees = await User.find(query).lean();
        
        if (month && (offOnSundayOnly || workedWeekend)) {
            // Need to filter based on attendance
            const startOfMonth = `${month}-01`;
            const endOfMonth = `${month}-31`; 
            
            const attendanceRecords = await Attendance.find({
                adminId: req.adminId,
                date: { $gte: startOfMonth, $lte: endOfMonth }
            }).lean();
            
            // Group attendance by user
            const attendanceByUser = {};
            attendanceRecords.forEach(r => {
                if (!attendanceByUser[r.userId]) attendanceByUser[r.userId] = [];
                attendanceByUser[r.userId].push(r);
            });
            
            employees = employees.filter(emp => {
                const records = attendanceByUser[emp._id.toString()] || [];
                
                if (offOnSundayOnly) {
                    const sundayAbsences = records.filter(r => r.status === 'Absent' && new Date(r.date).getDay() === 0).length;
                    const otherAbsences = records.filter(r => r.status === 'Absent' && new Date(r.date).getDay() !== 0).length;
                    if (sundayAbsences === 0 || otherAbsences > 0) return false;
                }
                
                if (workedWeekend) {
                    const weekendWork = records.filter(r => 
                        (r.status === 'Present' || r.status === 'Late' || r.status === 'Short Hours') &&
                        (new Date(r.date).getDay() === 0 || new Date(r.date).getDay() === 6)
                    ).length;
                    if (weekendWork === 0) return false;
                }
                
                return true;
            });
        }
        
        res.json(employees);
    } catch (error) {
        console.error('Error in getFilteredEmployees:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Bulk update employee leave and salary rules
// @route   PUT /api/admin-leave/bulk-update
// @access  Private/Admin
const bulkUpdateEmployees = async (req, res) => {
    try {
        const { employeeIds, leaveQuota, extraHourlyRate, shortTimeHourlyRate, offDays, vacations } = req.body;
        
        if (!employeeIds || !employeeIds.length) {
            return res.status(400).json({ message: 'No employees selected' });
        }
        
        const updateData = {};
        if (leaveQuota !== undefined) updateData.leaveQuota = leaveQuota;
        if (extraHourlyRate !== undefined) updateData.extraHourlyRate = extraHourlyRate;
        if (shortTimeHourlyRate !== undefined) updateData.shortTimeHourlyRate = shortTimeHourlyRate;
        if (offDays !== undefined) updateData.offDays = offDays;
        if (vacations !== undefined) updateData.vacations = vacations;
        
        const result = await User.updateMany(
            { _id: { $in: employeeIds }, adminId: req.adminId },
            { $set: updateData }
        );
        
        res.json({ message: 'Employees updated successfully', modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error('Error in bulkUpdateEmployees:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Apply for leave
// @route   POST /api/admin-leave/apply
// @access  Private
const applyForLeave = async (req, res) => {
    try {
        const { startDate, endDate, reason } = req.body;
        
        // Reason is required, dates are optional (defaults to today)
        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: 'Please provide a reason for leave.' });
        }

        // Get current date in PKT timezone for default
        const pktNow = new Date();
        const todayPKT = formatInTimeZone(pktNow, 'Asia/Karachi', 'yyyy-MM-dd');

        // If dates not provided, default to today (same-day leave)
        const leaveStartDate = startDate || todayPKT;
        const leaveEndDate = endDate || todayPKT;

        const leave = new LeaveApplication({
            userId: req.user._id,
            adminId: req.user.adminId || req.user._id, // if admin applies, their adminId is null, use their own id
            startDate: leaveStartDate,
            endDate: leaveEndDate,
            reason: reason.trim()
        });

        // Calculate days correctly (inclusive)
        const start = new Date(leaveStartDate + 'T00:00:00');
        const end = new Date(leaveEndDate + 'T00:00:00');
        const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        leave.daysCount = daysDiff;

        console.log(`📅 Leave application: ${leaveStartDate} to ${leaveEndDate} = ${daysDiff} days`);

        await leave.save();

        // Notify Admin
        if (req.user.adminId) {
            await createNotification({
                userId: req.user.adminId,
                senderId: req.user._id,
                title: 'New Leave Request',
                message: `${req.user.name} requested leave from ${leaveStartDate} to ${leaveEndDate}.`,
                type: 'LeaveRequest',
                link: '/admin/leaves'
            });
        }

        res.status(201).json({ message: 'Leave application submitted successfully.', leave });
    } catch (error) {
        console.error('Error applying for leave:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get my leave applications
// @route   GET /api/admin-leave/my
// @access  Private
const getMyLeaves = async (req, res) => {
    try {
        const leaves = await LeaveApplication.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(leaves);
    } catch (error) {
        console.error('Error fetching my leaves:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all leave applications
// @route   GET /api/admin-leave/all
// @access  Private/Admin
const getAllLeaves = async (req, res) => {
    try {
        const leaves = await LeaveApplication.find({ adminId: req.adminId })
            .populate('userId', 'name employeeId department')
            .sort({ createdAt: -1 });
        res.json(leaves);
    } catch (error) {
        console.error('Error fetching all leaves:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update leave status
// @route   PUT /api/admin-leave/:id/status
// @access  Private/Admin
const updateLeaveStatus = async (req, res) => {
    try {
        const { status, adminNote, startDate, endDate } = req.body;
        
        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const leave = await LeaveApplication.findOne({ _id: req.params.id, adminId: req.adminId });
        
        if (!leave) {
            return res.status(404).json({ message: 'Leave application not found' });
        }

        leave.status = status;
        if (adminNote) leave.adminNote = adminNote;
        
        // Admin can adjust leave dates when approving
        if (status === 'Approved' && startDate && endDate) {
            leave.startDate = startDate;
            leave.endDate = endDate;
            console.log(`✅ Admin adjusted leave dates: ${startDate} to ${endDate} for user ${leave.userId}`);
        }
        
        // Calculate days correctly (inclusive)
        const start = new Date(leave.startDate + 'T00:00:00');
        const end = new Date(leave.endDate + 'T00:00:00');
        const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        leave.daysCount = daysDiff;
        
        console.log(`📅 Leave approval: ${leave.startDate} to ${leave.endDate} = ${daysDiff} days`);
        
        // Determine if leave is paid or unpaid
        if (status === 'Approved') {
            // Get current month's approved paid leaves for this user
            const startOfMonth = new Date(leave.startDate);
            startOfMonth.setDate(1);
            const endOfMonth = new Date(startOfMonth);
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);
            endOfMonth.setDate(0);
            
            const monthStart = formatInTimeZone(startOfMonth, 'Asia/Karachi', 'yyyy-MM-dd');
            const monthEnd = formatInTimeZone(endOfMonth, 'Asia/Karachi', 'yyyy-MM-dd');
            
            // Count paid leave days used this month (excluding this leave)
            const existingPaidLeaves = await LeaveApplication.find({
                userId: leave.userId,
                status: 'Approved',
                isPaid: true,
                _id: { $ne: leave._id },
                startDate: { $gte: monthStart, $lte: monthEnd }
            });
            
            const paidDaysUsed = existingPaidLeaves.reduce((sum, l) => sum + (l.daysCount || 1), 0);
            const paidDaysRemaining = Math.max(0, 2 - paidDaysUsed);
            
            // Check how many days can be paid
            if (paidDaysRemaining >= daysDiff) {
                // All days can be paid
                leave.isPaid = true;
                leave.adminNote = adminNote || `Approved as paid leave (${daysDiff} day(s))`;
            } else if (paidDaysRemaining > 0) {
                // Partial paid - but we'll mark as unpaid for simplicity
                // In future, can split into 2 leave records
                leave.isPaid = false;
                leave.adminNote = adminNote || `Approved as unpaid leave. You've used your 2 paid leaves this month. Salary will be deducted.`;
            } else {
                // All days unpaid
                leave.isPaid = false;
                leave.adminNote = adminNote || `Approved as unpaid leave. You've used your 2 paid leaves this month. Salary will be deducted.`;
            }
            
            console.log(`📊 Leave payment status: isPaid=${leave.isPaid}, daysCount=${daysDiff}, paidDaysUsed=${paidDaysUsed}/2`);
        }
        
        await leave.save();

        // Notify Employee
        await createNotification({
            userId: leave.userId,
            senderId: req.user._id,
            title: `Leave Request ${status}`,
            message: `Your leave request from ${leave.startDate} to ${leave.endDate} has been ${status.toLowerCase()}.${leave.adminNote ? ' Note: ' + leave.adminNote : ''}`,
            type: 'LeaveStatus',
            link: '/employee/leaves'
        });
        
        const message = status === 'Approved' 
            ? `Leave approved successfully for ${daysDiff} day(s) (${leave.isPaid ? 'PAID' : 'UNPAID'})` 
            : 'Leave rejected successfully';
        
        res.json({ message, leave });
    } catch (error) {
        console.error('Error updating leave status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get leave statistics for current month
// @route   GET /api/leaves/stats
// @access  Private
const getLeaveStats = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const monthStart = formatInTimeZone(startOfMonth, 'Asia/Karachi', 'yyyy-MM-dd');
        const monthEnd = formatInTimeZone(endOfMonth, 'Asia/Karachi', 'yyyy-MM-dd');
        
        // Get approved leaves for current month
        const approvedLeaves = await LeaveApplication.find({
            userId: req.user._id,
            status: 'Approved',
            startDate: { $gte: monthStart, $lte: monthEnd }
        });
        
        // Calculate paid and unpaid days
        let paidDays = 0;
        let unpaidDays = 0;
        
        approvedLeaves.forEach(leave => {
            const days = leave.daysCount || 1;
            if (leave.isPaid) {
                paidDays += days;
            } else {
                unpaidDays += days;
            }
        });
        
        const totalUsed = paidDays + unpaidDays;
        const paidRemaining = Math.max(0, 2 - paidDays);
        
        res.json({
            paidAllowed: 2,
            paidUsed: paidDays,
            paidRemaining,
            unpaidUsed: unpaidDays,
            totalUsed,
            month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
        });
    } catch (error) {
        console.error('Error fetching leave stats:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    getFilteredEmployees,
    bulkUpdateEmployees,
    applyForLeave,
    getMyLeaves,
    getAllLeaves,
    updateLeaveStatus,
    getLeaveStats
};
