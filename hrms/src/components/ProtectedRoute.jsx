import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';

const ProtectedRoute = ({ allowedRoles }) => {
    const { adminUser, employeeUser, loading } = useAuth();
    const { hasAnyAdminPermission } = usePermissions();

    if (loading) return (
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

    const isAuthorized = (() => {
        if (!allowedRoles) return !!(adminUser || employeeUser);

        // For admin routes: user must be logged in as Admin AND have at least one permission
        const hasAdminAccess = allowedRoles.includes('Admin') && adminUser && hasAnyAdminPermission();
        const hasEmployeeAccess = allowedRoles.includes('Employee') && employeeUser && employeeUser.role !== 'Manager';
        const hasManagerAccess = allowedRoles.includes('Manager') && employeeUser && employeeUser.role === 'Manager';

        return hasAdminAccess || hasEmployeeAccess || hasManagerAccess;
    })();

    if (!isAuthorized) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;

