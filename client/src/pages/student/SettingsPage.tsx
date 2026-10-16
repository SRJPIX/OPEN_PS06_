import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Shield,
  KeyRound,
  User as UserIcon,
  Lock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Globe,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';

export const SettingsPage: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFormError, setPasswordFormError] = useState('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Password Change Mutation
  const passwordMutation = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) =>
      api.put('/auth/password', payload),
    onSuccess: () => {
      success('Password Updated', 'Your account credentials have been updated securely.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFormError('');
    },
    onError: (err: any) => {
      toastError('Update Failed', err.message || 'Could not update password.');
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFormError('');

    if (!currentPassword) {
      setPasswordFormError('Current password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordFormError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFormError('New password and confirmation do not match.');
      return;
    }

    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Shield className="w-6 h-6 text-blue-400" />
          Account & Security Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your placement authentication credentials, session security, and account preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account Profile Overview */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-[#0b1329] border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#111d38] border border-slate-700 flex items-center justify-center text-blue-400 shrink-0">
                <UserIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">
                  {profile?.rollNumber || 'Candidate Account'}
                </h3>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Account Role</span>
                <Badge variant="default" size="sm">
                  {user?.role}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Account Status</span>
                <Badge variant="success" size="sm" dot>
                  {user?.status || 'Active'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Department</span>
                <span className="text-slate-200 font-medium">{profile?.department || 'CSE'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Member Since</span>
                <span className="text-slate-400">{formatDateTime(user?.createdAt)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                icon={<LogOut className="w-3.5 h-3.5" />}
                onClick={() => setIsLogoutModalOpen(true)}
                className="w-full border-rose-900/40 text-rose-400 hover:bg-rose-950/20"
              >
                Sign Out of Evidra
              </Button>
            </div>
          </Card>

          {/* Session Security Card */}
          <Card className="bg-[#0b1329] border-slate-800 p-5 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-teal-400" />
              Security Architecture
            </h4>
            <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>HTTP-Only Cookie:</strong> JWT session tokens are isolated from client-side scripts to prevent XSS exfiltration.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Bcrypt Hashing:</strong> Passwords are cryptographically salted and hashed on the server.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Immutable Audit Logs:</strong> All authentication and evidence actions are logged for campus compliance.
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Password Update & Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#0b1329] border-slate-800 p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-400" />
                Update Account Password
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Ensure your account is protected with a strong, distinct password. Minimum 8 characters.
              </p>
            </div>

            {passwordFormError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordFormError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                placeholder="••••••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="New Password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  helperText="Minimum 8 characters"
                  required
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={passwordMutation.isPending}
                  disabled={passwordMutation.isPending}
                >
                  Save New Password
                </Button>
              </div>
            </form>
          </Card>

          {/* Privacy & Notification Preferences */}
          <Card className="bg-[#0b1329] border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" />
              Recruitment Privacy & Transparency
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Evidra shares only verified technical evidence, proctored evaluation scores, and approved resume claims with authorized recruiters and placement officials. Self-reported claims remain strictly demarcated and are never presented as verified proficiency.
            </p>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#070d18] border border-slate-800 space-y-1">
                <p className="font-semibold text-slate-200">Verified Evidence Shield</p>
                <p className="text-slate-400">
                  Only officer-verified or system-proctored deliverables calculate toward ranking fit scores.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#070d18] border border-slate-800 space-y-1">
                <p className="font-semibold text-slate-200">ATS Verification Proofs</p>
                <p className="text-slate-400">
                  Generated resume links include cryptographically stable hashes to candidate proof records.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Sign Out of Session"
        description="Are you sure you want to end your current session on this device?"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-300">
            Your HTTP-only cookie will be cleared and you will be redirected to the platform login page.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsLogoutModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
