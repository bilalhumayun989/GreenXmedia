import { API_BASE_URL } from '../../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Briefcase, Mail, Phone, MapPin, Calendar, Award, User, Lock, Save, X, Loader2, Edit } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';

const Profile = () => {
    const { employeeUser, adminUser, checkAuth } = useAuth(); // Assuming checkAuth or similar exists to refresh user, otherwise we fetch manually
    const user = employeeUser || adminUser;
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState({
        attendanceRate: 0 // Placeholder or implement if needed
    });
    const [formData, setFormData] = useState({
        phone: '',
        address: '',
        bio: '',
        password: '',
        confirmPassword: ''
    });

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                phone: user.phone || '',
                address: user.address || '',
                bio: user.bio || '',
            }));
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };



    const calculateShiftStatus = () => {
        return "Active (Flexible)";
    };

    const handleSubmit = async () => {
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
                phone: formData.phone,
                address: formData.address,
                bio: formData.bio
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
                alert('Profile updated successfully!');
                setIsEditing(false);
                setFormData(prev => ({
                    ...prev,
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                }));
                // Ideally refresh auth context here if checkAuth is available
                // window.location.reload(); // Simple way to refresh context if checkAuth isn't exposed
            } else {
                const errorData = await response.json();
                alert(`Failed to update profile: ${errorData.message}`);
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('An error occurred while updating profile.');
        } finally {
            setIsLoading(false);
        }
    };

    const renderEditForm = () => (
        <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number</label>
                    <Input
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+1 (555) 000-0000"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Location / Address</label>
                    <Input
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="City, Country"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Bio / Notes</label>
                <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Write a short bio about yourself..."
                />
            </div>

            <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Lock size={14} /> Change Password (Optional)</h4>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Current Password</label>
                        <Input
                            type="password"
                            name="currentPassword"
                            value={formData.currentPassword || ''}
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
                                value={formData.newPassword || ''}
                                onChange={handleChange}
                                placeholder="Min. 6 characters"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Confirm New Password</label>
                            <Input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword || ''}
                                onChange={handleChange}
                                placeholder="Re-enter new password"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (!user) return <div className="p-10 font-medium text-center">Please login to view profile.</div>;

    const initials = user.name?.split(' ').map(n => n[0]).join('') || 'U';

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10 max-w-7xl mx-auto">
            {/* Profile Header */}
            <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden">
                {/* Cover strip */}
                <div className="h-28 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10" />
                <div className="flex flex-col md:flex-row gap-5 items-start px-6 pb-5 -mt-10 relative z-10">
                    <div className="h-24 w-24 rounded-xl bg-card p-1 shadow-lg shrink-0 border border-border/40">
                        <div className="h-full w-full rounded-lg bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold uppercase">
                            {initials}
                        </div>
                    </div>
                    <div className="flex-1 md:mt-12 w-full">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">{user.name}</h1>
                                <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5 text-sm">
                                    <Briefcase size={14} /> {user.role} · {user.department} Team
                                </p>
                            </div>
                            <Button
                                onClick={() => setIsEditing(true)}
                                className="shadow-sm cursor-pointer"
                            >
                                <Edit size={15} className="mr-2" /> Edit Profile
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
                {/* Left Column: Personal Info */}
                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Personal Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Mail size={16} />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="font-medium">Email</p>
                                    <p className="text-muted-foreground truncate" title={user.email}>{user.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Phone size={16} />
                                </div>
                                <div className="w-full">
                                    <p className="font-medium">Phone</p>
                                    <p className="text-muted-foreground">{user.phone || 'Not set'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <MapPin size={16} />
                                </div>
                                <div className="w-full">
                                    <p className="font-medium">Location</p>
                                    <p className="text-muted-foreground">{user.address || 'Not set'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Calendar size={16} />
                                </div>
                                <div>
                                    <p className="font-medium">Joined</p>
                                    <p className="text-muted-foreground">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Work Info & Stats */}
                <div className="md:col-span-2 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-green-500/5 border-green-500/10">
                            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 mb-3">
                                    <Calendar size={20} />
                                </div>
                                <div className="text-2xl font-bold">Active</div>
                                <div className="text-xs text-muted-foreground font-semibold uppercase mt-1">Status</div>
                            </CardContent>
                        </Card>

                        <Card className="bg-purple-500/5 border-purple-500/10">
                            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 mb-3">
                                    <User size={20} />
                                </div>
                                <div className="text-2xl font-bold">{user.role}</div>
                                <div className="text-xs text-muted-foreground font-semibold uppercase mt-1">Role</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Employment Details</CardTitle>
                            <CardDescription>Official role and compensation information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-muted-foreground">Employee ID</label>
                                    <p className="font-semibold text-lg text-foreground/80">#{user._id?.slice(-6).toUpperCase()}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-muted-foreground">Employment Status</label>
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                        </span>
                                        <span className="font-semibold">{calculateShiftStatus()}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-muted-foreground">Department</label>
                                    <p className="font-semibold">{user.department}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-muted-foreground">Weekly Off Day</label>
                                    <p className="font-semibold">
                                        {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][Array.isArray(user.offDays) && user.offDays.length > 0 ? user.offDays[0] : 0]}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border/40">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Bio / Notes</label>
                                    <p className="text-sm text-foreground/80 italic">
                                        {user.bio || "No bio added yet."}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Modal
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                title="Edit Profile"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                            Save Changes
                        </Button>
                    </>
                }
            >
                {renderEditForm()}
            </Modal>
        </div>
    );
};

export default Profile;

