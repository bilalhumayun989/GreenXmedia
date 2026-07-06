# 🔍 Attendance Tab Debugging Guide

## Problem
Attendance tab shows "No matching records found" even though attendance data exists.

## Quick Fix Steps

### Step 1: Open Browser Console (F12)
1. Open the Attendance tab in Admin panel
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Look for these log messages:

```javascript
Attendance API Response: {status: 200, ok: true, data: [...]}
Attendance data loaded: X records
Filtering attendance: {...}
Filtered results: 0 records  // ← This is the problem!
```

### Step 2: Check What's Being Logged

#### Expected Output (Working):
```
Attendance API Response: {status: 200, ok: true, data: Array(50)}
Attendance data loaded: 50 records
Filtering attendance: {
    totalRecords: 50,
    filterYear: "2026",
    filterMonth: "06",
    searchTerm: "",
    statusFilter: "All",
    selectedEmployeeId: "All",
    sampleRecord: {date: "2026-06-30", userId: {...}, ...}
}
Filtered results: 50 records
```

#### If You See This (Problem):
```
Attendance API Response: {status: 200, ok: true, data: Array(50)}
Attendance data loaded: 50 records
Filtering attendance: {
    totalRecords: 50,
    filterYear: "2026",    ← Check this
    filterMonth: "06",     ← Check this
    sampleRecord: {date: "2024-01-15", ...}  ← Date mismatch!
}
Filtered results: 0 records  ← No records match filter
```

---

## Common Issues

### Issue 1: Month/Year Filter Mismatch

**Problem**: Default filter is set to current month (June 2026), but your attendance data is from a different month.

**Solution**:
1. Look at the month/year dropdowns at the top of the page
2. Change to the month where you have data
3. Example: If your test data is from January 2024, select:
   - Month: **January**
   - Year: **2024**

---

### Issue 2: No Attendance Data in Database

**Problem**: API returns empty array `[]`

**Solution**:
```javascript
// Console will show:
Attendance data loaded: 0 records
Filtered results: 0 records
```

**Fix**: Add test attendance data
1. Backend: Run the test data injection script if available
2. Or manually mark attendance via Employee panel first
3. Or use "Add Custom Attendance" button in Admin Attendance tab

---

### Issue 3: API Permission Error

**Problem**: API returns 403 or 401

```javascript
Attendance API Response: {status: 403, ok: false, data: {message: "Access denied"}}
API returned error: {message: "Access denied"}
```

**Solution**: Check if Admin has permission to view attendance
1. Go to Admin → Settings → Check permissions
2. Verify `attendance: view` permission is enabled

---

### Issue 4: Backend Not Running

**Problem**: Network error in console

```javascript
Error fetching attendance: TypeError: Failed to fetch
Connection error. Please check if backend is running.
```

**Solution**:
1. Check if backend is running on port 5000
2. Open terminal and run: `cd backend && npm start`
3. Verify backend URL in `hrms/src/config.js`

---

## Step-by-Step Debugging

### 1. Verify Backend is Running
```bash
# Terminal
cd backend
npm start

# Should see:
Server running on port 5000
MongoDB Connected: ...
```

### 2. Test API Directly
Open browser and go to:
```
http://localhost:5000/api/attendance
```

**Expected**: JSON array of attendance records
**If 401**: Need to login first
**If 403**: Permission issue
**If empty []**: No data in database

### 3. Check Database
```bash
# If using MongoDB Compass or CLI:
use your_database_name
db.attendances.find().limit(10)

# Should show attendance records with structure:
{
    _id: ObjectId(...),
    userId: ObjectId(...),
    date: "2026-06-30",
    checkIn: ISODate(...),
    checkOut: ISODate(...),
    status: "Present",
    ...
}
```

### 4. Check Month/Year Filter
In the Attendance page, look at the top right:
```
┌─────────────────────────────────┐
│  [June ▼]  [2026 ▼]            │
└─────────────────────────────────┘
```

Change these to match your test data dates!

---

## Quick Test: Add Sample Data

### Method 1: Via Admin UI
1. Go to Attendance tab
2. Click **"+ Add Custom Attendance"** button
3. Fill in:
   - Employee: Select any employee
   - Date: **Today's date** (or the current month you're viewing)
   - Status: Present
   - Check In: 09:00
   - Check Out: 17:00
4. Click **Save**
5. Refresh page

### Method 2: Via Employee Panel
1. Login as Employee
2. Go to Mark Attendance
3. Enroll face (if not enrolled)
4. Mark check-in
5. Mark check-out
6. Go back to Admin → Attendance tab
7. Select current month/year

---

