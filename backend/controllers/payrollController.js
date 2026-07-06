const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveApplication = require('../models/LeaveApplication');
const { reconcileAttendance, reconcileMultipleUsersAttendance } = require('./attendanceController');

// @desc    Generate/Calculate Payroll for a specific month
// @route   POST /api/payroll/generate
// @access  Private/Admin
// --- CORE LOGIC SERVICE ---
const generatePayrollService = async (adminId, month, cycle, customStart, customEnd) => {
    if (!month && !customStart) throw new Error('Month or Custom Date Range is required');

    const query = { role: { $ne: 'Admin' }, adminId: adminId };

    const employees = await User.find(query);
    const payrolls = [];

    // 1. Determine Date Range for the Cycle
    let startDate, endDate;

    if (customStart && customEnd) {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
    } else {
        const [yearStr, monthStr] = month.split('-');
        const reqYear = parseInt(yearStr, 10);
        const reqMonth = parseInt(monthStr, 10);

        let daysInMonth = new Date(reqYear, reqMonth, 0).getDate();

        // Default Full Month
        startDate = new Date(reqYear, reqMonth - 1, 1);
        endDate = new Date(reqYear, reqMonth - 1, daysInMonth);

        const today = new Date();
        if (today.getFullYear() === reqYear && (today.getMonth() + 1) === reqMonth) {
            endDate = new Date(reqYear, reqMonth - 1, today.getDate());
        } else if (today.getFullYear() < reqYear || (today.getFullYear() === reqYear && (today.getMonth() + 1) < reqMonth)) {
            endDate = new Date(reqYear, reqMonth - 1, 0); // Future
        }
    }

    // Cap endDate to today (inclusive) so we include today's attendance
    const currentToday = new Date();
    currentToday.setHours(23, 59, 59, 999); // end of today
    if (endDate > currentToday) {
        endDate = new Date();
        endDate.setHours(0, 0, 0, 0); // normalize to start of today
    }

    if (startDate > endDate) {
        return []; // The cycle hasn't even started yet!
    }

    // Format dates for DB querying
    const startStr = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}`;
    const endStr = `${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')}`;
    const totalDaysInCycle = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Reconcile attendance in bulk for all employees first
    await reconcileMultipleUsersAttendance(employees);

    for (const user of employees) {
        // --- Determine per-user start date: max(cycleStart, user join date) ---
        // This ensures a new employee only gets payroll from their join date onward
        const userJoinDate = new Date(user.createdAt || startDate);
        userJoinDate.setHours(0, 0, 0, 0);

        // Per-user effective start: the later of cycle start or join date
        const userStartDate = userJoinDate > startDate ? new Date(userJoinDate) : new Date(startDate);

        // If the user joined after the cycle end, skip entirely
        if (userStartDate > endDate) continue;

        const userStartStr = `${userStartDate.getFullYear()}-${(userStartDate.getMonth() + 1).toString().padStart(2, '0')}-${userStartDate.getDate().toString().padStart(2, '0')}`;
        const userTotalDays = Math.round((endDate - userStartDate) / (1000 * 60 * 60 * 24)) + 1;

        // Fetch attendance records for the specific cycle range (from join date)
        const attendanceRecords = await Attendance.find({
            userId: user._id,
            date: { $gte: userStartStr, $lte: endStr }
        });

        // Fetch approved leave applications to check paid vs unpaid
        const approvedLeaves = await LeaveApplication.find({
            userId: user._id,
            status: 'Approved',
            $or: [
                { startDate: { $gte: userStartStr, $lte: endStr } },
                { endDate: { $gte: userStartStr, $lte: endStr } },
                { startDate: { $lte: userStartStr }, endDate: { $gte: endStr } }
            ]
        });

        const monthlySalary = user.salary || 0;
        // fixed daily rate logic: divide by 30
        const perDaySalary = monthlySalary / 30;

        let totalAbsents = 0;
        let actualAbsents = 0;
        let totalLeavesTaken = 0;
        let absentDeductionAmount = 0;
        let lateDeductionAmount = 0;
        let totalEarnedSalary = 0;
        let totalLates = 0;

        let presentDays = 0;
        let offDaysPassed = 0;

        // Default Friday (5) off day
        const userOffDays = [5]; 
        const dailyBreakdown = [];

        let lastWorkingDayStatus = 'Unknown'; 

        // Iterate through every valid day — from user's join date (or cycle start) to end
        let loopDate = new Date(userStartDate);

        while (loopDate <= endDate) {
            const yearForDay = loopDate.getFullYear();
            const monthForDay = loopDate.getMonth() + 1;
            const day = loopDate.getDate();
            const dayStr = day.toString().padStart(2, '0');
            const monthStrLoop = monthForDay.toString().padStart(2, '0');
            const dateString = `${yearForDay}-${monthStrLoop}-${dayStr}`;

            const dayOfWeek = loopDate.getDay();
            const isRegularOffDay = userOffDays.includes(dayOfWeek);
            const isVacation = user.vacations && user.vacations.includes(dateString);
            const isOffDay = isRegularOffDay || isVacation;
            
            const isBeforeJoin = false; // Loop starts from join date, no pre-join days possible
            const record = attendanceRecords.find(r => r.date === dateString);

            let dayEarnedSalary = 0;
            let dayPayLabel = '';
            let baseMinutes = record ? record.duration || 0 : 0;
            let deduction = 0;

            if (isOffDay) {
                offDaysPassed++;
                if (lastWorkingDayStatus === 'Absent') {
                    dayEarnedSalary = 0;
                    dayPayLabel = 'Off Day (Unpaid due to absence)';
                    deduction = perDaySalary;
                } else {
                    dayEarnedSalary = perDaySalary;
                    dayPayLabel = 'Off Day (Paid)';
                }
            } else {
                // Regular working day or explicit status
                if (record) {
                    if (record.status === 'On Leave') {
                        // Check if this date falls within any PAID leave
                        const isPaidLeave = approvedLeaves.some(l => 
                            l.isPaid && dateString >= l.startDate && dateString <= l.endDate
                        );

                        if (isPaidLeave) {
                            dayEarnedSalary = perDaySalary;
                            dayPayLabel = 'On Leave (Paid)';
                            totalLeavesTaken++;
                        } else {
                            dayEarnedSalary = 0;
                            dayPayLabel = 'On Leave (Unpaid)';
                            deduction = perDaySalary;
                            totalAbsents++;
                            actualAbsents++;
                            absentDeductionAmount += perDaySalary;
                        }
                        lastWorkingDayStatus = isPaidLeave ? 'Present' : 'Absent';
                    } else if (record.status === 'Absent') {
                        dayEarnedSalary = 0;
                        dayPayLabel = 'Absent';
                        deduction = perDaySalary;
                        totalAbsents++;
                        actualAbsents++;
                        absentDeductionAmount += perDaySalary;
                        lastWorkingDayStatus = 'Absent';
                    } else if (record.status === 'Late') {
                        if (record.isLateResolved) {
                            dayEarnedSalary = perDaySalary;
                            dayPayLabel = 'Late (Waived)';
                            presentDays++;
                        } else {
                            dayEarnedSalary = perDaySalary * 0.5;
                            dayPayLabel = 'Late (Half Day)';
                            deduction = perDaySalary * 0.5;
                            lateDeductionAmount += deduction;
                            totalLates++;
                            presentDays++;
                        }
                        lastWorkingDayStatus = 'Present';
                    } else if (record.status === 'Short Hours') {
                        dayEarnedSalary = perDaySalary * 0.5;
                        dayPayLabel = 'Short Hours (Half Day)';
                        deduction = perDaySalary * 0.5;
                        lateDeductionAmount += deduction; // Using lateDeductionAmount for half-days
                        presentDays++;
                        lastWorkingDayStatus = 'Present';
                    } else {
                        // Present
                        dayEarnedSalary = perDaySalary;
                        dayPayLabel = 'Present';
                        presentDays++;
                        lastWorkingDayStatus = 'Present';
                    }
                } else {
                    // No punch
                    dayEarnedSalary = 0;
                    dayPayLabel = 'Absent (No Punch)';
                    deduction = perDaySalary;
                    totalAbsents++;
                    actualAbsents++;
                    absentDeductionAmount += perDaySalary;
                    lastWorkingDayStatus = 'Absent';
                }
            }

            totalEarnedSalary += dayEarnedSalary;

            dailyBreakdown.push({
                date: dateString,
                status: dayPayLabel,
                workMinutes: baseMinutes,
                baseDaySalary: Math.round(perDaySalary),
                earnedSalary: Math.round(dayEarnedSalary),
                deduction: Math.round(deduction)
            });

            loopDate.setDate(loopDate.getDate() + 1);
        }

        const netSalary = Math.max(0, Math.round(totalEarnedSalary));
        const payrollData = {
            userId: user._id,
            adminId: adminId,
            month: month || `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`,
            calculationStartDate: userStartStr,
            calculationEndDate: endStr,
            salary: monthlySalary,
            totalDays: userTotalDays,
            payableDays: userTotalDays,
            offDays: offDaysPassed,
            workingDays: userTotalDays - offDaysPassed,
            presentDays: presentDays,
            totalAbsents: totalAbsents,
            actualAbsents: actualAbsents,
            totalLates: totalLates,
            totalLeaves: totalLeavesTaken,
            deductions: {
                absentDeduction: Math.round(absentDeductionAmount),
                lateDeduction: Math.round(lateDeductionAmount),
                totalDeduction: Math.round(absentDeductionAmount + lateDeductionAmount)
            },
            dailyBreakdown: dailyBreakdown,
            netSalary: netSalary,
            status: 'Pending'
        };

        const existingPayroll = await Payroll.findOne({
            userId: user._id,
            month: payrollData.month,
            adminId: adminId
        });

        if (existingPayroll) {
            Object.assign(existingPayroll, payrollData);
            await existingPayroll.save();
            payrolls.push(existingPayroll);
        } else {
            const newPayroll = new Payroll(payrollData);
            await newPayroll.save();
            payrolls.push(newPayroll);
        }
    }

    return payrolls;
};

