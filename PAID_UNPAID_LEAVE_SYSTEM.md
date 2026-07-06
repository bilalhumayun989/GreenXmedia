# Paid/Unpaid Leave System - Complete Implementation

**Date**: July 2, 2026  
**Feature**: Monthly paid leave quota with unpaid overflow  
**Status**: ✅ Complete

---

## Overview

Implemented a comprehensive paid/unpaid leave system where:
- ✅ **2 paid leaves per month** (no salary deduction)
- ✅ **Additional leaves are unpaid** (salary deducted like absent days)
- ✅ **Monthly reset** on the 1st of each month
- ✅ **Automatic calculation** of paid vs unpaid status
- ✅ **Clear display** of leave balance and type

---

## How It Works

### Monthly Paid Leave Quota
- Every employee gets **2 paid leaves per month**
- Quota **resets on the 1st** of each month
- Paid leaves do NOT reduce salary
- Tracked separately from unpaid leaves

### Unpaid Leaves
- Any leave beyond the 2 paid leaves is **unpaid**
- Unpaid leaves are still approved by admin
- Salary is deducted for unpaid leave days (like absent)
- Helps management track who is off vs truly absent

### Automatic Determination
When admin approves a leave:
1. System checks current month's paid leave usage
2. If < 2 paid days used → marks as **PAID**
3. If ≥ 2 paid days used → marks as **UNPAID**
4. Admin is notified of the payment status

---

## Backend Changes

### 1. LeaveApplication Model

**Added Fields**:
```javascript
isPaid: {
    type: Boolean,
    default: false,  // Whether this leave is paid or unpaid
},
daysCount: {
    type: Number,
    default: 1,  // Number of days for this leave
}
```

**Purpose**:
- `isPaid`: Tracks if this specific leave is paid or requires salary deduction
- `daysCount`: Stores calculated days to avoid recalculation

---

### 2. Leave Controller - Update Status

**Enhanced Logic**:
```javascript
// When approving leave
if (status === 'Approved') {
    // 1. Calculate days
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    leave.daysCount = daysDiff;
    
    // 2. Get month boundaries
    const startOfMonth = new Date(leave.startDate);
    startOfMonth.setDate(1);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    
    // 3. Count existing paid leaves this month
    const existingPaidLeaves = await LeaveApplication.find({
        userId: leave.userId,
        status: 'Approved',
        isPaid: true,
        _id: { $ne: leave._id },  // Exclude current leave
        startDate: { $gte: monthStart, $lte: monthEnd }
    });
    
    const paidDaysUsed = existingPaidLeaves.reduce((sum, l) => sum + l.daysCount, 0);
    const paidDaysRemaining = Math.max(0, 2 - paidDaysUsed);
    
    // 4. Determine if this leave is paid or unpaid
    if (paidDaysRemaining >= daysDiff) {
        leave.isPaid = true;
        leave.adminNote = `Approved as paid leave (${daysDiff} day(s))`;
    } else {
        leave.isPaid = false;
        leave.adminNote = `Approved as unpaid leave. Salary will be deducted.`;
    }
}
```

**Success Message**:
```javascript
`Leave approved successfully for ${daysDiff} day(s) (${leave.isPaid ? 'PAID' : 'UNPAID'})`
```

---

### 3. Leave Statistics Endpoint

**New Route**: `GET /api/leaves/stats`

**Returns**:
```json
{
    "paidAllowed": 2,
    "paidUsed": 1,
    "paidRemaining": 1,
    "unpaidUsed": 2,
    "totalUsed": 3,
    "month": "July 2026"
}
```

**Logic**:
```javascript
// Get approved leaves for current month only
const approvedLeaves = await LeaveApplication.find({
    userId: req.user._id,
    status: 'Approved',
    startDate: { $gte: monthStart, $lte: monthEnd }
});

// Sum up paid and unpaid days
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

const paidRemaining = Math.max(0, 2 - paidDays);
```

---

## Frontend Changes

### 1. Employee Leave Application (`ApplyLeave.jsx`)

#### Enhanced Leave Quota Card

**Before**: Simple "Allowed Leaves (Monthly): 2"

