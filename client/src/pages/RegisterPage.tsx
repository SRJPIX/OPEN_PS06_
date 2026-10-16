import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  GraduationCap,
  BookOpen,
  Award,
  Hash,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { ApiClientError } from '../lib/api';

const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password cannot exceed 100 characters'),
  rollNumber: z
    .string()
    .min(2, 'Roll number must be at least 2 characters')
    .max(50, 'Roll number cannot exceed 50 characters')
    .trim(),
  department: z
    .string()
    .min(2, 'Department name is required')
    .max(100, 'Department cannot exceed 100 characters')
    .trim(),
  degree: z
    .string()
    .min(2, 'Degree name is required')
    .max(50, 'Degree cannot exceed 50 characters')
    .trim(),
  graduationYear: z
    .number()
    .int('Graduation year must be an integer')
    .min(2000, 'Cannot be earlier than 2000')
    .max(2100, 'Cannot exceed 2100'),
  cgpa: z.number().min(0, 'CGPA cannot be negative').max(10, 'CGPA cannot exceed 10.0'),
  phone: z.string().trim().optional(),
  bio: z.string().max(1000, 'Bio cannot exceed 1000 characters').trim().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { register: registerStudent } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      rollNumber: '',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      graduationYear: new Date().getFullYear() + 1,
      cgpa: 8.0,
      phone: '',
      bio: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setFormError(null);
    try {
      await registerStudent(data);
      success('Account Created', 'Your student profile has been registered successfully.');
      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        toastError('Registration Failed', err.message);
      } else if (err instanceof Error) {
        setFormError(err.message);
        toastError('Registration Failed', err.message);
      } else {
        setFormError('An unexpected error occurred during registration.');
        toastError('Registration Failed', 'Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[#070d18] relative">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
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
          Create Student Account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Already registered?{' '}
          <Link
            to="/login"
            className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Sign in to your account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <Card className="border-slate-800 bg-[#0b1329]/95 shadow-2xl">
          <CardHeader>
            <CardTitle>Academic &amp; Profile Details</CardTitle>
            <CardDescription>
              Submit your university roll number and credentials to establish your evidence vault.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Error Banner */}
            {formError && (
              <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="University Email"
                  type="email"
                  placeholder="student@apex.edu"
                  leftIcon={<Mail className="w-4 h-4" />}
                  error={errors.email?.message}
                  required
                  {...register('email')}
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  leftIcon={<Lock className="w-4 h-4" />}
                  error={errors.password?.message}
                  required
                  {...register('password')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Roll / Registration No."
                  placeholder="e.g. CS2024045"
                  leftIcon={<Hash className="w-4 h-4" />}
                  error={errors.rollNumber?.message}
                  required
                  {...register('rollNumber')}
                />

                <Input
                  label="Degree Program"
                  placeholder="e.g. B.Tech / M.Tech / MCA"
                  leftIcon={<GraduationCap className="w-4 h-4" />}
                  error={errors.degree?.message}
                  required
                  {...register('degree')}
                />
              </div>

              <Input
                label="Department / Specialization"
                placeholder="e.g. Computer Science & Engineering"
                leftIcon={<BookOpen className="w-4 h-4" />}
                error={errors.department?.message}
                required
                {...register('department')}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Graduation Year"
                  type="number"
                  placeholder="2026"
                  leftIcon={<GraduationCap className="w-4 h-4" />}
                  error={errors.graduationYear?.message}
                  required
                  {...register('graduationYear', { valueAsNumber: true })}
                />

                <Input
                  label="Cumulative CGPA (0 - 10)"
                  type="number"
                  step="0.01"
                  placeholder="8.50"
                  leftIcon={<Award className="w-4 h-4" />}
                  error={errors.cgpa?.message}
                  required
                  {...register('cgpa', { valueAsNumber: true })}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create Verified Account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