## Console Commands for Debugging

### Check loaded data:
```javascript
// In browser console while on Attendance page
console.log(window.attendanceData);  // Won't work - internal state

// But you'll see our debug logs automatically:
// "Attendance data loaded: X records"
// "Filtered results: Y records"
```

### Manual filter test:
If you see data loaded but 0 filtered results, the issue is the date filter.

**Example**:
- Your data: `date: "2024-01-15"` (January 2024)
- Filter looking for: `year: "2026", month: "06"` (June 2026)
- **Mismatch!** → 0 results

**Fix**: Change filter to January 2024

---

## Common Filter States

### Default State (Shows Nothing If No Current Month Data):
```javascript
filterMonth: "06"  // June
filterYear: "2026"  // 2026
searchTerm: ""
statusFilter: "All"
selectedEmployeeId: "All"
```

### If Your Test Data Is From Jan 2024:
Change to:
```javascript
filterMonth: "01"  // January
filterYear: "2024"  // 2024
```

---

## Backend Route Check

### Verify the route is working:

```bash
# Test with curl (replace with your auth cookie)
curl -X GET http://localhost:5000/api/attendance \
  -H "X-Role-Context: Admin" \
  -H "Cookie: connect.sid=your-session-cookie" \
  --cookie-jar cookies.txt

# Should return JSON array
```

### Check backend logs:
```bash
# In backend terminal, you should see:
GET /api/attendance 200 - - ms
```

If you see:
```bash
GET /api/attendance 403 - - ms
```
→ Permission issue

---

## Fix Checklist

- [ ] Backend is running (`npm start` in `backend/`)
- [ ] Frontend is running (`npm run dev` in `hrms/`)
- [ ] Logged in as Admin (not Employee or Manager)
- [ ] Browser console shows "Attendance data loaded: X records" with X > 0
- [ ] Month/Year filter matches the dates in your attendance data
- [ ] No red errors in console
- [ ] API returns 200 (not 401, 403, 500)

---

## Expected Behavior After Fix

### Console Output:
```
Attendance API Response: {status: 200, ok: true, data: Array(50)}
Attendance data loaded: 50 records
Filtering attendance: {totalRecords: 50, filterYear: "2026", filterMonth: "06"}
Filtered results: 50 records
```

### UI:
```
┌──────────────────────────────────────────────────────┐
│ Attendance Tracker                                   │
├──────────────────────────────────────────────────────┤
│ On Time: 45    Late: 3    Absents: 2    Rate: 90%   │
├──────────────────────────────────────────────────────┤
│ Date       Employee     Check In  Check Out  Status  │
│ 2026-06-30 John Doe     09:00 AM  05:00 PM  Present │
│ 2026-06-29 Jane Smith   09:15 AM  05:30 PM  Present │
│ ...                                                  │
└──────────────────────────────────────────────────────┘
```

---

## Still Not Working?

### Collect this info:
1. **Console logs** (copy all messages)
2. **Network tab** (F12 → Network → Click on `/attendance` request)
   - Request Headers
   - Response Body
   - Status Code
3. **Database query result**:
   ```bash
   db.attendances.find().count()  // How many records?
   db.attendances.findOne()       // Sample record
   ```

### Share this info:
- Backend running? Yes/No
- Console error? Copy it
- API status code? (200, 401, 403, 500)
- Data count in DB?
- Month/Year filter set to?

---

## Most Likely Fix

**95% of the time, the issue is:**

The month/year filter is set to **current month (June 2026)**, but your test attendance data is from **a different month** (like January 2024).

**Solution**:
1. Look at your attendance data dates in MongoDB
2. Set the Month/Year filter to match those dates
3. Data will appear immediately! ✅

---

## Quick JavaScript Fix (Temporary)

If you want to see ALL data regardless of month/year filter (for testing only):

```javascript
// In AttendanceTracker.jsx, comment out the date filter:

const filteredAttendance = useMemo(() => {
    return attendanceData.filter(r => {
        // const [year, month] = r.date.split('-');
        // const matchesDate = year === filterYear && month === filterMonth;
        const matchesDate = true;  // ← Temporarily show all dates
        
        const matchesSearch = (r.userId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (r.userId?.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
        const matchesEmployee = selectedEmployeeId === 'All' || r.userId?._id === selectedEmployeeId;
        
        return matchesDate && matchesSearch && matchesStatus && matchesEmployee;
    });
}, [attendanceData, filterYear, filterMonth, searchTerm, statusFilter, selectedEmployeeId]);
```

This will show ALL attendance records regardless of month. Then you can see which months have data.

---

**After following this guide, you should see your attendance data! 🎉**