// @desc    Generate/Calculate Payroll for a specific month
// @route   POST /api/payroll/generate
// @access  Private/Admin
const generatePayroll = async (req, res) => {
    try {
        const { month, userId, cycle, customStart, customEnd } = req.body;

        const payrolls = await generatePayrollService(req.adminId, month, cycle, customStart, customEnd);

        // If a specific userId was requested, filter the result before sending
        const finalPayrolls = userId ? payrolls.filter(p => p.userId.toString() === userId.toString()) : payrolls;

        // Notify Admin
        const { createNotification } = require('./notificationController');
        await createNotification({
            userId: req.user._id,
            senderId: req.user._id,
            title: 'Payroll Generated',
            message: `Payroll calculation completed for ${month || 'selected range'}. Total records: ${finalPayrolls.length}.`,
            type: 'PayrollGenerated',
            link: '/admin/payroll'
        });

        // Notify each employee
        for (const p of finalPayrolls) {
            await createNotification({
                userId: p.userId,
                senderId: req.user._id,
                title: 'Payroll Generated',
                message: `Your payroll for the month ${p.month} has been generated. Net Salary: Rs ${p.netSalary}.`,
                type: 'PayrollGenerated',
                link: '/employee/salary'
            });
        }

        res.json({ message: 'Payroll generated successfully', count: finalPayrolls.length, payrolls: finalPayrolls });
    } catch (error) {
        console.error('Error generating payroll:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get Payrolls by Month
// @route   GET /api/payroll
// @access  Private/Admin
const getPayrolls = async (req, res) => {
    const { month } = req.query; // YYYY-MM
    try {
        const query = month ? { month: { $regex: `^${month}` }, adminId: req.adminId } : { adminId: req.adminId };
        const payrolls = await Payroll.find(query)
            .populate('userId', 'name employeeId role department')
            .sort({ createdAt: -1 }); // Sort by newest calculation first

        res.json(payrolls);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get My Payrolls
// @route   GET /api/payroll/my
// @access  Private
const getMyPayrolls = async (req, res) => {
    try {
        const payrolls = await Payroll.find({ userId: req.user._id })
            .sort({ month: -1 });
        res.json(payrolls);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update Payroll Status (Admin)
// @route   PUT /api/payroll/:id/status
// @access  Private/Admin
const updatePayrollStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }
        const allowed = ['Paid', 'Draft', 'Pending', 'Processing', 'Completed'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Allowed: ${allowed.join(', ')}` });
        }
        const payroll = await Payroll.findOne({ _id: req.params.id, adminId: req.adminId });
        if (!payroll) {
            return res.status(404).json({ message: 'Payroll record not found' });
        }
        if (status === 'Paid' || status === 'Completed') {
            payroll.paidAt = new Date();
        }
        payroll.status = status;
        await payroll.save();
        res.json({ message: `Payroll status updated to ${status}`, payroll });
    } catch (error) {
        console.error('Error updating payroll status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete Payroll Record (Admin)
// @route   DELETE /api/payroll/:id
// @access  Private/Admin
const deletePayroll = async (req, res) => {
    try {
        const payroll = await Payroll.findOneAndDelete({ _id: req.params.id, adminId: req.adminId });

        if (!payroll) {
            return res.status(404).json({ message: 'Payroll record not found' });
        }

        res.json({ message: 'Payroll record deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete All Payroll Records for Admin (Admin)
// @route   DELETE /api/payroll/delete-all
// @access  Private/Admin
const deleteAllPayrolls = async (req, res) => {
    try {
        await Payroll.deleteMany({ adminId: req.adminId });
        res.json({ message: 'All payroll records deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    generatePayroll,
    getPayrolls,
    getMyPayrolls,
    updatePayrollStatus,
    deletePayroll,
    deleteAllPayrolls,
    generatePayrollService
};
