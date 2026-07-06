import { API_BASE_URL } from '../../config';
import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, Users, Filter, CheckSquare, Save, X, Search, Loader2, Calendar, FileText, Check, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';

const DAYS = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
];

const LeaveManagement = () => {
    const [activeTab, setActiveTab] = useState('applications');

    // --- RULES STATE ---
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [department, setDepartment] = useState('');
    const [role, setRole] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkLeaveQuota, setBulkLeaveQuota] = useState('');
    const [bulkExtraRate, setBulkExtraRate] = useState('');
    const [bulkShortHourlyRate, setBulkShortHourlyRate] = useState('');
    const [bulkOffDays, setBulkOffDays] = useState([]);
    const [bulkVacations, setBulkVacations] = useState([]);
    const [message, setMessage] = useState({ text: '', type: '' });

    const departments = useMemo(() => [...new Set(employees.map(e => e.department))].filter(Boolean), [employees]);
    const roles = useMemo(() => [...new Set(employees.map(e => e.role))].filter(Boolean), [employees]);

    // --- APPLICATIONS STATE ---
    const [leaves, setLeaves] = useState([]);
    const [loadingLeaves, setLoadingLeaves] = useState(false);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [adminNote, setAdminNote] = useState('');
    const [adjustedStartDate, setAdjustedStartDate] = useState('');
    const [adjustedEndDate, setAdjustedEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [appSearch, setAppSearch] = useState('');

    useEffect(() => {
        if (activeTab === 'rules') fetchFilteredEmployees();
        if (activeTab === 'applications') fetchLeaves();
    }, [activeTab]);

    const fetchFilteredEmployees = async (overrides = {}) => {
        setLoading(true);
        setMessage({ text: '', type: '' });
        try {
            const res = await fetch(`${API_BASE_URL}/admin-leave/filter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Role-Context': 'Admin' },
                body: JSON.stringify({
                    search: overrides.search !== undefined ? overrides.search : search,
                    department: overrides.department !== undefined ? overrides.department : department,
                    role: overrides.role !== undefined ? overrides.role : role
                }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) { setEmployees(data); setSelectedIds([]); }
            else setMessage({ text: data.message || 'Failed to fetch', type: 'error' });
        } catch { setMessage({ text: 'Network Error', type: 'error' }); }
        setLoading(false);
    };

    const fetchLeaves = async () => {
        setLoadingLeaves(true);
        try {
            const res = await fetch(`${API_BASE_URL}/leaves/all`, {
                headers: { 'X-Role-Context': 'Admin' }, credentials: 'include'
            });
            if (res.ok) { const data = await res.json(); setLeaves(data); }
        } catch (e) { console.error(e); }
        setLoadingLeaves(false);
    };

    const handleUpdateLeaveStatus = async (status) => {
        if (!selectedLeave) return;
        
        // Validation for approval
        if (status === 'Approved') {
            if (!adjustedStartDate || !adjustedEndDate) {
                alert('Please select start and end dates for approved leave');
                return;
            }
            if (new Date(adjustedEndDate) < new Date(adjustedStartDate)) {
                alert('End date cannot be before start date');
                return;
            }
        }
        
        const payload = { status, adminNote };
        
        // Add adjusted dates if approving
        if (status === 'Approved') {
            payload.startDate = adjustedStartDate;
            payload.endDate = adjustedEndDate;
        }
        
        try {
            const res = await fetch(`${API_BASE_URL}/leaves/${selectedLeave._id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Role-Context': 'Admin' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const days = status === 'Approved' 
                    ? Math.ceil((new Date(adjustedEndDate) - new Date(adjustedStartDate)) / (1000 * 60 * 60 * 24)) + 1
                    : 0;
                alert(`Leave ${status.toLowerCase()} successfully${days > 0 ? ` for ${days} day(s)` : ''}`);
                setSelectedLeave(null); 
                setAdminNote(''); 
                setAdjustedStartDate('');
                setAdjustedEndDate('');
                fetchLeaves();
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to update leave');
            }
        } catch (e) { 
            console.error(e); 
            alert('Network error. Please try again.');
        }
    };

    const filteredLeaves = leaves.filter(leave => {
        const matchesSearch = leave.userId?.name?.toLowerCase().includes(appSearch.toLowerCase()) ||
                              leave.userId?.employeeId?.toLowerCase().includes(appSearch.toLowerCase());
        const matchesStatus = statusFilter === 'All' || leave.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Approved': return <Badge variant="success">Approved</Badge>;
            case 'Rejected': return <Badge variant="destructive">Rejected</Badge>;
            default: return <Badge variant="warning">Pending</Badge>;
        }
    };

    const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleSelectAll = () => {
        if (selectedIds.length === employees.length) setSelectedIds([]);
        else setSelectedIds(employees.map(e => e._id));
    };
    const toggleBulkOffDay = (val) => setBulkOffDays(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);

    const addVacationDate = () => {
        const dateInput = document.getElementById('vacation-date-input');
        if (dateInput && dateInput.value) {
            if (!bulkVacations.includes(dateInput.value)) setBulkVacations([...bulkVacations, dateInput.value]);
            dateInput.value = '';
        }
    };
    const removeVacationDate = (dateStr) => setBulkVacations(bulkVacations.filter(d => d !== dateStr));

    const handleBulkUpdate = async () => {
        if (selectedIds.length === 0) { setMessage({ text: 'Select at least one employee', type: 'error' }); return; }
        const payload = { employeeIds: selectedIds };
        if (bulkLeaveQuota !== '') payload.leaveQuota = Number(bulkLeaveQuota);
        if (bulkExtraRate !== '') payload.extraHourlyRate = Number(bulkExtraRate);
        if (bulkShortHourlyRate !== '') payload.shortTimeHourlyRate = Number(bulkShortHourlyRate);
        if (bulkOffDays.length > 0) payload.offDays = bulkOffDays;
        if (bulkVacations.length > 0) payload.vacations = bulkVacations;
        if (Object.keys(payload).length === 1) { setMessage({ text: 'Enter at least one field to update', type: 'error' }); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/admin-leave/bulk-update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Role-Context': 'Admin' },
                body: JSON.stringify(payload), credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: data.message, type: 'success' });
                setBulkLeaveQuota(''); setBulkExtraRate(''); setBulkShortHourlyRate('');
                setBulkOffDays([]); setBulkVacations([]);
                fetchFilteredEmployees();
            } else setMessage({ text: data.message || 'Update failed', type: 'error' });
        } catch { setMessage({ text: 'Network Error', type: 'error' }); }
        setLoading(false);
    };

    const clearFilters = () => {
        setSearch(''); setDepartment(''); setRole('');
        fetchFilteredEmployees({ search: '', department: '', role: '' });
    };

    const handleBulkReset = async () => {
        if (selectedIds.length === 0) { setMessage({ text: 'Select at least one employee', type: 'error' }); return; }
        if (!window.confirm(`Reset rules for ${selectedIds.length} employees to defaults?`)) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/admin-leave/bulk-update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Role-Context': 'Admin' },
                body: JSON.stringify({ employeeIds: selectedIds, leaveQuota: 0, extraHourlyRate: 0, shortTimeHourlyRate: 0, offDays: [5] }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) { setMessage({ text: 'Reset to defaults successfully', type: 'success' }); fetchFilteredEmployees(); }
            else setMessage({ text: data.message || 'Reset failed', type: 'error' });
        } catch { setMessage({ text: 'Network Error', type: 'error' }); }
        setLoading(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header + Tab Switcher */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave Management</h1>
                    <p className="text-muted-foreground mt-1">Manage applications and configure leave rules.</p>
                </div>
                <div className="flex items-center bg-muted/50 p-1 rounded-xl">
                    <Button
                        variant={activeTab === 'applications' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('applications')}
                        className={`rounded-lg transition-all ${activeTab === 'applications' ? 'shadow-md shadow-primary/20' : ''}`}
                    >
                        Applications
                    </Button>
                    <Button
                        variant={activeTab === 'rules' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('rules')}
                        className={`rounded-lg transition-all ${activeTab === 'rules' ? 'shadow-md shadow-primary/20' : ''}`}
                    >
                        Leave Rules
                    </Button>
                </div>
            </div>

            {/* ---- APPLICATIONS TAB ---- */}
            {activeTab === 'applications' && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border/40 shadow-sm">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Employee Name or ID..."
                                className="pl-9"
                                value={appSearch}
                                onChange={(e) => setAppSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
                            {['All', 'Pending', 'Approved', 'Rejected'].map(s => (
                                <Button
                                    key={s}
                                    variant={statusFilter === s ? 'default' : 'outline'}
                                    onClick={() => setStatusFilter(s)}
                                    size="sm"
                                    className="whitespace-nowrap rounded-full"
                                >{s}</Button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Leave Applications</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loadingLeaves ? (
                                    <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary opacity-30" /></div>
                                ) : filteredLeaves.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground">No leave applications found.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-y border-border">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Employee</th>
                                                    <th className="px-4 py-3 font-medium">Leave Period</th>
                                                    <th className="px-4 py-3 font-medium">Reason</th>
                                                    <th className="px-4 py-3 font-medium">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50">
                                                {filteredLeaves.map(leave => (
                                                    <tr
                                                        key={leave._id}
                                                        onClick={() => { 
                                                            setSelectedLeave(leave); 
                                                            setAdminNote(leave.adminNote || ''); 
                                                            setAdjustedStartDate(leave.startDate?.split('T')[0] || '');
                                                            setAdjustedEndDate(leave.endDate?.split('T')[0] || '');
                                                        }}
                                                        className={`cursor-pointer transition-colors hover:bg-muted/30 ${selectedLeave?._id === leave._id ? 'bg-primary/5' : ''}`}
                                                    >
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="font-medium">{leave.userId?.name || 'Unknown'}</div>
                                                            <div className="text-xs text-muted-foreground">{leave.userId?.employeeId || 'N/A'}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="text-sm">
                                                                {new Date(leave.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                {leave.endDate && new Date(leave.endDate + 'T00:00:00').getTime() !== new Date(leave.startDate + 'T00:00:00').getTime() && (
                                                                    <> - {new Date(leave.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {leave.daysCount || Math.round((new Date(leave.endDate + 'T00:00:00') - new Date(leave.startDate + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1} day(s)
                                                                {leave.status === 'Approved' && (
                                                                    <span className={`ml-1 ${leave.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                        • {leave.isPaid ? 'Paid' : 'Unpaid'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 max-w-[150px] truncate" title={leave.reason}>{leave.reason}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(leave.status)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="sticky top-24">
                            <CardHeader className="border-b border-border/40 bg-muted/20">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <MessageSquare size={18} /> Action Panel
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {selectedLeave ? (
                                    <div className="space-y-5">
                                        <div>
                                            <h3 className="font-semibold text-foreground text-lg">{selectedLeave.userId?.name}</h3>
                                            <p className="text-sm text-muted-foreground">{selectedLeave.userId?.employeeId} • {selectedLeave.userId?.department}</p>
                                        </div>
                                        <div className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                                            <div>
                                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Requested Period</p>
                                                <p className="text-sm font-medium">
                                                    {new Date(selectedLeave.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                    {selectedLeave.endDate && new Date(selectedLeave.endDate).getTime() !== new Date(selectedLeave.startDate).getTime() && (
                                                        <> to {new Date(selectedLeave.endDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</>
                                                    )}
                                                </p>
                                                <p className="text-xs text-primary font-semibold mt-1">
                                                    {Math.ceil((new Date(selectedLeave.endDate) - new Date(selectedLeave.startDate)) / (1000 * 60 * 60 * 24)) + 1} day(s) requested
                                                </p>
                                            </div>
                                            <div className="border-t border-border/50 pt-3">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Reason</p>
                                                <p className="text-sm leading-relaxed">{selectedLeave.reason}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Applied: {new Date(selectedLeave.dateApplied).toLocaleString()}</p>
                                        </div>
                                        
                                        {selectedLeave.status === 'Pending' && (
                                            <>
                                                <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                    <p className="text-sm font-semibold text-blue-900">Approve Leave Period</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-blue-900">Start Date</label>
                                                            <Input
                                                                type="date"
                                                                value={adjustedStartDate}
                                                                onChange={(e) => setAdjustedStartDate(e.target.value)}
                                                                className="bg-white"
                                                                required
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-blue-900">End Date</label>
                                                            <Input
                                                                type="date"
                                                                value={adjustedEndDate}
                                                                onChange={(e) => setAdjustedEndDate(e.target.value)}
                                                                min={adjustedStartDate}
                                                                className="bg-white"
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                    {adjustedStartDate && adjustedEndDate && new Date(adjustedEndDate) >= new Date(adjustedStartDate) && (
                                                        <p className="text-xs font-semibold text-blue-700">
                                                            → Approving {Math.ceil((new Date(adjustedEndDate) - new Date(adjustedStartDate)) / (1000 * 60 * 60 * 24)) + 1} day(s) of leave
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        
                                        {selectedLeave.status !== 'Pending' && (
                                            <div className={`p-3 rounded-lg border ${selectedLeave.status === 'Approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Status</p>
                                                <p className={`text-sm font-bold ${selectedLeave.status === 'Approved' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                    {selectedLeave.status}
                                                </p>
                                                {selectedLeave.adminNote && (
                                                    <p className="text-xs mt-2 text-muted-foreground italic">"{selectedLeave.adminNote}"</p>
                                                )}
                                            </div>
                                        )}
                                        
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Admin Note (Optional)</label>
                                            <textarea
                                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                placeholder="Reason for approval/rejection..."
                                                value={adminNote}
                                                onChange={(e) => setAdminNote(e.target.value)}
                                                disabled={selectedLeave.status !== 'Pending'}
                                            />
                                        </div>
                                        
                                        {selectedLeave.status === 'Pending' && (
                                            <div className="flex gap-3 pt-2">
                                                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleUpdateLeaveStatus('Approved')}>
                                                    <Check size={16} className="mr-2" /> Approve
                                                </Button>
                                                <Button variant="destructive" className="w-full" onClick={() => handleUpdateLeaveStatus('Rejected')}>
                                                    <X size={16} className="mr-2" /> Reject
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">
                                        <FileText size={48} className="mx-auto mb-3 opacity-20" />
                                        <p>Select a leave application to review and take action.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* ---- RULES TAB ---- */}
            {activeTab === 'rules' && (
                <div className="space-y-6">
                    {message.text && (
                        <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                            {message.type === 'success' ? <CheckSquare className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                            {message.text}
                        </div>
                    )}

                    {/* Filters */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Filter className="h-5 w-5 text-primary" /> Search & Filter
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Name or ID..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</label>
                                    <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm outline-none" value={department} onChange={e => setDepartment(e.target.value)}>
                                        <option value="">All Departments</option>
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</label>
                                    <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm outline-none" value={role} onChange={e => setRole(e.target.value)}>
                                        <option value="">All Roles</option>
                                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" onClick={clearFilters} disabled={loading}><X className="w-4 h-4 mr-1" /> Clear</Button>
                                <Button onClick={fetchFilteredEmployees} disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Filter className="w-4 h-4 mr-2" />} Filter
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Bulk Update */}
                    {selectedIds.length > 0 && (
                        <Card className="border-primary/30 bg-primary/5 shadow-xl animate-in zoom-in-95 duration-300">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg text-primary">Bulk Update Rules</CardTitle>
                                    <CardDescription>{selectedIds.length} employees selected.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={handleBulkReset} disabled={loading} className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50">
                                        <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Reset to Defaults
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="h-8 text-muted-foreground">
                                        <X className="w-4 h-4 mr-1" /> Clear
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-muted-foreground">Monthly Leave Quota</label>
                                        <Input type="number" placeholder="Default 0" value={bulkLeaveQuota} onChange={e => setBulkLeaveQuota(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-muted-foreground">Extra Hour Pay (Rs)</label>
                                        <Input type="number" placeholder="Standard if empty" value={bulkExtraRate} onChange={e => setBulkExtraRate(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-muted-foreground">Short Time Penalty (Rs/hr)</label>
                                        <Input type="number" placeholder="Standard if empty" value={bulkShortHourlyRate} onChange={e => setBulkShortHourlyRate(e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Weekly Off-Days</label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS.map((day) => (
                                            <button key={day.value} onClick={() => toggleBulkOffDay(day.value)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${bulkOffDays.includes(day.value) ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Specific Vacation Days</label>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <Input type="date" className="w-auto h-9" id="vacation-date-input" />
                                        <Button size="sm" variant="outline" onClick={addVacationDate}>Add Date</Button>
                                    </div>
                                    {bulkVacations.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {bulkVacations.sort().map(date => (
                                                <span key={date} className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-indigo-200">
                                                    {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                    <X className="w-3 h-3 cursor-pointer hover:text-rose-500" onClick={() => removeVacationDate(date)} />
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button size="lg" onClick={handleBulkUpdate} disabled={loading} className="px-10">
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Apply To All Selected
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Employee Table */}
                    <Card className="border-border/50 shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-widest border-b border-border/50">
                                        <th className="px-6 py-4 w-10">
                                            <input type="checkbox" checked={employees.length > 0 && selectedIds.length === employees.length} onChange={toggleSelectAll} className="rounded border-border h-4 w-4" />
                                        </th>
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4">Dept / Role</th>
                                        <th className="px-6 py-4">Leave Quota</th>
                                        <th className="px-6 py-4">Off-Days</th>
                                        <th className="px-6 py-4">Hourly Rates</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {loading && employees.length === 0 ? (
                                        <tr><td colSpan="6" className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary opacity-20" /></td></tr>
                                    ) : employees.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-20">
                                                <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                                                <p className="text-muted-foreground font-medium">No employees found.</p>
                                            </td>
                                        </tr>
                                    ) : employees.map((emp) => (
                                        <tr key={emp._id} className={`group hover:bg-primary/5 transition-all ${selectedIds.includes(emp._id) ? 'bg-primary/5' : ''} ${emp.status === 'Deleted' ? 'line-through opacity-50' : ''}`}>
                                            <td className="px-6 py-4">
                                                <input type="checkbox" checked={selectedIds.includes(emp._id)} onChange={() => toggleSelect(emp._id)} disabled={emp.status === 'Deleted'} className="rounded border-border h-4 w-4" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-foreground text-sm">{emp.name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{emp.employeeId}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded-full">{emp.department}</span>
                                                <div className="text-[10px] text-muted-foreground mt-1">{emp.role}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs border ${emp.leaveQuota > 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-muted text-muted-foreground border-border'}`}>
                                                    {emp.leaveQuota || 0}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">Leaves/mo</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-1 flex-wrap max-w-[150px]">
                                                    {emp.offDays && emp.offDays.length > 0 ? emp.offDays.sort().map(d => (
                                                        <span key={d} className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded-md border border-rose-100">
                                                            {DAYS.find(day => day.value === d)?.label}
                                                        </span>
                                                    )) : <span className="text-[10px] text-muted-foreground italic">None</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-[10px] text-muted-foreground font-bold uppercase">Extra:</span>
                                                        <span className={`text-[11px] font-mono font-bold ${emp.extraHourlyRate > 0 ? 'text-emerald-600' : 'text-muted-foreground opacity-50'}`}>
                                                            {emp.extraHourlyRate > 0 ? `Rs ${emp.extraHourlyRate}/hr` : 'Standard'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-[10px] text-muted-foreground font-bold uppercase">Penalty:</span>
                                                        <span className={`text-[11px] font-mono font-bold ${emp.shortTimeHourlyRate > 0 ? 'text-amber-600' : 'text-muted-foreground opacity-50'}`}>
                                                            {emp.shortTimeHourlyRate > 0 ? `Rs ${emp.shortTimeHourlyRate}/hr` : 'Standard'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default LeaveManagement;
