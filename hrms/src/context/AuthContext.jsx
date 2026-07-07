import { API_BASE_URL } from '../config';
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

// ── localStorage helpers ──────────────────────────────────────
const save = (key, data) => {
    try {
        if (data) localStorage.setItem(key, JSON.stringify(data));
        else localStorage.removeItem(key);
    } catch (_) {}
};

const load = (key) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
};

// ─────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
    // Initialise directly from localStorage — instant, no flash
    const [adminUser, setAdminUser] = useState(() => load('hrms_admin'));
    const [employeeUser, setEmployeeUser] = useState(() => load('hrms_employee'));
    // Start loading=true always; resolve instantly if we have cached data,
    // or after server check on first visit. This prevents any blank-screen flash.
    const [loading, setLoading] = useState(true);

    // ── Silently refresh user data from server (NEVER clears state) ──
    const refreshFromServer = async (role) => {
        try {
            const res = await fetch(`${API_BASE_URL}/users/me?role=${role}`, {
                headers: { 'Accept': 'application/json', 'X-Role-Context': role },
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                if (role === 'Admin') {
                    setAdminUser(data);
                    save('hrms_admin', data);
                } else {
                    setEmployeeUser(data);
                    save('hrms_employee', data);
                }
            }
            // Non-200 → do nothing. localStorage state remains authoritative.
        } catch (_) {
            // Network error → do nothing.
        }
    };

    useEffect(() => {
        const hasCached = load('hrms_admin') || load('hrms_employee');
        if (!hasCached) {
            // First ever visit — check server to see if any session exists
            Promise.all([refreshFromServer('Admin'), refreshFromServer('Employee')])
                .finally(() => setLoading(false));
        } else {
            // Already have cached data — resolve loading immediately (no flash)
            // then verify in background without blocking UI
            setLoading(false);
            refreshFromServer('Admin');
            refreshFromServer('Employee');
        }
    }, []);

    // ── Login: called immediately after successful server login ──
    const login = (userData, contextRole) => {
        const isAdmin = contextRole === 'admin' || userData.role === 'Admin';
        const isManager = userData.role === 'Manager';
        if (isAdmin) {
            setAdminUser(userData);
            save('hrms_admin', userData);
            setEmployeeUser(null);
            save('hrms_employee', null);
        } else {
            // Both Employee and Manager use the employee session slot
            setEmployeeUser(userData);
            save('hrms_employee', userData);
            setAdminUser(null);
            save('hrms_admin', null);
        }
    };

    // ── Logout: explicitly clears session ───────────────────────
    const logout = async (role) => {
        try {
            await fetch(`${API_BASE_URL}/users/logout?role=${role}`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (_) {}

        if (role === 'Admin') {
            setAdminUser(null);
            save('hrms_admin', null);
        } else if (role === 'Employee') {
            setEmployeeUser(null);
            save('hrms_employee', null);
        } else {
            setAdminUser(null);
            setEmployeeUser(null);
            save('hrms_admin', null);
            save('hrms_employee', null);
        }
    };

    // ── Update admin user data ─────────────────────────────────
    const updateAdminUser = (userData) => {
        setAdminUser(userData);
        save('hrms_admin', userData);
    };

    // ── Update employee user data ──────────────────────────────
    const updateEmployeeUser = (userData) => {
        setEmployeeUser(userData);
        save('hrms_employee', userData);
    };

    // ── Force refresh employee data from server and return it ──
    // Returns the fresh user object (or null on failure)
    const refreshEmployeeFromServer = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/users/me`, {
                headers: { 'Accept': 'application/json', 'X-Role-Context': 'Employee' },
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setEmployeeUser(data);
                save('hrms_employee', data);
                return data;
            }
        } catch (_) {}
        return null;
    };

    return (
        <AuthContext.Provider value={{ adminUser, employeeUser, login, logout, loading, updateEmployeeUser, refreshEmployeeFromServer }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
