# Leave Days Calculation Fix

## Problem
Leave applications were showing incorrect day counts. For example:
- **July 7 to July 10** was showing **1 day** instead of **4 days**

This was caused by timezone issues when calculating date differences using JavaScript's `new Date()` constructor with date strings.

## Root Cause
When you create a date from a string like `new Date("2024-07-07")`, JavaScript interprets it as UTC midnight. When calculating differences, timezone conversions could cause off-by-one errors or incorrect calculations.

## Solution Implemented

### 1. Backend Fixes (`backend/controllers/leaveController.js`)

#### Apply Leave Function
```javascript
// OLD (incorrect)
const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

// NEW (correct)
const start = new Date(leaveStartDate + 'T00:00:00');
const end = new Date(leaveEndDate + 'T00:00:00');
const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
leave.daysCount = daysDiff;
```

#### Approve/Reject Leave Function
```javascript
// OLD (incorrect)
const daysDiff = Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;

// NEW (correct)
const start = new Date(leave.startDate + 'T00:00:00');
const end = new Date(leave.endDate + 'T00:00:00');
const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
leave.daysCount = daysDiff;
```

### 2. Frontend Fixes

#### Employee ApplyLeave Page (`hrms/src/pages/employee/ApplyLeave.jsx`)
- Updated calculation when submitting leave
- Updated real-time preview calculation
- Updated history table display

```javascript
// OLD
const start = new Date(startDate);
const end = new Date(endDate);
const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

// NEW
const start = new Date(startDate + 'T00:00:00');
const end = new Date(endDate + 'T00:00:00');
const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
```

#### Admin LeaveManagement Page (`hrms/src/pages/admin/LeaveManagement.jsx`)
- Updated leave period display calculation

```javascript
// OLD
Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1

// NEW
Math.round((new Date(leave.endDate + 'T00:00:00') - new Date(leave.startDate + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1
```

### 3. Migration Script for Old Data

Created `backend/scripts/fix_leave_days.js` to recalculate all existing leave records.

**To run the migration:**
```bash
cd backend
node scripts/fix_leave_days.js
```

This will:
- ✅ Connect to your MongoDB database
- 📋 Find all leave applications
- 📅 Recalculate `daysCount` for each record
- ✓ Only update records that have incorrect counts
- 📊 Show a summary of updates

## Key Changes

### Date Handling
1. **Added `T00:00:00` suffix** to force local timezone interpretation
2. **Changed `Math.ceil()` to `Math.round()`** for more accurate rounding
3. **Ensured consistency** across frontend and backend

### Formula
```
Days = Round((EndDate - StartDate) / (1000 * 60 * 60 * 24)) + 1
```

- **Inclusive calculation**: Both start and end dates are counted
- **Example**: July 7 to July 10 = 4 days (7, 8, 9, 10)

## Testing

### Test Cases
1. **Single day leave** (July 7 to July 7) = 1 day ✅
2. **Two day leave** (July 7 to July 8) = 2 days ✅
3. **Four day leave** (July 7 to July 10) = 4 days ✅
4. **Week-long leave** (July 1 to July 7) = 7 days ✅

### How to Test
1. Apply for a new leave with date range
2. Check the preview shows correct days
3. Submit and verify in history
4. Admin approves and checks paid/unpaid status
5. Generate payroll and verify deductions

## Impact on Paid/Unpaid System

The correct day calculation ensures:
- ✅ Accurate paid leave quota tracking (2 per month)
- ✅ Correct unpaid leave identification (beyond quota)
- ✅ Proper salary deductions in payroll
- ✅ Accurate leave statistics

## Files Modified

### Backend
- `backend/controllers/leaveController.js`

### Frontend
- `hrms/src/pages/employee/ApplyLeave.jsx`
- `hrms/src/pages/admin/LeaveManagement.jsx`

### New Files
- `backend/scripts/fix_leave_days.js` (migration script)

## Next Steps

1. **Run the migration** to fix old data:
   ```bash
   cd backend
   node scripts/fix_leave_days.js
   ```

2. **Test with new leaves**:
   - Apply for multi-day leave
   - Verify day count is correct
   - Check paid/unpaid status

3. **Generate payroll** to verify deductions work correctly

## Notes

- Old data may still show incorrect counts until migration is run
- The migration is safe to run multiple times (idempotent)
- All new leave applications will calculate correctly
- Admin adjustments to leave dates will recalculate days automatically
