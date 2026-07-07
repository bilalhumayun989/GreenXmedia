import { API_BASE_URL } from '../../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { Mail, User, Lock, Save, Loader2, Building, Wifi, ScanFace, Trash2 } from 'lucide-react';

const AdminSettings = () => {
    const { adminUser: user, checkAuth } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [faceLoading, setFaceLoading] = useState(false);
    const [ipStatus, setIpStatus] = useState(null);
    const [ipLoading, setIpLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        department: '', // Used as Company Name for Admin
        salary: '',
        shiftStart: '09:00',
        shiftEnd: '17:00',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || '',
                email: user.email || '',
                department: user.department || '',
                salary: user.salary || '',
                shiftStart: user.shiftStart || '09:00',
                shiftEnd: user.shiftEnd || '17:00',
            }));
        }
        fetchIpStatus();
    }, [user]);

    const fetchIpStatus = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/manager/ip-status`, {
                headers: { 'X-Role-Context': 'Admin' },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setIpStatus(data);
            }
        } catch (err) {
            console.error('Failed to fetch IP status:', err);
        }
    };

    const handleToggleIpRestriction = async (enabled) => {
        setIpLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/manager/ip-restriction`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Role-Context': 'Admin'
                },
                credentials: 'include',
                body: JSON.stringify({ enabled })
            });

            if (res.ok) {
                const data = await res.json();
                setIpStatus(prev => ({ ...prev, ipRestrictionEnabled: enabled }));
                alert(data.message);
            } else {
                const errData = await res.json();
                alert(errData.message || 'Failed to update IP restriction');
            }
        } catch (err) {
            console.error('Error toggling IP restriction:', err);
            alert('Connection error. Try again.');
        } finally {
            setIpLoading(false);
        }
    };

    const handleRemoveOwnFace = async () => {
        if (!window.confirm('Remove your face data? You will need to re-enroll to use face attendance again.')) return;
        setFaceLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/attendance/enroll-face-self`, {
                method: 'DELETE',
                headers: { 'X-Role-Context': 'Admin' },
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                alert('Face data removed successfully.');
                await checkAuth(); // refresh user context so faceEnrolled updates
            } else {
                alert(data.message || 'Failed to remove face data.');
            }
        } catch (err) {
            alert('Connection error. Try again.');
        } finally {
            setFaceLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
            alert("New passwords don't match!");
            return;
        }

        if (formData.newPassword && !formData.currentPassword) {
            alert("Please enter your current password to change it.");
            return;
        }

        setIsLoading(true);
        try {
            const updateData = {
                name: formData.name,
                email: formData.email,
                department: formData.department,
                salary: Number(formData.salary) || 0,
                shiftStart: formData.shiftStart,
                shiftEnd: formData.shiftEnd
            };

            if (formData.newPassword) {
                updateData.newPassword = formData.newPassword;
                updateData.currentPassword = formData.currentPassword;
            }

            const response = await fetch(`${API_BASE_URL}/users/${user._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                const updatedUser = await response.json();
                alert('Settings updated successfully!');
                setFormData(prev => ({
                    ...prev,
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                }));
                // Optionally refresh user context if exposed
            } else {
                const errorData = await response.json();
                alert(`Failed to update settings: ${errorData.message}`);
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            alert('An error occurred while updating settings.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return <div className="p-10 font-medium text-center">Loading settings...</div>;

    const initials = user.name?.split(' ').map(n => n[0]).join('') || 'A';

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-1">Manage your account information and security.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-5 items-center bg-card p-5 rounded-xl border border-border/40 shadow-sm">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold uppercase shrink-0">
                    {initials}
                </div>
                <div className="text-center md:text-left">
                    <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
                    <p className="text-muted-foreground text-sm">{user.email}</p>
                    <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        Administrator
                    </div>
                </div>
            </div>

            <div className="grid gap-5">
                <Card>
                    <CardHeader>
                        <CardTitle>Account Settings</CardTitle>
                        <CardDescription>Manage your profile information and security.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <User size={16} /> Full Name
                                    </label>
                                    <Input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Admin Name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Mail size={16} /> Email Address
                                    </label>
                                    <Input
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="admin@example.com"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Building size={16} /> Company / Department Name
                                    </label>
                                    <Input
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        placeholder="Company Name"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Monthly Salary</label>
                                    <Input
                                        name="salary"
                                        type="number"
                                        value={formData.salary}
                                        onChange={handleChange}
                                        placeholder="e.g. 100000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Shift Start</label>
                                    <Input
                                        name="shiftStart"
                                        type="time"
                                        value={formData.shiftStart}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Shift End</label>
                                    <Input
                                        name="shiftEnd"
                                        type="time"
                                        value={formData.shiftEnd}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t">
                                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                    <Lock size={18} /> Security
                                </h3>
                                <div className="space-y-4 max-w-2xl">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Current Password</label>
                                        <Input
                                            type="password"
                                            name="currentPassword"
                                            value={formData.currentPassword}
                                            onChange={handleChange}
                                            placeholder="Enter current password to change"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">New Password</label>
                                            <Input
                                                type="password"
                                                name="newPassword"
                                                value={formData.newPassword}
                                                onChange={handleChange}
                                                placeholder="Min. 6 characters"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Confirm New Password</label>
                                            <Input
                                                type="password"
                                                name="confirmPassword"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                                placeholder="Re-enter new password"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                                    {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>IP-Based Attendance</CardTitle>
                        <CardDescription>Restrict attendance marking to the office network only.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                                    <Wifi className="w-5 h-5 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-foreground">Office IP Restriction</p>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {ipStatus?.storedIp 
                                            ? `Current office IP: ${ipStatus.storedIp}`
                                            : 'No office IP set yet. Ask your Manager to configure it first.'
                                        }
                                    </p>
                                    {ipStatus?.officeIpUpdatedAt && (
                                        <p className="text-xs text-muted-foreground">
                                            Last updated: {new Date(ipStatus.officeIpUpdatedAt).toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    )}
                                    <div className={`inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-medium ${
                                        ipStatus?.ipRestrictionEnabled 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}>
                                        {ipStatus?.ipRestrictionEnabled ? 'Enabled — Office IP only' : 'Disabled — Any network allowed'}
                                    </div>
                                </div>
                            </div>
                            <Switch 
                                checked={ipStatus?.ipRestrictionEnabled || false}
                                onCheckedChange={handleToggleIpRestriction}
                                disabled={ipLoading || !ipStatus?.storedIp}
                            />
                        </div>
                        {!ipStatus?.storedIp && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                                <strong>Note:</strong> Before enabling IP restriction, ensure a Manager account has set the office IP from the Manager Dashboard.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ScanFace className="w-5 h-5 text-primary" /> Face Recognition Data
                        </CardTitle>
                        <CardDescription>Manage your enrolled face data used for attendance marking.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                                <div className={`p-2 rounded-lg mt-0.5 ${user?.faceEnrolled ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                                    <ScanFace className={`w-5 h-5 ${user?.faceEnrolled ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-foreground">Face Enrollment Status</p>
                                    <p className="text-sm text-muted-foreground">
                                        {user?.faceEnrolled
                                            ? 'Your face is enrolled and used for attendance recognition.'
                                            : 'No face data enrolled. Visit the Mark Attendance page to enroll.'}
                                    </p>
                                    <div className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                        user?.faceEnrolled
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-muted text-muted-foreground border-border/40'
                                    }`}>
                                        {user?.faceEnrolled ? '✓ Enrolled' : 'Not enrolled'}
                                    </div>
                                </div>
                            </div>
                            {user?.faceEnrolled && (
                                <Button
                                    variant="outline"
                                    disabled={faceLoading}
                                    onClick={handleRemoveOwnFace}
                                    className="shrink-0 text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-400 transition-all font-semibold"
                                >
                                    {faceLoading
                                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        : <Trash2 className="w-4 h-4 mr-2" />
                                    }
                                    Remove Face Data
                                </Button>
                            )}
                        </div>
                        {user?.faceEnrolled && (
                            <p className="mt-3 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 border border-border/30">
                                After removing, your face data is permanently deleted. You will need to re-enroll from the Mark Attendance page before attendance can be marked again.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdminSettings;

