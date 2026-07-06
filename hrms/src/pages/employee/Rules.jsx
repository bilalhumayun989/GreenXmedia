import React from 'react';
import { BookOpen, Clock, AlertTriangle, CheckCircle2, XCircle, Calendar, DollarSign, Shield, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';

const RuleSection = ({ icon: Icon, title, color, children }) => (
    <Card className={`border-l-4 ${color} shadow-sm`}>
        <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
                <Icon size={20} className="text-primary" />
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <ul className="space-y-2.5">
                {children}
            </ul>
        </CardContent>
    </Card>
);

const Rule = ({ icon: Icon, text, color = 'text-muted-foreground', iconColor = 'text-primary' }) => (
    <li className="flex items-start gap-2.5">
        <Icon size={16} className={`mt-0.5 shrink-0 ${iconColor}`} />
        <span className={`text-sm leading-relaxed ${color}`}>{text}</span>
    </li>
);

const Rules = () => {
    return (
        <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <BookOpen className="text-primary" /> Company Rules & Policies
                </h1>
                <p className="text-muted-foreground mt-1">Please read and follow all company rules and terms carefully.</p>
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
                <Info size={20} className="text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">
                    These rules apply to all employees. Violation of any rule may result in salary deductions, warnings, or termination depending on the severity. If you have any questions, please contact your admin.
                </p>
            </div>

            <div className="grid gap-5">

                <RuleSection icon={Clock} title="Shift Timings" color="border-blue-400">
                    <Rule icon={CheckCircle2} iconColor="text-emerald-500" text="Standard shift hours are 9:00 AM to 5:00 PM (as configured by your admin)." />
                    <Rule icon={CheckCircle2} iconColor="text-emerald-500" text="A grace period of 15 minutes is allowed for late arrivals. Arriving within grace time is considered On Time." />
                    <Rule icon={AlertTriangle} iconColor="text-amber-500" text="Arriving after the grace period will be marked as Late. Late attendance results in a half-day salary deduction." />
                    <Rule icon={XCircle} iconColor="text-red-500" text="Failing to mark attendance at all will be recorded as Absent. Absent days result in a full-day salary deduction." />
                </RuleSection>

                <RuleSection icon={Calendar} title="Attendance & Leaves" color="border-emerald-400">
                    <Rule icon={CheckCircle2} iconColor="text-emerald-500" text="Employees are entitled to 2 paid leaves per month by default." />
                    <Rule icon={CheckCircle2} iconColor="text-emerald-500" text="Leave must be applied in advance through the 'Apply Leave' section with a proper reason." />
                    <Rule icon={AlertTriangle} iconColor="text-amber-500" text="Absences without an approved leave application will NOT be excused and will count as an unpaid deduction." />
                    <Rule icon={AlertTriangle} iconColor="text-amber-500" text="If a leave is approved, your leave quota increases accordingly — it does not reduce your salary." />
                    <Rule icon={XCircle} iconColor="text-red-500" text="Leaves taken beyond the approved quota will be treated as unpaid absences." />
                    <Rule icon={Info} iconColor="text-blue-500" text="Friday is the weekly holiday. Work is not expected on that day." />
                </RuleSection>

                <RuleSection icon={DollarSign} title="Salary & Payroll" color="border-violet-400">
                    <Rule icon={CheckCircle2} iconColor="text-emerald-500" text="Salary is calculated based on a 30-day month, regardless of whether the month has 28, 29, 31 days." />
                    <Rule icon={CheckCircle2} iconColor="text-emerald-500" text="Daily rate = Monthly Salary ÷ 30. This applies uniformly for all days including public holidays." />
                    <Rule icon={AlertTriangle} iconColor="text-amber-500" text="Late arrival penalty: You will receive 0.5× (half) of the daily rate for that day." />
                    <Rule icon={XCircle} iconColor="text-red-500" text="Absent penalty: You will receive 0× (zero) salary for that day — a full day is deducted." />
                    <Rule icon={Info} iconColor="text-blue-500" text="Payroll is generated automatically on the 1st of each month for the previous month's attendance." />
                    <Rule icon={Info} iconColor="text-blue-500" text="You can view your payroll details in the 'Salary' section of this portal." />
                </RuleSection>

                <RuleSection icon={Shield} title="Code of Conduct" color="border-rose-400">
                    <Rule icon={CheckCircle2} iconColor="text-emerald-500" text="Maintain professional behavior at all times within the office premises." />
                    <Rule icon={CheckCircle2} iconColor="text-emerald-500" text="Respect colleagues, management, and company property." />
                    <Rule icon={AlertTriangle} iconColor="text-amber-500" text="Any dispute or issue should be reported to the admin/HR immediately." />
                    <Rule icon={XCircle} iconColor="text-red-500" text="Misconduct, dishonesty, or repeated policy violations may lead to disciplinary action or termination." />
                    <Rule icon={Info} iconColor="text-blue-500" text="If you face a genuine issue affecting your attendance, communicate with your admin to have your record corrected." />
                </RuleSection>

            </div>

            <div className="p-4 rounded-xl bg-muted/50 border border-border/40 text-center">
                <p className="text-xs text-muted-foreground">
                    Last updated: July 2026 &nbsp;•&nbsp; These policies are subject to change. Management decisions are final.
                </p>
            </div>
        </div>
    );
};

export default Rules;
