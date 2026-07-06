# Leave Application Authentication Fix

**Date**: July 2, 2026  
**Issue**: "Not authorized, token failed" when applying for leave  
**Status**: ✅ Fixed

---

## Problem

When employees tried to apply for leave, they received:
```
❌ Not authorized, token failed
```

The leave application form would not submit.

---

## Root Cause

The `ApplyLeave` component was using an incorrect authentication approach:

### ❌ Old Method (WRONG)
```javascript
// Manually parsing cookie from document.cookie
const token = document.cookie.split('; ')
    .find(row => row.startsWith('jwt_employee='))
    ?.split('=')[1];

// Sending Authorization Bearer token
headers: {
    'Authorization': `Bearer ${token}`
}
```

**Problems**:
1. Manual cookie parsing is error-prone
2. Missing `X-Role-Context` header
3. Backend `authMiddleware.js` expects `X-Role-Context` to identify which cookie to use
4. Without `X-Role-Context`, middleware doesn't know whether to check `jwt_employee` or `jwt_admin` cookie

---

## Solution

### ✅ New Method (CORRECT)
```javascript
// Let browser handle cookies automatically via credentials: 'include'
// Add X-Role-Context header to tell backend which cookie to use

headers: {
    'Content-Type': 'application/json',
    'X-Role-Context': employeeUser ? 'Employee' : 'Admin'
},
credentials: 'include'  // Browser sends cookies automatically
```

---

## How Authentication Works

### Backend Authentication Flow (`authMiddleware.js`)

```javascript
const protect = async (req, res, next) => {
    let token;
    const roleContext = req.headers['x-role-context'];
    
    // Check which cookie to use based on X-Role-Context
    if (roleContext === 'Admin' && req.cookies.jwt_admin) {
        token = req.cookies.jwt_admin;
    } else if (roleContext === 'Employee' && req.cookies.jwt_employee) {
        token = req.cookies.jwt_employee;
    } else {
        // Fallback: try both cookies
        token = req.cookies.jwt_admin || req.cookies.jwt_employee;
    }
    
    if (token) {
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
        next();
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};
```

**Key Point**: Backend expects `X-Role-Context` header to know which cookie to check.

---

## Changes Made

### File: `hrms/src/pages/employee/ApplyLeave.jsx`

#### Change 1: Fixed `fetchMyLeaves` function
```javascript
// OLD (WRONG)
const token = document.cookie.split('; ').find(...)?.split('=')[1];
const res = await fetch(`${API_BASE_URL}/leaves/my`, {
    headers: { 'Authorization': `Bearer ${token}` },
    credentials: 'include'
});

// NEW (CORRECT)
const res = await fetch(`${API_BASE_URL}/leaves/my`, {
    headers: { 'X-Role-Context': employeeUser ? 'Employee' : 'Admin' },
    credentials: 'include'
});
```

#### Change 2: Fixed `handleSubmit` function
```javascript
// OLD (WRONG)
const token = document.cookie.split('; ').find(...)?.split('=')[1];
const res = await fetch(`${API_BASE_URL}/leaves/apply`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    credentials: 'include',
    body: JSON.stringify({ reason })
});

// NEW (CORRECT)
const res = await fetch(`${API_BASE_URL}/leaves/apply`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Role-Context': employeeUser ? 'Employee' : 'Admin'
    },
    credentials: 'include',
    body: JSON.stringify({ reason })
});
```

#### Change 3: Enhanced Error Handling
```javascript
// Added validation
if (!reason.trim()) {
    alert('Please provide a reason for your leave');
    return;
}

// Added console logging
console.log('📝 Submitting leave application...', { reason, user: user?.name });
console.log('📡 Leave application response:', res.status, res.statusText);

// Better error messages
if (res.ok) {
    console.log('✅ Leave applied successfully:', data);
    alert('Leave applied successfully! Your manager will review it soon.');
} else {
    console.error('❌ Leave application failed:', errData);
    alert(errData.message || 'Failed to apply leave. Please try again.');
}

// Network error handling
catch (error) {
    console.error('❌ Error applying leave:', error);
    alert('Network error. Please check your connection and try again.');
}
```

---

## Why This Approach Is Better

### ✅ Advantages

1. **Browser Handles Cookies**: No manual parsing, less error-prone
2. **Consistent with Other Pages**: Matches `MarkAttendance.jsx`, `MyAttendance.jsx` patterns
3. **Proper Role Detection**: Backend knows which cookie to check
4. **Better Security**: Cookies are HttpOnly, not accessible via JavaScript
5. **Better Error Messages**: User gets helpful feedback
6. **Better Debugging**: Console logs show exactly what's happening

### ❌ Why Manual Cookie Parsing Failed

