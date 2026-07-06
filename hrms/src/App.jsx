import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import EmployeeList from './pages/admin/EmployeeList';
import AttendanceTracker from './pages/admin/AttendanceTracker';
import PayrollManagement from './pages/admin/PayrollManagement';
import LeaveManagement from './pages/admin/LeaveManagement';
import AdminSettings from './pages/admin/AdminSettings';

import AppLayout from './layouts/AppLayout';
import EmployeeLayout from './layouts/EmployeeLayout';
import UserDashboard from './pages/employee/UserDashboard';
import MarkAttendance from './pages/employee/MarkAttendance';
import MyAttendance from './pages/employee/MyAttendance';
import EmployeeSalary from './pages/employee/EmployeeSalary';
import Profile from './pages/employee/Profile';
import ApplyLeave from './pages/employee/ApplyLeave';
import Rules from './pages/employee/Rules';

import ManagerLayout from './layouts/ManagerLayout';
import ManagerHome from './pages/manager/ManagerHome';

import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionsProvider } from './context/PermissionsContext';
import ProtectedRoute from './components/ProtectedRoute';
import AccessDenied from './components/AccessDenied';
import { usePermissions } from './context/PermissionsContext';

/**
 * Smart root redirect:
 * - Logged-in Admin   → /admin/dashboard
 * - Logged-in Employee (Manager) → /manager/home
 * - Logged-in Employee → /employee/dashboard
 * - Not logged in → /login
 */
const AuthLoader = () => (
  <div style={{
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--background, #0f172a)',
    zIndex: 9999
  }}>
    <div style={{
      width: 48, height: 48,
      border: '3px solid rgba(99,102,241,0.2)',
      borderTopColor: '#6366f1',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <p style={{ color: '#6366f1', marginTop: 16, fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>HRMS</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const RootRedirect = () => {
  const { adminUser, employeeUser, loading } = useAuth();
  if (loading) return <AuthLoader />;
  if (adminUser) return <Navigate to="/admin/dashboard" replace />;
  if (employeeUser?.role === 'Manager') return <Navigate to="/manager/home" replace />;
  if (employeeUser) return <Navigate to="/employee/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

/**
 * Renders `children` if the user has the required permission,
 * otherwise shows an AccessDenied page.
 */
const PermissionRoute = ({ module, action, children }) => {
  const { can, isOwner } = usePermissions();
  if (isOwner || can(module, action)) return children;
  return <AccessDenied message={`You need the "${module} → ${action}" permission to access this section.`} />;
};

function App() {
  return (
    <AuthProvider>
      <PermissionsProvider>
        <BrowserRouter>
          <Routes>
            {/* Root: smart redirect based on auth state */}
            <Route path="/" element={<RootRedirect />} />

            {/* Public Routes */}
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="employees" element={
                  <PermissionRoute module="employees" action="view">
                    <EmployeeList />
                  </PermissionRoute>
                } />
                <Route path="attendance" element={
                  <PermissionRoute module="attendance" action="view">
                    <AttendanceTracker />
                  </PermissionRoute>
                } />
                <Route path="payroll" element={
                  <PermissionRoute module="payroll" action="view">
                    <PayrollManagement />
                  </PermissionRoute>
                } />
                <Route path="leaves" element={
                  <PermissionRoute module="leaves" action="view">
                    <LeaveManagement />
                  </PermissionRoute>
                } />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
            </Route>

            {/* Employee Routes */}
            <Route element={<ProtectedRoute allowedRoles={['Employee', 'Admin']} />}>
              <Route path="/employee" element={<EmployeeLayout />}>
                <Route index element={<Navigate to="/employee/dashboard" replace />} />
                <Route path="dashboard" element={<UserDashboard />} />
                <Route path="mark-attendance" element={<MarkAttendance />} />
                <Route path="view-attendance" element={<MyAttendance />} />
                <Route path="apply-leave" element={<ApplyLeave />} />
                <Route path="salary" element={<EmployeeSalary />} />
                <Route path="profile" element={<Profile />} />
                <Route path="rules" element={<Rules />} />
              </Route>
            </Route>

            {/* Manager Routes — single page, no sidebar */}
            <Route element={<ProtectedRoute allowedRoles={['Manager']} />}>
              <Route path="/manager" element={<ManagerLayout />}>
                <Route index element={<Navigate to="/manager/home" replace />} />
                <Route path="home" element={<ManagerHome />} />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </PermissionsProvider>
    </AuthProvider>
  );
}

export default App;
