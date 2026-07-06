import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Wifi } from 'lucide-react';
import { Button } from '../components/ui/Button';

const ManagerLayout = () => {
    const navigate = useNavigate();
    const { employeeUser: user, logout } = useAuth();

    const handleLogout = () => {
        logout('Employee');
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            {/* Top header bar */}
            <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-amber-500 flex items-center justify-center shadow-sm">
                        <Wifi className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <span className="font-bold text-sm text-foreground">Office IP Dashboard</span>
                        <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">· {user?.name || 'Manager'}</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2"
                >
                    <LogOut size={15} />
                    <span className="hidden sm:inline">Logout</span>
                </Button>
            </header>

            <main className="flex-1 flex items-start justify-center p-4 sm:p-6 bg-muted/20">
                <div className="w-full max-w-xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default ManagerLayout;
