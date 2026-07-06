import { API_BASE_URL } from '../../config';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Loader2, DollarSign, Calendar, Download, Trash2, Settings2, ChevronDown, ChevronUp, User } from 'lucide-react';
import { usePermissions } from '../../context/PermissionsContext';

const PayrollManagement = () => {
    const [loading, setLoading] = useState(false);
    const [generatingCycle, setGeneratingCycle] = useState(null);
    const [payrolls, setPayrolls] = useState([]);
    const [expandedPayrollId, setExpandedPayrollId] = useState(null);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showDailyBreakdownId, setShowDailyBreakdownId] = useState(null);
    const { can } = usePermissions();

    // Default to current month YYYY-MM
    const getCurrentMonth = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('All');
    const [selectedDepartment, setSelectedDepartment] = useState('All');
    const [employees, setEmployees] = useState([]);
    
    const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

    useEffect(() => {
        fetchPayrolls();
        fetchEmployees();
    }, [selectedMonth]);

    const fetchEmployees = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                headers: { 'X-Role-Context': 'Admin' },
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                setEmployees(Array.isArray(data) ? data.filter(u => u.role !== 'Admin') : []);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchPayrolls = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/payroll?month=${selectedMonth}`, {
                headers: { 'X-Role-Context': 'Admin' },
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                setPayrolls(data);
            }
        } catch (error) {
            console.error('Error fetching payrolls:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePayroll = async (cycle, isCustom = false) => {
        if (isCustom && (!customStart || !customEnd)) {
            alert('Please select both start and end dates');
            return;
        }

        setGeneratingCycle(cycle || 'custom');
        try {
            const response = await fetch(`${API_BASE_URL}/payroll/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role-Context': 'Admin'
                },
                credentials: 'include',
                body: JSON.stringify({ 
                    month: selectedMonth, 
                    userId: selectedEmployeeId !== 'All' ? selectedEmployeeId : undefined,
                    cycle: cycle,
                    customStart: isCustom ? customStart : undefined,
                    customEnd: isCustom ? customEnd : undefined
                })
            });

            if (response.ok) {
                // Refresh list
                fetchPayrolls();
                alert(isCustom ? 'Custom range payroll generated!' : `Payroll generated successfully for cycle till ${cycle}th!`);
            } else {
                const data = await response.json();
                alert(data.message || 'Failed to generate payroll');
            }
        } catch (error) {
            console.error('Error generating payroll:', error);
            alert('Error connecting to server');
        } finally {
            setGeneratingCycle(null);
        }
    };

    const markAsPaid = async (payrollId) => {
        if (!window.confirm('Confirm Payment: Are you sure you want to mark this payroll as PAID? This action will finalize the record.')) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/payroll/${payrollId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role-Context': 'Admin'
                },
                body: JSON.stringify({ status: 'Paid' }),
                credentials: 'include'
            });

            if (response.ok) {
                fetchPayrolls();
                alert('Success: Payroll has been marked as paid.');
            }
        } catch (error) {
            console.error('Error updating payroll status:', error);
            alert('Error: Could not update payment status.');
        }
    };

    const handleDeletePayroll = async (payrollId) => {
        if (!window.confirm('Are you sure you want to delete this payroll record?')) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/payroll/${payrollId}`, {
                method: 'DELETE',
                headers: {
                    'X-Role-Context': 'Admin'
                },
                credentials: 'include'
            });

            if (response.ok) {
                fetchPayrolls();
            } else {
                alert('Failed to delete payroll');
            }
        } catch (error) {
            console.error('Error deleting payroll:', error);
        }
    };

    const handleDeleteAllPayrolls = async () => {
        if (!window.confirm('CRITICAL: Are you sure you want to delete ALL payroll records? This action cannot be undone.')) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/payroll/delete-all`, {
                method: 'DELETE',
                headers: {
                    'X-Role-Context': 'Admin'
                },
                credentials: 'include'
            });

            if (response.ok) {
                fetchPayrolls();
                alert('All payroll records deleted successfully');
            } else {
                alert('Failed to delete all payrolls');
            }
        } catch (error) {
            console.error('Error deleting all payrolls:', error);
        }
    };

    const handleTestCron = async (date) => {
        if (!window.confirm(`Are you sure you want to trigger the automated email cron for date ${date}? This will send actual emails to admins.`)) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/payroll/test-cron`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Role-Context': 'Admin'
                },
                body: JSON.stringify({ date }),
                credentials: 'include'
            });

            if (response.ok) {
                alert(`Test cron for date ${date} triggered successfully and emails sent!`);
            } else {
                const data = await response.json();
                alert(data.message || data.error || 'Failed to trigger cron');
            }
        } catch (error) {
            console.error('Error triggering cron:', error);
            alert('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const filteredPayrolls = payrolls.filter(p => {
        const matchEmployee = selectedEmployeeId === 'All' || p.userId?._id === selectedEmployeeId;
        const matchDepartment = selectedDepartment === 'All' || p.userId?.department === selectedDepartment;
        return matchEmployee && matchDepartment;
    });

    const toggleExpand = (id) => {
        if (expandedPayrollId === id) {
            setExpandedPayrollId(null);
        } else {
            setExpandedPayrollId(id);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Payroll Management</h1>
                    <p className="text-muted-foreground mt-1">Manage monthly salaries, attendance reconciliation, and automated deductions.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-card rounded-xl border border-border/40 shadow-sm overflow-x-auto p-2">
                    {/* Period */}
                    <div className="flex items-center gap-3 px-3 py-2 border-b sm:border-b-0 sm:border-r border-border/40 hover:bg-muted/50 transition-colors rounded-lg">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Period</span>
                            <Input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="h-7 border-none bg-transparent p-0 focus-visible:ring-0 font-semibold text-foreground text-sm shadow-none w-full"
                            />
                        </div>
                    </div>

                    {/* Department */}
                    <div className="flex items-center gap-3 px-3 py-2 border-b sm:border-b-0 sm:border-r border-border/40 hover:bg-muted/50 transition-colors rounded-lg">
                        <div className="bg-purple-50 p-2 rounded-lg">
                            <Settings2 className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex flex-col flex-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Department</span>
                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-semibold text-foreground cursor-pointer w-full h-7"
                            >
                                <option value="All">All Departments</option>
                                {departments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Employee Filter */}
                    <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors rounded-lg">
                        <div className="bg-emerald-50 p-2 rounded-lg">
                            <User className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex flex-col flex-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Employee</span>
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-semibold text-foreground cursor-pointer w-full h-7"
                            >
                                <option value="All">All Staff Members</option>
                                {employees
                                    .filter(emp => selectedDepartment === 'All' || emp.department === selectedDepartment)
                                    .map(emp => (
                                        <option key={emp._id} value={emp._id}>{emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}</option>
                                    ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>


            {/* Manual Generate Section */}
            {can('payroll', 'edit') && (
                <Card className="border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="bg-emerald-500 p-2.5 rounded-xl shadow-sm">
                                    <DollarSign className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground text-base">Manual Payroll Generation</h3>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Generate payroll for <span className="font-semibold text-emerald-700">{selectedMonth}</span>
                                        {selectedEmployeeId !== 'All' && <span> for {employees.find(e => e._id === selectedEmployeeId)?.name}</span>}
                                    </p>
                                </div>
                            </div>
                            <Button
                                onClick={() => handleGeneratePayroll(null, false)}
                                disabled={generatingCycle !== null}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 h-11 rounded-xl shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                            >
                                {generatingCycle !== null ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <DollarSign className="mr-2 h-4 w-4" />
                                        Generate Payroll
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Info Banner */}
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/50 text-sm flex items-start gap-3">
                <Calendar className="w-5 h-5 mt-0.5 shrink-0 text-blue-500" />
                <div>
                    <p className="font-semibold text-blue-800">Payroll is auto-generated on the 1st of each month.</p>
                    <p className="text-blue-700 mt-0.5">Daily Rate = Monthly Salary ÷ 30. Late = half-day pay. Absent = no pay. Use the filters above to review records and mark salaries as paid.</p>
                </div>
                {can('payroll', 'edit') && payrolls.length > 0 && (
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteAllPayrolls}
                        className="ml-auto shrink-0 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-500 transition-all h-9 px-4 font-semibold text-xs rounded-lg"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear All Records
                    </Button>
                )}
            </div>

            <Card className="border-border/40 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle>Payroll Records for {selectedMonth}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="rounded-md border border-border/40 overflow-x-auto">
                            <table className="w-full text-sm text-left whitespace-nowrap min-w-[1000px]">
                                <thead className="bg-muted/50 text-muted-foreground font-medium">
                                    <tr>
                                        <th className="h-10 px-4 py-3 align-middle">Employee</th>
                                        <th className="h-10 px-4 py-3 align-middle">Department</th>
                                        <th className="h-10 px-4 py-3 align-middle">Generated At</th>
                                        <th className="h-10 px-4 py-3 align-middle">Base Salary</th>
                                        <th className="h-10 px-4 py-3 align-middle text-center">Lates</th>
                                        <th className="h-10 px-4 py-3 align-middle text-center">Absents</th>
                                        <th className="h-10 px-4 py-3 align-middle text-center">Overtime</th>
                                        <th className="h-10 px-4 py-3 align-middle text-right">Deductions</th>
                                        <th className="h-10 px-4 py-3 align-middle text-right">Net Salary</th>

                                        <th className="h-10 px-4 py-3 align-middle text-center">Status</th>
                                        <th className="h-10 px-4 py-3 align-middle text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40 bg-card">
                                    {filteredPayrolls.length === 0 ? (
                                        <tr>
                                            <td colSpan="11" className="p-8 text-center text-muted-foreground">
                                                No payroll records found for this selection.
                                                <br />
                                                Click "Generate Payroll" to calculate.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPayrolls.map((payroll) => (
                                            <React.Fragment key={payroll._id}>
                                                <tr 
                                                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${payroll.userId?.status === 'Deleted' ? 'line-through opacity-50 bg-muted/20' : ''}`}
                                                    onClick={() => toggleExpand(payroll._id)}
                                                    title="Click to view calculation breakdown"
                                                >
                                                    <td className="p-4 align-middle font-medium">
                                                        {payroll.userId?.name || 'Unknown'} {payroll.userId?.status === 'Deleted' && <span className="text-rose-500 text-xs ml-1">(Deleted)</span>}
                                                        <div className="text-xs text-muted-foreground font-normal">{payroll.userId?.role}</div>
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        <Badge variant="secondary" className="font-normal">{payroll.userId?.department}</Badge>
                                                    </td>
                                                    <td className="p-4 align-middle text-xs text-muted-foreground whitespace-nowrap">
                                                        {new Date(payroll.createdAt || new Date()).toLocaleString('en-US', {
                                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        {formatCurrency(payroll.salary)}
                                                    </td>
                                                    <td className="p-4 align-middle text-center">
                                                        {payroll.totalLates}
                                                        {payroll.deductions?.lateDeduction > 0 &&
                                                            <span className="block text-xs text-rose-500">(-{formatCurrency(payroll.deductions.lateDeduction)})</span>
                                                        }
                                                    </td>
                                                    <td className="p-4 align-middle text-center">
                                                        {payroll.totalAbsents}
                                                        {payroll.deductions?.absentDeduction > 0 &&
                                                            <span className="block text-xs text-rose-500">(-{formatCurrency(payroll.deductions.absentDeduction)})</span>
                                                        }
                                                    </td>
                                                    <td className="p-4 align-middle text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-medium text-blue-600">
                                                                {Math.floor((payroll.overtime?.minutes || 0) / 60)}h {(payroll.overtime?.minutes || 0) % 60}m
                                                            </span>
                                                            {payroll.overtime?.pay > 0 && (
                                                                <span className="text-xs text-emerald-600">+{formatCurrency(payroll.overtime.pay)}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 align-middle text-right text-rose-600 font-medium">
                                                        {formatCurrency(payroll.deductions?.totalDeduction || 0)}
                                                    </td>

                                                    <td className="p-4 align-middle text-right font-bold text-emerald-600">
                                                        {formatCurrency(payroll.netSalary)}
                                                    </td>
                                                    <td className="p-4 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Badge variant={payroll.status === 'Paid' ? 'success' : 'outline'} className={payroll.status === 'Pending' ? 'text-amber-600 border-amber-200 bg-amber-50' : ''}>
                                                                {payroll.status}
                                                            </Badge>
                                                            {payroll.status === 'Paid' && payroll.paidAt && (
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    {new Date(payroll.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 align-middle text-right flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                        {payroll.status === 'Pending' && can('payroll', 'edit') && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 text-xs hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                                                                onClick={() => markAsPaid(payroll._id)}
                                                            >
                                                                Mark as Paid
                                                            </Button>
                                                        )}
                                                        {can('payroll', 'edit') && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                                                onClick={() => handleDeletePayroll(payroll._id)}
                                                                title="Delete Payroll"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                                {expandedPayrollId === payroll._id && (
                                                    <tr className="bg-muted/10 border-b border-muted">
                                                        <td colSpan="11" className="p-6">
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                                {/* Basis */}
                                                                <div className="space-y-3 bg-white p-4 rounded-md shadow-sm border border-border/50">
                                                                    <h4 className="font-semibold text-sm border-b pb-2 flex items-center gap-2">
                                                                        <Calendar className="h-4 w-4 text-blue-500" />
                                                                        Calculation Basis
                                                                    </h4>
                                                                    <div className="space-y-1">
                                                                        {payroll.calculationStartDate && payroll.calculationEndDate && (
                                                                            <div className="flex justify-between text-sm bg-blue-50/50 p-1.5 rounded-sm border border-blue-100 mb-2">
                                                                                <span className="text-blue-700 font-medium text-[13px]">Calculation Period:</span>
                                                                                <span className="font-bold text-blue-800 text-[13px]">
                                                                                    {new Date(payroll.calculationStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} 
                                                                                    {' - '} 
                                                                                    {new Date(payroll.calculationEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        <div className="flex justify-between text-sm">
                                                                            <span className="text-muted-foreground">Total Days in Month:</span>
                                                                            <span className="font-medium">{payroll.daysInMonth || 30} Days</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm">
                                                                            <span className="text-muted-foreground">Days Elapsed (Payable):</span>
                                                                            <span className="font-medium text-blue-600">{payroll.payableDays || payroll.totalDays} Days</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm">
                                                                            <span className="text-muted-foreground">Off Days Passed (Paid):</span>
                                                                            <span className="font-medium">{payroll.offDays || 0} Days</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm font-medium border-t pt-2 mt-2">
                                                                            <span>Pro-Rated Base Salary:</span>
                                                                            <span>{formatCurrency((payroll.salary / (payroll.daysInMonth || 30)) * (payroll.payableDays || payroll.totalDays))}</span>
                                                                        </div>
                                                                        <p className="text-[10px] text-muted-foreground mt-1">
                                                                            *Salary is calculated up to the date generated, dividing monthly fixed salary by exact calendar days.
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Summary */}
                                                                <div className="space-y-3 bg-white p-4 rounded-md shadow-sm border border-border/50 overflow-hidden flex flex-col">
                                                                    <h4 className="font-semibold text-sm border-b pb-2">Working Summary</h4>
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between text-sm">
                                                                            <span className="text-muted-foreground">Days Present:</span>
                                                                            <span className="font-medium">{payroll.presentDays} Days</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm">
                                                                            <span className="text-muted-foreground">Days Absent:</span>
                                                                            <span className="font-medium text-rose-500">{payroll.totalAbsents} Days</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm">
                                                                            <span className="text-muted-foreground">Short Hours:</span>
                                                                            <span className="font-medium text-rose-500">
                                                                                {Math.floor((payroll.shortHours?.minutes || 0) / 60)}h {(payroll.shortHours?.minutes || 0) % 60}m
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm">
                                                                            <span className="text-muted-foreground">Overtime:</span>
                                                                            <span className="font-medium text-emerald-500">
                                                                                {Math.floor((payroll.overtime?.minutes || 0) / 60)}h {(payroll.overtime?.minutes || 0) % 60}m
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {payroll.dailyBreakdown && payroll.dailyBreakdown.length > 0 && (
                                                                        <div className="mt-4 pt-4 border-t border-slate-100 flex-1">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => setShowDailyBreakdownId(showDailyBreakdownId === payroll._id ? null : payroll._id)}
                                                                                className="w-full text-[10px] font-black text-blue-600 hover:text-blue-700 hover:bg-blue-50 uppercase tracking-widest h-8 mb-2 border border-blue-100/50"
                                                                            >
                                                                                {showDailyBreakdownId === payroll._id ? 'Hide Detailed Audit' : 'View Detailed Breakdown'}
                                                                                {showDailyBreakdownId === payroll._id ? <ChevronUp className="ml-2 h-3 w-3" /> : <ChevronDown className="ml-2 h-3 w-3" />}
                                                                            </Button>

                                                                            {showDailyBreakdownId === payroll._id && (
                                                                                <div className="max-h-[220px] overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 animate-in fade-in slide-in-from-top-1">
                                                                                    <table className="w-full text-left border-collapse">
                                                                                        <thead className="sticky top-0 bg-white shadow-sm z-10">
                                                                                            <tr>
                                                                                                <th className="p-1.5 text-[9px] font-bold text-slate-400 uppercase">Date</th>
                                                                                                <th className="p-1.5 text-[9px] font-bold text-slate-400 uppercase">Work</th>
                                                                                                <th className="p-1.5 text-[9px] font-bold text-slate-400 uppercase text-right">Daily Rate</th>
                                                                                                <th className="p-1.5 text-[9px] font-bold text-slate-400 uppercase text-right">Deduction</th>
                                                                                                <th className="p-1.5 text-[9px] font-bold text-slate-400 uppercase text-right">Earned</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody>
                                                                                            {payroll.dailyBreakdown.map((day, idx) => {
                                                                                                const isAbsent = day.status.includes('Absent') || day.status.includes('No Punch') || day.status.includes('Missed');
                                                                                                const isLate = day.status.includes('Late') || day.status.includes('Short Hours');
                                                                                                const isOff = day.status.includes('Off');
                                                                                                const isLeaveUnpaid = day.status.includes('Unpaid');

                                                                                                let rowBg = '';
                                                                                                if (isAbsent || isLeaveUnpaid) rowBg = 'bg-rose-50/60';
                                                                                                else if (isLate) rowBg = 'bg-amber-50/60';
                                                                                                else if (isOff) rowBg = 'bg-slate-50/80';

                                                                                                let deductionLabel = '';
                                                                                                if (isAbsent || isLeaveUnpaid) deductionLabel = 'Full day';
                                                                                                else if (isLate) deductionLabel = '50% late';

                                                                                                return (
                                                                                                    <tr key={idx} className={`border-t border-slate-100 hover:brightness-95 transition-colors ${rowBg}`}>
                                                                                                        <td className="p-1.5 text-[10px] font-medium text-slate-600">
                                                                                                            {new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                                                                            <span className={`ml-1 text-[8px] px-1 py-0.5 rounded-full font-semibold ${
                                                                                                                isAbsent ? 'bg-rose-100 text-rose-600' :
                                                                                                                isLate ? 'bg-amber-100 text-amber-700' :
                                                                                                                isOff ? 'bg-slate-200 text-slate-500' :
                                                                                                                'bg-emerald-100 text-emerald-600'
                                                                                                            }`}>
                                                                                                                {day.status}
                                                                                                            </span>
                                                                                                        </td>
                                                                                                        <td className="p-1.5 text-[10px] font-bold text-slate-700">
                                                                                                            {day.workMinutes > 0 ? `${Math.floor(day.workMinutes / 60)}h ${day.workMinutes % 60}m` : '—'}
                                                                                                        </td>
                                                                                                        <td className="p-1.5 text-[10px] font-semibold text-right text-slate-500">
                                                                                                            {formatCurrency(day.baseDaySalary || 0)}
                                                                                                        </td>
                                                                                                        <td className="p-1.5 text-[10px] font-black text-right text-rose-500">
                                                                                                            {day.deduction > 0
                                                                                                                ? <span title={deductionLabel}>-{formatCurrency(day.deduction)}</span>
                                                                                                                : <span className="text-slate-300">—</span>
                                                                                                            }
                                                                                                        </td>
                                                                                                        <td className="p-1.5 text-[10px] font-black text-right text-slate-900">
                                                                                                            {formatCurrency(day.earnedSalary || 0)}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })}
                                                                                        </tbody>
                                                                                        <tfoot className="sticky bottom-0 bg-slate-100/90 backdrop-blur-sm border-t-2 border-slate-300">
                                                                                            <tr>
                                                                                                <th className="p-1.5 text-[9px] font-black text-slate-700 uppercase" colSpan="2">TOTAL</th>
                                                                                                <th className="p-1.5 text-[10px] font-black text-slate-500 text-right">
                                                                                                    {formatCurrency(payroll.dailyBreakdown.reduce((acc, d) => acc + (d.baseDaySalary || 0), 0))}
                                                                                                </th>
                                                                                                <th className="p-1.5 text-[10px] font-black text-rose-600 text-right">
                                                                                                    -{formatCurrency(payroll.dailyBreakdown.reduce((acc, d) => acc + (d.deduction || 0), 0))}
                                                                                                </th>
                                                                                                <th className="p-1.5 text-[10px] font-black text-emerald-700 text-right">
                                                                                                    {formatCurrency(payroll.dailyBreakdown.reduce((acc, d) => acc + (d.earnedSalary || 0), 0))}
                                                                                                </th>
                                                                                            </tr>
                                                                                        </tfoot>
                                                                                    </table>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Financials */}
                                                                <div className="space-y-3 bg-white p-4 rounded-md shadow-sm border border-border/50">
                                                                    <h4 className="font-semibold text-sm border-b pb-2 flex items-center gap-2">
                                                                        <DollarSign className="h-4 w-4 text-emerald-500" />
                                                                        Financial Breakdown
                                                                    </h4>
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between text-sm text-emerald-600">
                                                                            <span>Overtime Earned:</span>
                                                                            <span>+{formatCurrency(payroll.overtime?.pay || 0)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm text-rose-500">
                                                                            <span>Absent Penalty:</span>
                                                                            <span>-{formatCurrency(payroll.deductions?.absentDeduction || 0)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm text-rose-500">
                                                                            <span>Late Penalty:</span>
                                                                            <span>-{formatCurrency(payroll.deductions?.lateDeduction || 0)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm text-rose-500">
                                                                            <span>Short Hours Penalty:</span>
                                                                            <span>-{formatCurrency(payroll.shortHours?.pay || 0)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                                                                            <span>Final Net Salary:</span>
                                                                            <span className="text-emerald-600">{formatCurrency(payroll.netSalary)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
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
        </div>
    );
};

export default PayrollManagement;

