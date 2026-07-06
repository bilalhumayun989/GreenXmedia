import { API_BASE_URL } from '../../config';
import React, { useState, useEffect } from 'react';
import { Clock, CalendarCheck, CalendarX, CheckCircle, LogIn, LogOut, User, Briefcase, Building2, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const UserDashboard = () => {
    const { employeeUser, adminUser } = useAuth();
    const user = employeeUser || adminUser;

    const [attendanceData, setAttendanceData] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    // Auto-refresh every minute to handle midnight day-boundary resets
    useEffect(() => {
        const interval = setInterval(fetchDashboardData, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [statusRes, statsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/attendance/status`, {
                    headers: { 'X-Role-Context': 'Employee' },
                    credentials: 'include'
                }),
                fetch(`${API_BASE_URL}/attendance/stats`, {
                    headers: { 'X-Role-Context': 'Employee' },
                    credentials: 'include'
                })
            ]);
            if (statusRes.ok) setAttendanceData(await statusRes.json());
            if (statsRes.ok) setStats(await statsRes.json());
        } catch (e) {
            console.error('Dashboard fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    // Get today's date string in PKT (Asia/Karachi, UTC+5)
    const getPKTDateStr = () => {
        const now = new Date();
        const pkt = new Date(now.getTime() + (5 * 60 * 60 * 1000));
        return pkt.toISOString().slice(0, 10);
    };

    const todayPKT = getPKTDateStr();
    // Only show attendance if the record belongs to today's PKT date
    const todayAttendance = (attendanceData && attendanceData.date === todayPKT) ? attendanceData : null;

    const fmt = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--';

    if (loading) return (
        <div className="h-full w-full flex items-center justify-center">
            <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground text-sm font-medium">Loading Dashboard...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
                <p className="text-muted-foreground mt-1">Welcome back, {user?.name || 'Employee'}!</p>
            </div>

            {/* ── Profile Overview ── */}
            <div className="bg-card border border-border/40 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Name</p>
                        <p className="font-semibold text-foreground mt-0.5">{user?.name || '--'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1"><Briefcase className="w-3 h-3" /> Role</p>
                        <p className="font-semibold text-foreground mt-0.5">{user?.role || '--'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1"><Building2 className="w-3 h-3" /> Department</p>
                        <p className="font-semibold text-foreground mt-0.5">{user?.department || '--'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p>
                        <p className="font-semibold text-foreground mt-0.5 truncate">{user?.email || '--'}</p>
                    </div>
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: <CalendarCheck className="w-5 h-5" />, label: 'Days Present', value: stats?.daysWorked ?? '--', iconBg: 'bg-emerald-50 text-emerald-600' },
                    { icon: <CalendarX className="w-5 h-5" />, label: 'Total Absents', value: stats?.absents ?? '--', iconBg: 'bg-rose-50 text-rose-600' },
                    { icon: <Clock className="w-5 h-5" />, label: 'Late Arrivals', value: stats?.lateArrivals ?? '--', iconBg: 'bg-amber-50 text-amber-600' },
                    { icon: <CheckCircle className="w-5 h-5" />, label: "Today's Status", value: todayAttendance ? todayAttendance.status : 'Not Marked', iconBg: 'bg-blue-50 text-blue-600' },
                ].map((s, i) => (
                    <div key={i} className="bg-card border border-border/40 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${s.iconBg}`}>{s.icon}</div>
                        <p className="text-2xl font-bold text-foreground">{s.value}</p>
                        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Today's Check-in / Check-out ── */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Times</h2>
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { label: 'Check In', value: fmt(todayAttendance?.checkIn), dot: todayAttendance?.checkIn ? 'bg-emerald-500' : 'bg-muted', icon: <LogIn className="w-4 h-4" />, iconBg: todayAttendance?.checkIn ? 'bg-emerald-50 text-emerald-600' : 'bg-muted/40 text-muted-foreground' },
                        { label: 'Check Out', value: fmt(todayAttendance?.checkOut), dot: todayAttendance?.checkOut ? 'bg-rose-500' : 'bg-muted', icon: <LogOut className="w-4 h-4" />, iconBg: todayAttendance?.checkOut ? 'bg-rose-50 text-rose-600' : 'bg-muted/40 text-muted-foreground' },
                    ].map((t, i) => (
                        <div key={i} className="bg-card border border-border/40 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.iconBg}`}>{t.icon}</div>
                                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{t.label}</p>
                            </div>
                            <p className="text-xl font-bold tabular-nums text-foreground">{t.value}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;
