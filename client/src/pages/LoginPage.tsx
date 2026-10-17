import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle, KeyRound, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { ApiClientError } from '../lib/api';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setFormError(null);
    try {
      const loggedInUser = await login(data);
      success('Authentication Successful', `Welcome back to Evidra (${loggedInUser.role.replace('_', ' ')}).`);

      // Redirect to prior location if exists, otherwise to role dashboard
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else {
        const roleDashboard =
          loggedInUser.role === 'placement_officer' || loggedInUser.role === 'admin'
            ? '/officer/dashboard'
            : loggedInUser.role === 'recruiter'
            ? '/recruiter/dashboard'
            : '/student/dashboard';
        navigate(roleDashboard, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        toastError('Login Failed', err.message);
      } else if (err instanceof Error) {
        setFormError(err.message);
        toastError('Login Failed', err.message);
      } else {
        setFormError('An unexpected error occurred during login. Please try again.');
        toastError('Login Failed', 'Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoCredentials = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'EvidraDemo123!', { shouldValidate: true });
    setFormError(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[#070d18] relative">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-teal-400 p-[1px] shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-[#070d18] rounded-[11px] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white">Evidra</span>
          </Link>
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-white">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Or{' '}
          <Link
            to="/register"
            className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            create a verified student profile
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="border-slate-800 bg-[#0b1329]/95 shadow-2xl">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Enter your credentials to access your verified placement portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Error Alert */}
            {formError && (
              <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="name@university.edu"
                leftIcon={<Mail className="w-4 h-4" />}
                error={errors.email?.message}
                {...register('email')}
              />

              <Input
                label="Password"
                type="password"
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                leftIcon={<Lock className="w-4 h-4" />}
                error={errors.password?.message}
                {...register('password')}
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In
              </Button>
            </form>

            {/* Quick Demo Logins Section */}
            <div className="mt-8 pt-6 border-t border-slate-800/80">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Quick Demo Accounts
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Pre-configured test roles with full seed dataset (Password: <code className="text-teal-400">EvidraDemo123!</code>). Click to autofill:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDemoCredentials('student@evidra.dev')}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#070d18] border border-slate-800 hover:border-blue-500/50 hover:bg-blue-950/10 text-left transition cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-slate-200">Student</div>
                    <div className="text-[10px] text-slate-500">DEMO26CS000</div>
                  </div>
                  <Check className="w-3.5 h-3.5 text-slate-600" />
                </button>

                <button
                  type="button"
                  onClick={() => setDemoCredentials('officer@evidra.dev')}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#070d18] border border-slate-800 hover:border-teal-500/50 hover:bg-teal-950/10 text-left transition cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-slate-200">Placement Officer</div>
                    <div className="text-[10px] text-slate-500">Faculty/TPO</div>
                  </div>
                  <Check className="w-3.5 h-3.5 text-slate-600" />
                </button>

                <button
                  type="button"
                  onClick={() => setDemoCredentials('recruiter@evidra.dev')}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#070d18] border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/10 text-left transition cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-slate-200">Recruiter</div>
                    <div className="text-[10px] text-slate-500">Partner Labs</div>
                  </div>
                  <Check className="w-3.5 h-3.5 text-slate-600" />
                </button>

                <button
                  type="button"
                  onClick={() => setDemoCredentials('admin@evidra.dev')}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#070d18] border border-slate-800 hover:border-amber-500/50 hover:bg-amber-950/10 text-left transition cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-slate-200">Platform Admin</div>
                    <div className="text-[10px] text-slate-500">System Ops</div>
                  </div>
                  <Check className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