**After**: Detailed paid/unpaid breakdown
```
┌──────────────────────────────────────┐
│ Leave Quota                          │
│ July 2026 • Resets monthly          │
├──────────────────────────────────────┤
│ Paid Leaves (Monthly)           2   │  (green)
│ Paid Leaves Used                1   │
│ Paid Leaves Remaining           1   │  (blue)
│ ─────────────────────────────────── │
│ Unpaid Leaves Used              2   │  (amber)
│ Total Leaves Taken              3   │
│                                      │
│ ⚠️ Important:                        │
│ • First 2 leaves/month are PAID     │
│ • Additional leaves are UNPAID      │
│ • Resets on 1st of each month       │
└──────────────────────────────────────┘
```

**Visual Design**:
- Green: Paid leave quota
- Blue: Remaining paid leaves
- Amber: Unpaid leaves (warning color)
- Red info box: Important policy info

#### Enhanced Leave History Table

**Added Column**: Type

| Leave Period | Days | **Type** | Reason | Status | Admin Note |
|---|---|---|---|---|---|
| Jul 5 | 1 | ✓ Paid | Personal | Approved | Approved as paid |
| Jul 8-9 | 2 | ⚠ Unpaid | Family | Approved | Salary will be deducted |
| Jul 12 | 1 | - | Sick | Pending | - |

**Type Column Logic**:
```javascript
{leave.status === 'Approved' ? (
    leave.isPaid ? (
        <Badge variant="success">✓ Paid</Badge>
    ) : (
        <Badge variant="warning">⚠ Unpaid</Badge>
    )
) : (
    <span className="text-muted-foreground">-</span>
)}
```

---

### 2. Admin Leave Management (`LeaveManagement.jsx`)

#### Enhanced Leave List

**Leave Period Column**:
```
Jul 5
1 day(s) • Paid

Jul 8 - Jul 10
3 day(s) • Unpaid
```

Shows payment status inline for approved leaves.

---

## Usage Examples

### Example 1: First Leave of Month (Paid)

**Employee Action**:
1. Applies for leave: Jul 5 (1 day)
2. Reason: "Personal work"

**Admin Action**:
1. Sees leave request
2. Clicks Approve
3. System calculates:
   - Paid days used this month: 0
   - Remaining: 2
   - This leave: 1 day
   - ✅ Can be paid: 1 ≤ 2

**Result**:
- Leave marked as **PAID**
- Admin note: "Approved as paid leave (1 day(s))"
- Employee sees: "✓ Paid" badge
- No salary deduction

---

### Example 2: Second Leave of Month (Paid)

**Employee Action**:
1. Applies for leave: Jul 10-11 (2 days)
2. Reason: "Family function"

**Admin Action**:
1. Approves leave
2. System calculates:
   - Paid days used: 1 (from Jul 5)
   - Remaining: 1
   - This leave: 2 days
   - ❌ Cannot fully pay: 2 > 1

**Result**:
- Leave marked as **UNPAID**
- Admin note: "Approved as unpaid leave. You've used your 2 paid leaves this month. Salary will be deducted."
- Employee sees: "⚠ Unpaid" badge
- Salary deducted for 2 days

---

### Example 3: Monthly Reset

**Timeline**:
- **July**: Used 2 paid leaves
- **August 1st**: Quota resets automatically
- **August 5th**: Apply for leave
- System checks: August month → 0 paid leaves used
- **Result**: Marked as PAID

**No manual action needed** - the system automatically checks current month only.

---

## Employee Dashboard View