```javascript
// This approach is fragile:
document.cookie.split('; ').find(row => row.startsWith('jwt_employee='))?.split('=')[1]

// Problems:
1. Cookie might not exist → undefined
2. Cookie parsing can fail in edge cases
3. Doesn't work with HttpOnly cookies (secure)
4. Doesn't tell backend which role context to use
5. Backend still needs X-Role-Context header to work properly
```

---

## Testing

### Test Case 1: Employee Apply Leave
1. Login as Employee
2. Go to "Apply Leave" page
3. Enter reason: "Feeling unwell"
4. Click "Submit Application"
5. ✅ Should show: "Leave applied successfully! Your manager will review it soon."
6. ✅ Leave should appear in "My Leave History" table with "Pending" status

### Test Case 2: View Leave History
1. Login as Employee
2. Go to "Apply Leave" page
3. Check "My Leave History" table
4. ✅ Should show all previous leave applications
5. ✅ Should show correct status badges (Pending/Approved/Rejected)

### Test Case 3: Console Logs
1. Open browser console (F12)
2. Apply for leave
3. ✅ Should see:
   ```
   📝 Submitting leave application... {reason: "...", user: "..."}
   📡 Leave application response: 200 OK
   ✅ Leave applied successfully: {message: "...", leave: {...}}
   ```

### Test Case 4: Error Handling
1. Disconnect internet
2. Try to apply for leave
3. ✅ Should see: "Network error. Please check your connection and try again."
4. ✅ Button should re-enable after error

---

## Browser Console Reference

### Success Flow
```
📝 Submitting leave application... {reason: "Personal work", user: "Test User"}
📡 Leave application response: 201 Created
✅ Leave applied successfully: {message: "Leave application submitted successfully", leave: {...}}
```

### Auth Error (Before Fix)
```
❌ Leave application failed: {message: "Not authorized, token failed"}
```

### Auth Success (After Fix)
```
✅ Leave applied successfully: {message: "Leave application submitted successfully"}
```

---

## Related Files

### Backend
- `backend/middleware/authMiddleware.js` - Handles authentication
- `backend/routes/employeeLeaveRoutes.js` - Leave routes
- `backend/controllers/leaveController.js` - Leave logic

### Frontend
- `hrms/src/pages/employee/ApplyLeave.jsx` - ✅ Fixed
- `hrms/src/context/AuthContext.jsx` - Provides user context
- `hrms/src/config.js` - API base URL

---

## Standard API Call Pattern

All API calls in this project should follow this pattern:

```javascript
const res = await fetch(`${API_BASE_URL}/api/endpoint`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Role-Context': employeeUser ? 'Employee' : 'Admin'
    },
    credentials: 'include',  // Sends cookies automatically
    body: JSON.stringify({ data })
});
```

**DO NOT use**:
```javascript
// ❌ Manual cookie parsing
const token = document.cookie.split('...');
// ❌ Authorization Bearer header
'Authorization': `Bearer ${token}`
```

**DO use**:
```javascript
// ✅ X-Role-Context header
'X-Role-Context': 'Employee'
// ✅ credentials: 'include'
credentials: 'include'
```

---

## Other Pages Using Same Pattern

These pages already use the correct pattern and work fine:

1. ✅ `MarkAttendance.jsx` - Face check-in/out
2. ✅ `MyAttendance.jsx` - View attendance history
3. ✅ `UserDashboard.jsx` - Dashboard stats
4. ✅ `EmployeeSalary.jsx` - View salary

**ApplyLeave.jsx** is now fixed to match this pattern.

---

## Deployment Notes

### Before Deploying
- [x] Fix applied to `ApplyLeave.jsx`
- [x] No TypeScript/ESLint errors
- [x] Tested leave application submission
- [x] Tested leave history fetching

### After Deploying
1. Test with real employee account
2. Verify leave appears in admin panel
3. Check console for any errors
4. Verify leave history loads correctly

---

## Future Improvements (Optional)

### Short Term
1. Add date picker for leave dates (currently just reason field)
2. Add validation for overlapping leaves
3. Show admin approval status in real-time

### Medium Term
1. Add email notification when leave approved/rejected
2. Add leave balance tracking
3. Add leave calendar view

### Long Term
1. Multi-day leave support
2. Leave types (sick, vacation, etc.)
3. Leave carryover to next month

---

## Summary

**Issue**: Leave application failed with "Not authorized, token failed"

**Root Cause**: Missing `X-Role-Context` header + incorrect token handling

**Fix**: 
1. ✅ Removed manual cookie parsing
2. ✅ Added `X-Role-Context` header
3. ✅ Use `credentials: 'include'` for automatic cookie handling
4. ✅ Enhanced error handling and logging

**Status**: ✅ Working correctly now

**Test**: Login as employee → Apply Leave → Should work!
