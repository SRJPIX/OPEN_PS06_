import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  LayoutDashboard,
  FileCheck,
  Briefcase,
  Users,
  Award,
  Sparkles,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  ChevronRight,
  Shield,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Build role-specific navigation items
  const getNavItems = (): NavItem[] => {
    if (!user) return [];

    if (user.role === 'student') {
      return [
        {
          label: 'Student Overview',
          href: '/student/dashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          label: 'Evidence Vault',
          href: '/student/evidence',
          icon: <FileCheck className="w-4 h-4" />,
          badge: 'Verified',
        },
        {
          label: 'Skill Profile',
          href: '/student/skills',
          icon: <Award className="w-4 h-4" />,
        },
        {
          label: 'Matched Jobs',
          href: '/student/jobs',
          icon: <Briefcase className="w-4 h-4" />,
        },
      ];
    }

    if (user.role === 'placement_officer' || user.role === 'admin') {
      return [
        {
          label: 'Officer Workspace',
          href: '/officer/dashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          label: 'Evidence Queue',
          href: '/officer/evidence-reviews',
          icon: <FileCheck className="w-4 h-4" />,
          badge: 'Review',
        },
        {
          label: 'Match & Ranking Engine',
          href: '/officer/matching',
          icon: <Sparkles className="w-4 h-4 text-blue-400" />,
          badge: 'AI Core',
        },
        {
          label: 'Requisition Catalog',
          href: '/officer/jobs',
          icon: <Briefcase className="w-4 h-4" />,
        },
        {
          label: 'Student Directory',
          href: '/officer/students',
          icon: <Users className="w-4 h-4" />,
        },
      ];
    }

    if (user.role === 'recruiter') {
      return [
        {
          label: 'Recruiter Hub',
          href: '/recruiter/dashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          label: 'Job Postings',
          href: '/recruiter/jobs',
          icon: <Briefcase className="w-4 h-4" />,
        },
        {
          label: 'Candidate Analytics',
          href: '/recruiter/candidates',
          icon: <Sparkles className="w-4 h-4 text-teal-400" />,
        },
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'student':
        return 'Student Portal';
      case 'placement_officer':
        return 'Placement Office';
      case 'recruiter':
        return 'Recruiter Suite';
      case 'admin':
        return 'Platform Admin';
      default:
        return 'Workspace';
    }
  };

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-[#0b1329] border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-teal-400 p-[1px] shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-[#070d18] rounded-[11px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-white">Evidra</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {user?.role?.substring(0, 3)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {getRoleDisplayName(user?.role)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="md:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Navigation Menu
          </div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors group',
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-[#111d38]'
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'transition-colors',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider',
                      isActive
                        ? 'bg-blue-800/80 text-white'
                        : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User Card & Logout in Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-[#070d18]/50">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0b1329] border border-slate-800/80 mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#111d38] border border-slate-700/60 flex items-center justify-center text-blue-400 shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-slate-400 capitalize">
                  {user?.role.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<LogOut className="w-3.5 h-3.5" />}
            onClick={handleLogout}
            className="w-full text-slate-400 hover:text-rose-400 hover:bg-rose-950/20"
          >
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-800/80 bg-[#070d18]/85 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Open navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Evidra</span>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="text-slate-200 font-medium capitalize">
                {user?.role.replace('_', ' ')} Workspace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#0b1329] border border-slate-800 text-xs text-slate-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Evidence Engine Active</span>
            </div>

            <Badge variant="neutral" size="sm" dot>
              {user?.status || 'active'}
            </Badge>

            <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-slate-800 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Verified Session</span>
            </div>
          </div>
        </header>

        {/* Routed Dashboard Page Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
