import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/auth';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';

interface RoleRouteProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles, children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // ProtectedRoute handles loading display if nested
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // User does not have the required role
    const defaultDashboard =
      user.role === 'student'
        ? '/student/dashboard'
        : user.role === 'recruiter'
          ? '/recruiter/dashboard'
          : '/officer/dashboard';

    return (
      <div className="min-h-screen bg-[#070d18] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-[#0b1329] border border-rose-900/40 rounded-2xl p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-950 border border-rose-800/40 flex items-center justify-center text-rose-400 mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-400 mb-6">
            Your account role (<span className="text-blue-400 font-semibold">{user.role}</span>)
            does not have clearance to view this module.
          </p>
          <a href={defaultDashboard}>
            <Button variant="primary" size="md" className="w-full">
              Return to Authorized Workspace
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