```
┌──────────────────────────────────────────────────┐
│ Apply for Leave                                  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────────────┐  ┌────────────────────┐│
│  │ Leave Quota         │  │ Submit Application ││
│  │ July 2026           │  │                    ││
│  │                     │  │ Start: [Jul 15]    ││
│  │ Paid: 2             │  │ End:   [Jul 16]    ││
│  │ Used: 1             │  │                    ││
│  │ Remaining: 1        │  │ Duration: 2 days   ││
│  │                     │  │                    ││
│  │ Unpaid Used: 2      │  │ Reason:            ││
│  │ Total: 3            │  │ [text area]        ││
│  │                     │  │                    ││
│  │ ⚠️ First 2 = PAID   │  │ [Submit]           ││
│  │   Rest = UNPAID     │  │                    ││
│  └─────────────────────┘  └────────────────────┘│
│                                                  │
│  My Leave History                                │
│  ┌──────────────────────────────────────────────┐│
│  │ Jul 5  │ 1 │ ✓ Paid   │ Personal │ Approved ││
│  │ Jul 10 │ 2 │ ⚠ Unpaid │ Family   │ Approved ││
│  │ Jul 15 │ 1 │ -        │ Sick     │ Pending  ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

---

## Integration with Payroll

### Payroll Calculation Impact

**Paid Leave Days**:
```javascript
// In payroll generation
const paidLeaveDays = await LeaveApplication.find({
    userId: employee._id,
    status: 'Approved',
    isPaid: true,
    startDate: { $gte: monthStart, $lte: monthEnd }
});

const paidLeaveDaysCount = paidLeaveDays.reduce((sum, l) => sum + l.daysCount, 0);

// Paid leaves do NOT reduce salary
// Treat as present days for salary calculation
```

**Unpaid Leave Days**:
```javascript
const unpaidLeaveDays = await LeaveApplication.find({
    userId: employee._id,
    status: 'Approved',
    isPaid: false,  // UNPAID
    startDate: { $gte: monthStart, $lte: monthEnd }
});

const unpaidLeaveDaysCount = unpaidLeaveDays.reduce((sum, l) => sum + l.daysCount, 0);

// Unpaid leaves = treat as ABSENT for salary
const dailyRate = monthlySalary / 30;
const unpaidLeaveDeduction = dailyRate * unpaidLeaveDaysCount;
```

**Salary Formula**:
```
Base Salary: 50,000
Days Present: 25
Paid Leaves: 2 days (no deduction)
Unpaid Leaves: 2 days (deduction)
Absences: 1 day (deduction)

Effective Working Days = 25 + 2 (paid leave) = 27
Deduction Days = 2 (unpaid) + 1 (absent) = 3

Daily Rate = 50,000 / 30 = 1,667
Deduction = 1,667 × 3 = 5,001

Net Salary = 50,000 - 5,001 = 44,999
```

---

## Console Logging

### Backend Logs

**When Approving Leave**:
```
✅ Admin adjusted leave dates: 2026-07-05 to 2026-07-07 for user 64abc123...
📊 Leave payment status: isPaid=true, daysCount=3, paidDaysUsed=0/2
```

**Or**:
```
📊 Leave payment status: isPaid=false, daysCount=2, paidDaysUsed=2/2
```

### Frontend Logs

**When Fetching Stats**:
```javascript
console.log('Leave Stats:', {
    paidAllowed: 2,
    paidUsed: 1,
    paidRemaining: 1,
    unpaidUsed: 2,
    totalUsed: 3,
    month: 'July 2026'
});
```

---

## Testing Scenarios

### Test 1: First Leave (Should be Paid)
1. Fresh month (no leaves used)
2. Employee applies for 1 day leave
3. Admin approves
4. ✅ Expected: Marked as PAID
5. ✅ Employee sees "✓ Paid" badge
6. ✅ Quota shows: Used 1/2 paid

### Test 2: Second Leave (Should be Paid)
1. Already used 1 paid day
2. Employee applies for 1 day leave
3. Admin approves
4. ✅ Expected: Marked as PAID
5. ✅ Quota shows: Used 2/2 paid

### Test 3: Third Leave (Should be Unpaid)
1. Already used 2 paid days
2. Employee applies for 1 day leave
3. Admin approves
4. ✅ Expected: Marked as UNPAID
5. ✅ Employee sees "⚠ Unpaid" badge
6. ✅ Quota shows: 2/2 paid, 1 unpaid
7. ✅ Admin note includes "salary will be deducted"

### Test 4: Multi-Day Leave Exceeding Quota
1. Used 1 paid day already
2. Employee applies for 3-day leave
3. Admin approves
4. ✅ Expected: Marked as UNPAID (3 > remaining 1)
5. ✅ All 3 days counted as unpaid

### Test 5: Monthly Reset
1. July: Used 2 paid + 1 unpaid
2. August 1st arrives
3. Employee checks quota
4. ✅ Expected: Shows 0/2 used (reset)
5. ✅ Next leave in August = PAID

### Test 6: Same Month Multiple Leaves
1. Apply 3 separate single-day leaves in same month
2. Admin approves all
3. ✅ Expected: First 2 = PAID, Third = UNPAID
4. ✅ Quota shows correctly after each

---

## API Endpoints

### Get Leave Statistics
```
GET /api/leaves/stats
Headers: X-Role-Context: Employee

