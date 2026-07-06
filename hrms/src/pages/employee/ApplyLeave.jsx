import { API_BASE_URL } from '../../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { FileText, Send, Clock, Calendar as CalendarIcon, CheckCircle2, XCircle } from 'lucide-react';

const ApplyLeave = () => {
    const { employeeUser, adminUser } = useAuth();
    const user = employeeUser || adminUser;
    const [reason, setReason] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [leaves, setLeaves] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState({ 
        paidAllowed: 2, 
        paidUsed: 0, 
        paidRemaining: 2,
        unpaidUsed: 0,
        totalUsed: 0,
        month: ''
    });

    useEffect(() => {
        fetchMyLeaves();
        fetchLeaveStats();
    }, []);

    const fetchMyLeaves = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/leaves/my`, {
                headers: {
                    'X-Role-Context': employeeUser ? 'Employee' : 'Admin'
                },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setLeaves(data);
            } else {
                console.error('Failed to fetch leaves:', await res.text());
            }
        } catch (error) {
            console.error('Error fetching leaves:', error);
        }
    };

    const fetchLeaveStats = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/leaves/stats`, {
                headers: {
                    'X-Role-Context': employeeUser ? 'Employee' : 'Admin'
                },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching leave stats:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!reason.trim()) {
            alert('Please provide a reason for your leave');
            return;
        }
        if (!startDate || !endDate) {
            alert('Please select start and end dates for your leave');
            return;
        }
        if (new Date(endDate) < new Date(startDate)) {
            alert('End date cannot be before start date');
            return;
        }
        
        // Calculate number of days (inclusive, accounting for timezone)
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        console.log(`📅 Calculated days: ${startDate} to ${endDate} = ${daysDiff} days`);
        
        setIsLoading(true);
        console.log('📝 Submitting leave application...', { 
            reason, 
            startDate, 
            endDate, 
            days: daysDiff,
            user: user?.name 
        });
        
        try {
            const res = await fetch(`${API_BASE_URL}/leaves/apply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role-Context': employeeUser ? 'Employee' : 'Admin'
                },
                credentials: 'include',
                body: JSON.stringify({ 
                    reason: reason.trim(),
                    startDate,
                    endDate
                })
            });

            console.log('📡 Leave application response:', res.status, res.statusText);

            if (res.ok) {
                const data = await res.json();
                console.log('✅ Leave applied successfully:', data);
                alert(`Leave applied successfully for ${daysDiff} day${daysDiff > 1 ? 's' : ''}! Your manager will review it soon.`);
                setReason('');
                setStartDate('');
                setEndDate('');
                fetchMyLeaves();
                fetchLeaveStats();
            } else {
                const errData = await res.json();
                console.error('❌ Leave application failed:', errData);
                alert(errData.message || 'Failed to apply leave. Please try again.');
            }
        } catch (error) {
            console.error('❌ Error applying leave:', error);
            alert('Network error. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Approved':
                return <Badge variant="success" className="gap-1"><CheckCircle2 size={12} /> Approved</Badge>;
            case 'Rejected':
                return <Badge variant="destructive" className="gap-1"><XCircle size={12} /> Rejected</Badge>;
            default:
                return <Badge variant="warning" className="gap-1"><Clock size={12} /> Pending</Badge>;
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <FileText className="text-primary" /> Apply for Leave
                </h1>
                <p className="text-muted-foreground mt-1">Submit a leave request and view your previous applications.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CalendarIcon className="text-primary" size={20} /> Leave Quota
                        </CardTitle>
                        <CardDescription className="text-xs">
                            {stats.month || 'Current Month'} • Resets monthly
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                            <span className="text-sm font-medium text-emerald-900">Paid Leaves (Monthly)</span>
                            <span className="text-lg font-bold text-emerald-600">{stats.paidAllowed}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-background border border-border/50">
                            <span className="text-sm font-medium text-muted-foreground">Paid Leaves Used</span>
                            <span className="text-lg font-bold text-foreground">{stats.paidUsed}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 border border-blue-200">
                            <span className="text-sm font-medium text-blue-900">Paid Leaves Remaining</span>
                            <span className="text-lg font-bold text-blue-600">{stats.paidRemaining}</span>
                        </div>
                        <div className="border-t border-border/50 pt-3 mt-3">
                            <div className="flex justify-between items-center p-3 rounded-lg bg-amber-50 border border-amber-200">
                                <span className="text-sm font-medium text-amber-900">Unpaid Leaves Used</span>
                                <span className="text-lg font-bold text-amber-600">{stats.unpaidUsed}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-3 rounded-lg bg-background border border-border/50">
                            <span className="text-sm font-medium text-muted-foreground">Total Leaves Taken</span>
                            <span className="text-lg font-bold text-primary">{stats.totalUsed}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                            <p className="font-semibold">⚠️ Important:</p>
                            <p>• First 2 leaves/month are PAID</p>
                            <p>• Additional leaves are UNPAID (salary deducted)</p>
                            <p>• Resets on 1st of each month</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Submit New Application</CardTitle>
                        <CardDescription>Please provide a valid reason for your leave request.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <CalendarIcon size={14} /> Start Date
                                    </label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        required
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <CalendarIcon size={14} /> End Date
                                    </label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        min={startDate || new Date().toISOString().split('T')[0]}
                                        required
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            
                            {startDate && endDate && new Date(endDate) >= new Date(startDate) && (
                                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                                    <p className="font-medium">
                                        📅 Leave Duration: <strong>
                                            {Math.round((new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1} day(s)
                                        </strong>
                                    </p>
                                    <p className="text-xs mt-1 text-blue-600">
                                        From {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} to {new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Reason for Leave</label>
                                <textarea
                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="e.g., I am feeling unwell and need to rest."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={isLoading} className="gap-2">
                                    <Send size={16} /> {isLoading ? 'Submitting...' : 'Submit Application'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>My Leave History</CardTitle>
                </CardHeader>
                <CardContent>
                    {leaves.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText size={48} className="mx-auto mb-3 opacity-20" />
                            <p>No leave applications found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Leave Period</th>
                                        <th className="px-4 py-3 font-medium">Days</th>
                                        <th className="px-4 py-3 font-medium">Type</th>
                                        <th className="px-4 py-3 font-medium">Reason</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium">Admin Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaves.map(leave => {
                                        const start = new Date(leave.startDate + 'T00:00:00');
                                        const end = new Date(leave.endDate + 'T00:00:00');
                                        // Use stored daysCount if available, otherwise calculate (for backward compatibility)
                                        const days = leave.daysCount || Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
                                        
                                        return (
                                            <tr key={leave._id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="text-sm">
                                                        <div className="font-medium">{start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                                        {days > 1 && (
                                                            <div className="text-xs text-muted-foreground">
                                                                to {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="font-semibold text-primary">{days}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {leave.status === 'Approved' ? (
                                                        leave.isPaid ? (
                                                            <Badge variant="success" className="gap-1">
                                                                <CheckCircle2 size={12} /> Paid
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="gap-1 bg-amber-100 text-amber-800 border-amber-300">
                                                                <XCircle size={12} /> Unpaid
                                                            </Badge>
                                                        )
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 max-w-xs truncate" title={leave.reason}>
                                                    {leave.reason}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {getStatusBadge(leave.status)}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground italic max-w-xs truncate" title={leave.adminNote}>
                                                    {leave.adminNote || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ApplyLeave;
