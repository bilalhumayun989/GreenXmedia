import { API_BASE_URL } from '../../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Wallet, Calendar, TrendingDown, TrendingUp, ChevronDown, ChevronUp, Clock } from 'lucide-react';

const EmployeeSalary = () => {
    const { employeeUser, adminUser } = useAuth();
    const user = employeeUser || adminUser;
    const [payrolls, setPayrolls] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        fetchMyPayrolls();
    }, []);

    const fetchMyPayrolls = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/my`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setPayrolls(data);
            }
        } catch (error) {
            console.error('Error fetching payrolls:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount) =>
        new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(amount || 0);

    const getStatusBadge = (status) => {
        if (status === 'Paid') return <Badge variant="success">✓ Paid</Badge>;
        return <Badge className="bg-amber-50 text-amber-700 border border-amber-200">⏳ Pending</Badge>;
    };

    if (isLoading) return (
        <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
        </div>
    );

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Wallet className="text-primary" /> My Payroll
                </h1>
                <p className="text-muted-foreground mt-1">View your monthly salary statements and payment history.</p>
            </div>

            {/* Info Banner - Always visible */}
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm">
                <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-blue-900 mb-1">How Payroll Works</h3>
                            <div className="text-sm text-blue-800 space-y-1">
                                <p>• Payroll is <strong>auto-generated on the 1st of each month</strong></p>
                                <p>• <strong>Daily Rate</strong> = Monthly Salary ÷ 30</p>
                                <p>• <strong>Late arrivals</strong> = half-day pay deducted</p>
                                <p>• <strong>Absences</strong> = no pay for that day</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {payrolls.length === 0 ? (
                <div className="text-center py-16 bg-card border border-border/40 rounded-xl shadow-sm">
                    <Wallet size={56} className="mx-auto mb-4 opacity-10" />
                    <h3 className="text-lg font-semibold text-foreground">No Payroll Records Yet</h3>
                    <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">Your payroll will be automatically generated on the 1st of each month.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {payrolls.map(payroll => (
                        <Card key={payroll._id} className="border-border/40 shadow-sm overflow-hidden">
                            {/* Header Row */}
                            <div
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 cursor-pointer hover:bg-muted/20 transition-colors gap-4"
                                onClick={() => setExpandedId(expandedId === payroll._id ? null : payroll._id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <Calendar className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground text-lg">
                                            {new Date(payroll.month + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Generated: {new Date(payroll.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 ml-auto">
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Net Salary</p>
                                        <p className="text-xl font-bold text-emerald-600">{formatCurrency(payroll.netSalary)}</p>
                                    </div>
                                    <div>{getStatusBadge(payroll.status)}</div>
                                    <Button variant="ghost" size="icon" className="shrink-0">
                                        {expandedId === payroll._id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </Button>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedId === payroll._id && (
                                <div className="border-t border-border/40 bg-muted/10 animate-in fade-in duration-200">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
                                        <div className="bg-card rounded-lg border border-border/50 p-3 text-center">
                                            <p className="text-xs text-muted-foreground">Base Salary</p>
                                            <p className="font-bold text-foreground mt-1">{formatCurrency(payroll.salary)}</p>
                                        </div>
                                        <div className="bg-card rounded-lg border border-border/50 p-3 text-center">
                                            <p className="text-xs text-muted-foreground">Days Present</p>
                                            <p className="font-bold text-emerald-600 mt-1">{payroll.presentDays || 0}</p>
                                        </div>
                                        <div className="bg-card rounded-lg border border-border/50 p-3 text-center">
                                            <p className="text-xs text-muted-foreground">Late Days</p>
                                            <p className="font-bold text-amber-600 mt-1">{payroll.totalLates || 0}</p>
                                        </div>
                                        <div className="bg-card rounded-lg border border-border/50 p-3 text-center">
                                            <p className="text-xs text-muted-foreground">Absent Days</p>
                                            <p className="font-bold text-red-500 mt-1">{payroll.totalAbsents || 0}</p>
                                        </div>
                                    </div>

                                    {/* Deduction Breakdown */}
                                    <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="bg-card border border-border/50 rounded-lg p-4 space-y-3">
                                            <h4 className="font-semibold text-sm flex items-center gap-2 text-rose-600">
                                                <TrendingDown size={16} /> Deductions
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Late Penalty ({payroll.totalLates} × ½ day)</span>
                                                    <span className="text-rose-500 font-medium">-{formatCurrency(payroll.deductions?.lateDeduction)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Absent Deduction ({payroll.totalAbsents} days)</span>
                                                    <span className="text-rose-500 font-medium">-{formatCurrency(payroll.deductions?.absentDeduction)}</span>
                                                </div>
                                                <div className="flex justify-between font-semibold border-t pt-2">
                                                    <span>Total Deductions</span>
                                                    <span className="text-rose-600">-{formatCurrency(payroll.deductions?.totalDeduction)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-card border border-emerald-200 rounded-lg p-4 space-y-3">
                                            <h4 className="font-semibold text-sm flex items-center gap-2 text-emerald-600">
                                                <TrendingUp size={16} /> Final Salary
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Base Salary</span>
                                                    <span className="font-medium">{formatCurrency(payroll.salary)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Total Deductions</span>
                                                    <span className="text-rose-500 font-medium">-{formatCurrency(payroll.deductions?.totalDeduction)}</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-base border-t pt-2">
                                                    <span>Net Payable</span>
                                                    <span className="text-emerald-600">{formatCurrency(payroll.netSalary)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Daily Breakdown if available */}
                                    {payroll.dailyBreakdown && payroll.dailyBreakdown.length > 0 && (
                                        <div className="px-5 pb-5">
                                            <h4 className="font-semibold text-sm mb-3 text-foreground">Daily Breakdown</h4>
                                            <div className="max-h-64 overflow-y-auto rounded-lg border border-border/50">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-muted/50 sticky top-0">
                                                        <tr>
                                                            <th className="px-3 py-2 font-semibold text-muted-foreground">Date</th>
                                                            <th className="px-3 py-2 font-semibold text-muted-foreground">Status</th>
                                                            <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Day Earned</th>
                                                            <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Deduction</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/40">
                                                        {payroll.dailyBreakdown.map((day, i) => (
                                                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                                                                <td className="px-3 py-2">
                                                                    {new Date(day.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' })}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                                        day.status === 'Present' ? 'bg-emerald-100 text-emerald-700' :
                                                                        day.status === 'Late' ? 'bg-amber-100 text-amber-700' :
                                                                        day.status === 'Absent' ? 'bg-red-100 text-red-700' :
                                                                        'bg-slate-100 text-slate-500'
                                                                    }`}>
                                                                        {day.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-medium text-emerald-600">
                                                                    {formatCurrency(day.dayEarned || day.baseDaySalary || 0)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-medium text-rose-500">
                                                                    {day.deduction > 0 ? `-${formatCurrency(day.deduction)}` : '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EmployeeSalary;
