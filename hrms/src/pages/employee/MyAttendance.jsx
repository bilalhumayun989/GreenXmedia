import { API_BASE_URL } from '../../config';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Calendar, Clock, Filter, Loader2, ChevronDown, ChevronUp, LogIn, LogOut } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';

const MyAttendance = () => {
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [expandedRow, setExpandedRow] = useState(null);

    const { employeeUser } = useAuth();

    const [earlyGoModal, setEarlyGoModal] = useState(false);
    const [earlyGoTime, setEarlyGoTime] = useState('');
    const [submittingEarlyGo, setSubmittingEarlyGo] = useState(false);

    const getPKTDateStr = () => {
        const now = new Date();
        const pkt = new Date(now.getTime() + (5 * 60 * 60 * 1000));
        return pkt.toISOString().slice(0, 10);
    };
    const todayPKT = getPKTDateStr();

    useEffect(() => {
        fetchAttendance();
    }, [month]);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/attendance/my-history?month=${month}`, {
                headers: { 'X-Role-Context': 'Employee' },
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setAttendance(data);
            }
        } catch (error) {
            console.error('Error fetching my attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const format12h = (time24) => {
        if (!time24) return '--:--';
        try {
            // Handle ISO string if provided
            const date = new Date(time24);
            if (!isNaN(date.getTime())) {
                return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            }
            // Handle HH:MM string
            const [hours, minutes] = time24.split(':');
            const h = parseInt(hours);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${minutes} ${ampm}`;
        } catch (e) { return time24; }
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Present': return 'success';
            case 'Late': return 'warning';
            case 'Short Hours': return 'destructive';
            case 'Absent': return 'destructive';
            default: return 'outline';
        }
    };

    const handleEarlyGoRequest = async () => {
        if (!earlyGoTime) return alert('Please specify a time');
        setSubmittingEarlyGo(true);
        try {
            const res = await fetch(`${API_BASE_URL}/attendance/request-early-go`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role-Context': 'Employee'
                },
                body: JSON.stringify({ time: earlyGoTime }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                alert('Early go request submitted successfully!');
                setEarlyGoModal(false);
                fetchAttendance();
            } else {
                alert(data.message || 'Failed to submit request');
            }
        } catch (error) {
            console.error('Error submitting early go request:', error);
            alert('Connection error. Try again.');
        } finally {
            setSubmittingEarlyGo(false);
        }
    };

    const nowPKT = new Date(new Date().getTime() + (5 * 60 * 60 * 1000));
    const minTimeStr = `${String(nowPKT.getUTCHours()).padStart(2, '0')}:${String(nowPKT.getUTCMinutes()).padStart(2, '0')}`;
    const maxTimeStr = employeeUser?.shiftEnd || '17:00';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">My Attendance</h1>
                    <p className="text-muted-foreground mt-1">Review your check-in history and shift details.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="month"
                            className="pl-9 w-full sm:w-[180px] bg-card border-border/40"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <Card className="border-border/40 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-xl">Attendance Records</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading records...</p>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-border/40 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground font-medium">
                                    <tr>
                                        <th className="px-4 py-4">Date</th>
                                        <th className="px-4 py-4">Check In</th>
                                        <th className="px-4 py-4">Check Out</th>
                                        <th className="px-4 py-4">Duration</th>
                                        <th className="px-4 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {attendance.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="p-12 text-center text-muted-foreground">
                                                No records found for this month.
                                            </td>
                                        </tr>
                                    ) : (
                                        attendance.map((record) => (
                                            <React.Fragment key={record._id}>
                                                <tr 
                                                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                                                    onClick={() => setExpandedRow(expandedRow === record._id ? null : record._id)}
                                                >
                                                    <td className="px-4 py-4 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {expandedRow === record._id ? (
                                                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                            )}
                                                            {new Date(record.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-muted-foreground">
                                                        {record.checkIn ? format12h(record.checkIn) : '--:--'}
                                                    </td>
                                                    <td className="px-4 py-4 text-muted-foreground">
                                                        {record.checkOut ? format12h(record.checkOut) : '--:--'}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {record.duration ? `${Math.floor(record.duration / 60)}h ${record.duration % 60}m` : '--'}
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <Badge variant={getStatusVariant(record.status)}>
                                                            {record.status}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                                {expandedRow === record._id && (
                                                    <tr>
                                                        <td colSpan="5" className="bg-muted/20 px-4 py-4 border-t border-border/40">
                                                            <div className="space-y-3">
                                                                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                                    <Clock className="h-4 w-4" />
                                                                    Attendance Logs
                                                                </h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {/* Check In Log */}
                                                                    {record.checkIn && (
                                                                        <div className="bg-card border border-border/40 rounded-lg p-3 shadow-sm">
                                                                            <div className="flex items-start gap-3">
                                                                                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
                                                                                    <LogIn className="h-4 w-4" />
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Check In</p>
                                                                                    <p className="text-sm font-bold text-foreground mt-0.5">
                                                                                        {new Date(record.checkIn).toLocaleTimeString('en-US', { 
                                                                                            hour: '2-digit', 
                                                                                            minute: '2-digit', 
                                                                                            second: '2-digit',
                                                                                            hour12: true 
                                                                                        })}
                                                                                    </p>
                                                                                    <p className="text-xs text-muted-foreground mt-1">
                                                                                        {new Date(record.checkIn).toLocaleDateString('en-US', { 
                                                                                            weekday: 'long',
                                                                                            day: 'numeric',
                                                                                            month: 'long',
                                                                                            year: 'numeric'
                                                                                        })}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Check Out Log */}
                                                                    {record.checkOut && (
                                                                        <div className="bg-card border border-border/40 rounded-lg p-3 shadow-sm">
                                                                            <div className="flex items-start gap-3">
                                                                                <div className="bg-rose-50 text-rose-600 p-2 rounded-lg">
                                                                                    <LogOut className="h-4 w-4" />
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Check Out</p>
                                                                                    <p className="text-sm font-bold text-foreground mt-0.5">
                                                                                        {new Date(record.checkOut).toLocaleTimeString('en-US', { 
                                                                                            hour: '2-digit', 
                                                                                            minute: '2-digit', 
                                                                                            second: '2-digit',
                                                                                            hour12: true 
                                                                                        })}
                                                                                    </p>
                                                                                    <p className="text-xs text-muted-foreground mt-1">
                                                                                        {new Date(record.checkOut).toLocaleDateString('en-US', { 
                                                                                            weekday: 'long',
                                                                                            day: 'numeric',
                                                                                            month: 'long',
                                                                                            year: 'numeric'
                                                                                        })}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                {/* Additional Details */}
                                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-border/40">
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Total Duration</p>
                                                                        <p className="text-sm font-semibold text-foreground">
                                                                            {record.duration ? `${Math.floor(record.duration / 60)}h ${record.duration % 60}m` : '--'}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Status</p>
                                                                        <Badge variant={getStatusVariant(record.status)} className="mt-1">
                                                                            {record.status}
                                                                        </Badge>
                                                                    </div>
                                                                    {record.isLate && (
                                                                        <div>
                                                                            <p className="text-xs text-muted-foreground">Late Arrival</p>
                                                                            <p className="text-sm font-semibold text-amber-600">Yes</p>
                                                                        </div>
                                                                    )}
                                                                    {record.earlyGoStatus && record.earlyGoStatus !== 'None' && (
                                                                        <div>
                                                                            <p className="text-xs text-muted-foreground">Early Go</p>
                                                                            <Badge variant={record.earlyGoStatus === 'Approved' ? 'success' : record.earlyGoStatus === 'Rejected' ? 'destructive' : 'warning'} className="mt-1">
                                                                                {record.earlyGoStatus} ({format12h(record.earlyGoTime)})
                                                                            </Badge>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Early Go Button */}
                                                                {record.date === todayPKT && !record.checkOut && (!record.earlyGoStatus || record.earlyGoStatus === 'None') && (
                                                                    <div className="pt-3 border-t border-border/40 text-right">
                                                                        <button 
                                                                            onClick={() => setEarlyGoModal(true)}
                                                                            className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md text-sm font-medium transition-colors"
                                                                        >
                                                                            Request Early Go
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Early Go Modal */}
            {earlyGoModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border shadow-lg rounded-xl max-w-sm w-full p-6 animate-in zoom-in-95">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Request Early Go</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Specify the time you wish to check out early. This will be sent to the admin for approval.
                        </p>
                        <Input 
                            type="time" 
                            value={earlyGoTime}
                            onChange={(e) => setEarlyGoTime(e.target.value)}
                            min={minTimeStr}
                            max={maxTimeStr}
                            className="mb-6 w-full"
                        />
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setEarlyGoModal(false)}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleEarlyGoRequest}
                                disabled={submittingEarlyGo || !earlyGoTime}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
                            >
                                {submittingEarlyGo ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyAttendance;