Response:
{
    "paidAllowed": 2,
    "paidUsed": 1,
    "paidRemaining": 1,
    "unpaidUsed": 2,
    "totalUsed": 3,
    "month": "July 2026"
}
```

### Apply for Leave
```
POST /api/leaves/apply
Headers: X-Role-Context: Employee
Body: {
    "startDate": "2026-07-05",
    "endDate": "2026-07-07",
    "reason": "Family function"
}

Response:
{
    "message": "Leave application submitted successfully",
    "leave": {...}
}
```

### Approve Leave (Admin)
```
PUT /api/leaves/:id/status
Headers: X-Role-Context: Admin
Body: {
    "status": "Approved",
    "adminNote": "Approved",
    "startDate": "2026-07-05",  // Optional adjustment
    "endDate": "2026-07-07"
}

Response:
{
    "message": "Leave approved successfully for 3 day(s) (PAID)",
    "leave": {
        ...
        "isPaid": true,
        "daysCount": 3
    }
}
```

---

## Files Modified

### Backend
1. `backend/models/LeaveApplication.js`
   - Added `isPaid` field
   - Added `daysCount` field

2. `backend/controllers/leaveController.js`
   - Enhanced `updateLeaveStatus` with paid/unpaid logic
   - Added `getLeaveStats` function

3. `backend/routes/employeeLeaveRoutes.js`
   - Added `GET /stats` route

### Frontend
1. `hrms/src/pages/employee/ApplyLeave.jsx`
   - Enhanced quota display (paid/unpaid breakdown)
   - Added "Type" column in history table
   - Added `fetchLeaveStats` function
   - Added important policy notice

2. `hrms/src/pages/admin/LeaveManagement.jsx`
   - Enhanced leave period display with payment status

---

## Key Features

✅ **Automatic Calculation**: System determines paid/unpaid without admin input  
✅ **Monthly Reset**: Quota resets automatically on 1st of each month  
✅ **Clear Display**: Color-coded badges show payment status  
✅ **Admin Notification**: Admin sees payment status in success message  
✅ **Employee Transparency**: Employee knows exactly what's paid vs unpaid  
✅ **Payroll Integration Ready**: `isPaid` field ready for payroll calculation  
✅ **Historical Tracking**: All past leaves show payment status  

---

## Important Rules

1. **2 paid leaves per month** - Hard limit, cannot be changed per user currently
2. **Monthly boundary** - Calculated based on leave start date's month
3. **All or nothing** - If leave exceeds remaining paid days, entire leave is unpaid
4. **Cannot split** - Currently doesn't split into paid + unpaid portions
5. **Approved only** - Only approved leaves count toward quota
6. **Day-based** - Calculated by number of days, not hours

---

## Future Enhancements (Optional)

1. **Split Leaves**: Automatically split into paid + unpaid portions
   - Example: 1 paid day remaining, 3-day leave → 1 day paid + 2 days unpaid

2. **Custom Quotas**: Allow admins to set different quotas per employee
   - Some employees may get 3-4 paid leaves

3. **Carry Forward**: Allow unused paid leaves to carry to next month
   - Max 2-3 months carryover

4. **Half-Day Leaves**: Support 0.5 day increments
   - 2 paid leaves = 4 half-days

5. **Leave Types**: Different types with different rules
   - Sick leave: Always paid (up to limit)
   - Vacation: Uses paid quota
   - Emergency: Always unpaid

---

## Summary

Complete paid/unpaid leave system where:
- ✅ First 2 leaves/month are paid (no salary deduction)
- ✅ Additional leaves are unpaid (salary deducted)
- ✅ Automatic monthly reset
- ✅ Clear employee visibility
- ✅ Admin sees payment status
- ✅ Ready for payroll integration

**Status**: 🟢 Fully implemented and ready for production!
