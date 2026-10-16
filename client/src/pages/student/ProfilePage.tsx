import React, { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BookOpen,
  Phone,
  Globe,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const LinkedinIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { queryClient } from '../../lib/queryClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';

const educationSchema = z.object({
  institution: z.string().min(1, 'Institution is required').trim(),
  degree: z.string().min(1, 'Degree is required').trim(),
  fieldOfStudy: z.string().trim().optional(),
  startYear: z.number().optional(),
  endYear: z.number().optional(),
  scoreOrCgpa: z.string().trim().optional(),
});

const profileFormSchema = z.object({
  department: z.string().min(2, 'Department is required').trim(),
  degree: z.string().min(2, 'Degree is required').trim(),
  graduationYear: z
    .number()
    .int()
    .min(2000, 'Invalid year')
    .max(2100, 'Invalid year'),
  cgpa: z
    .number()
    .min(0, 'CGPA cannot be negative')
    .max(10, 'CGPA cannot exceed 10.0'),
  phone: z.string().trim().optional(),
  bio: z.string().max(1000, 'Bio cannot exceed 1000 characters').trim().optional(),
  github: z.string().trim().optional(),
  linkedin: z.string().trim().optional(),
  portfolio: z.string().trim().optional(),
  education: z.array(educationSchema),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileResponse {
  profile: {
    _id: string;
    rollNumber: string;
    department: string;
    degree: string;
    graduationYear: number;
    cgpa: number;
    phone?: string;
    bio?: string;
    education?: Array<{
      institution: string;
      degree: string;
      fieldOfStudy?: string;
      startYear?: number;
      endYear?: number;
      scoreOrCgpa?: string;
    }>;
    links?: {
      github?: string;
      linkedin?: string;
      portfolio?: string;
    };
  };
  metrics: {
    totalSkills: number;
    verifiedSkills: number;
    totalEvidence: number;
    verifiedEvidence: number;
  };
}

export const ProfilePage: React.FC = () => {
  const { user, refreshSession } = useAuth();
  const { success, error: toastError } = useToast();

  const { data, isLoading, isError, error, refetch } = useQuery<ProfileResponse>({
    queryKey: ['student-profile-me'],
    queryFn: () => api.get<ProfileResponse>('/students/profile/me'),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      department: '',
      degree: 'B.Tech',
      graduationYear: 2026,
      cgpa: 8.0,
      phone: '',
      bio: '',
      github: '',
      linkedin: '',
      portfolio: '',
      education: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'education',
  });

  // Populate form with fetched profile
  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      reset({
        department: p.department || '',
        degree: p.degree || 'B.Tech',
        graduationYear: p.graduationYear || 2026,
        cgpa: p.cgpa || 0,
        phone: p.phone || '',
        bio: p.bio || '',
        github: p.links?.github || '',
        linkedin: p.links?.linkedin || '',
        portfolio: p.links?.portfolio || '',
        education: p.education || [],
      });
    }
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) => {
      const payload = {
        department: values.department,
        degree: values.degree,
        graduationYear: values.graduationYear,
        cgpa: values.cgpa,
        phone: values.phone,
        bio: values.bio,
        education: values.education,
        links: {
          github: values.github,
          linkedin: values.linkedin,
          portfolio: values.portfolio,
        },
      };
      return api.put('/students/profile/me', payload);
    },
    onSuccess: async () => {
      success('Profile Updated', 'Your academic and profile details have been saved.');
      queryClient.invalidateQueries({ queryKey: ['student-profile-me'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
      await refreshSession();
    },
    onError: (err: any) => {
      toastError('Update Failed', err.message || 'Could not update profile.');
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Could not load profile"
        message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
        onRetry={() => refetch()}
      />
    );
  }

  const profile = data?.profile;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Profile &amp; Education
            </h1>
            <Badge variant="electric" size="sm" dot>
              {profile?.rollNumber}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Manage your verified academic credentials, graduation restrictions, and contact links.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Save className="w-4 h-4" />}
          isLoading={updateMutation.isPending}
          disabled={!isDirty}
          onClick={handleSubmit(onSubmit)}
        >
          Save Changes
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Academic Foundation Card */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle>Academic Program &amp; Standing</CardTitle>
            <CardDescription>
              Official university credentials used by the deterministic matching engine for
              eligibility verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label="Roll Number"
                value={profile?.rollNumber || ''}
                disabled
                helperText="Permanent university identifier"
              />

              <Input
                label="Degree"
                placeholder="e.g. B.Tech"
                error={errors.degree?.message}
                required
                {...register('degree')}
              />

              <Input
                label="Graduation Year"
                type="number"
                placeholder="2026"
                error={errors.graduationYear?.message}
                required
                {...register('graduationYear', { valueAsNumber: true })}
              />

              <Input
                label="Cumulative CGPA (0 - 10)"
                type="number"
                step="0.01"
                placeholder="8.85"
                error={errors.cgpa?.message}
                required
                {...register('cgpa', { valueAsNumber: true })}
              />
            </div>

            <Input
              label="Department / Field of Study"
              placeholder="e.g. Computer Science & Engineering"
              leftIcon={<BookOpen className="w-4 h-4" />}
              error={errors.department?.message}
              required
              {...register('department')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Primary Email"
                value={user?.email || ''}
                disabled
                helperText="Verified session email"
              />

              <Input
                label="Contact Phone"
                placeholder="+91 9876543210"
                leftIcon={<Phone className="w-4 h-4" />}
                error={errors.phone?.message}
                {...register('phone')}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Professional Bio</label>
              <textarea
                rows={3}
                placeholder="Brief summary of your technical focus, systems engineering passion, or research interests..."
                className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-3.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                {...register('bio')}
              />
              {errors.bio && <p className="text-xs text-rose-400">{errors.bio.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Education Timeline Card */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Education Milestones</CardTitle>
              <CardDescription>
                Chronological institutions, degrees, and academic performance history.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() =>
                append({
                  institution: '',
                  degree: 'B.Tech',
                  fieldOfStudy: '',
                  startYear: 2022,
                  endYear: 2026,
                  scoreOrCgpa: '',
                })
              }
            >
              Add Institution
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
                No extra institutions added. Click &quot;Add Institution&quot; to include prior degrees
                or schooling.
              </div>
            ) : (
              fields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-4 rounded-xl bg-[#070d18] border border-slate-800 space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Entry #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition"
                      title="Remove entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Institution / University Name"
                      placeholder="e.g. Apex Institute of Technology"
                      error={errors.education?.[index]?.institution?.message}
                      {...register(`education.${index}.institution`)}
                    />
                    <Input
                      label="Degree Awarded"
                      placeholder="e.g. Higher Secondary / B.Tech"
                      error={errors.education?.[index]?.degree?.message}
                      {...register(`education.${index}.degree`)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input
                      label="Field of Study"
                      placeholder="e.g. Science / Computer Science"
                      {...register(`education.${index}.fieldOfStudy`)}
                    />
                    <Input
                      label="Start Year"
                      type="number"
                      placeholder="2022"
                      {...register(`education.${index}.startYear`, { valueAsNumber: true })}
                    />
                    <Input
                      label="End / Expected Year"
                      type="number"
                      placeholder="2026"
                      {...register(`education.${index}.endYear`, { valueAsNumber: true })}
                    />
                  </div>

                  <Input
                    label="Score / CGPA"
                    placeholder="e.g. 9.1 CGPA or 94.5%"
                    {...register(`education.${index}.scoreOrCgpa`)}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Public & Developer Links Card */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle>Public &amp; Portfolio Links</CardTitle>
            <CardDescription>
              External profiles reviewed during recruiter evaluations and resume generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="GitHub Profile URL"
                placeholder="https://github.com/username"
                leftIcon={<GithubIcon className="w-4 h-4" />}
                {...register('github')}
              />

              <Input
                label="LinkedIn Profile URL"
                placeholder="https://linkedin.com/in/username"
                leftIcon={<LinkedinIcon className="w-4 h-4" />}
                {...register('linkedin')}
              />

              <Input
                label="Portfolio / Personal Site"
                placeholder="https://myportfolio.dev"
                leftIcon={<Globe className="w-4 h-4" />}
                {...register('portfolio')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Bottom Save Action */}
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={<Save className="w-4 h-4" />}
            isLoading={updateMutation.isPending}
            disabled={!isDirty}
          >
            Save Profile Updates
          </Button>
        </div>
      </form>
    </div>
  );
};
