import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Award,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
  ExternalLink,
  ShieldCheck,
  FolderGit2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { DashboardStatsData } from '../../types/student';

export const StudentDashboard: React.FC = () => {
  const { user, profile } = useAuth();

  const { data, isLoading, isError, error, refetch } = useQuery<DashboardStatsData>({
    queryKey: ['student-dashboard-stats'],
    queryFn: () => api.get<DashboardStatsData>('/students/dashboard/stats'),
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-200">
        <div className="flex flex-col gap-2 pb-6 border-b border-slate-800">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load dashboard intelligence"
        message={error instanceof Error ? error.message : 'Failed to retrieve placement statistics.'}
        onRetry={() => refetch()}
      />
    );
  }

  const stats = data?.stats || {
    availableJobs: 0,
    totalApplications: 0,
    interviews: 0,
    offers: 0,
    shortlisted: 0,
    totalSkills: 0,
    verifiedSkills: 0,
    totalEvidence: 0,
    verifiedEvidence: 0,
    pendingEvidence: 0,
    cgpa: profile?.cgpa || 0,
    graduationYear: profile?.graduationYear || 2026,
    department: profile?.department || '',
    degree: profile?.degree || 'B.Tech',
    rollNumber: profile?.rollNumber || '',
  };

  const recentApplications = data?.recentApplications || [];
  const recentEvidence = data?.recentEvidence || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Student Placement Hub
            </h1>
            <Badge variant="electric" size="sm" dot>
              {stats.rollNumber || user?.email}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            {stats.degree} in {stats.department || 'Engineering'} &bull; Class of{' '}
            {stats.graduationYear} &bull; CGPA:{' '}
            <span className="text-blue-400 font-semibold">{stats.cgpa.toFixed(2)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/student/skills">
            <Button variant="outline" size="sm" icon={<Award className="w-3.5 h-3.5" />}>
              Evidence Vault
            </Button>
          </Link>
          <Link to="/student/resumes">
            <Button variant="outline" size="sm" icon={<FileText className="w-3.5 h-3.5" />}>
              Resume Builder
            </Button>
          </Link>
          <Link to="/student/jobs">
            <Button variant="primary" size="sm" icon={<Briefcase className="w-3.5 h-3.5" />}>
              Explore Jobs
            </Button>
          </Link>
        </div>
      </div>

      {/* Real-time Metric Cards (Backed by MongoDB) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Available Jobs */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Available Openings
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white">{stats.availableJobs}</div>
            <Link
              to="/student/jobs"
              className="text-[11px] text-blue-400 hover:text-blue-300 mt-2 flex items-center gap-1 font-medium"
            >
              Discover open requisitions <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        {/* My Applications */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                My Applications
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white">{stats.totalApplications}</div>
            <p className="text-[11px] text-teal-400 mt-2 font-medium">
              {stats.shortlisted} in advanced evaluation stages
            </p>
          </CardContent>
        </Card>

        {/* Interviews & Offers */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Interviews &amp; Offers
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{stats.interviews}</span>
              <span className="text-xs text-slate-400">Interviews</span>
              <span className="text-slate-600">/</span>
              <span className="text-2xl font-bold text-emerald-400">{stats.offers}</span>
              <span className="text-xs text-slate-400">Offers</span>
            </div>
            <Link
              to="/student/applications"
              className="text-[11px] text-emerald-400 hover:text-emerald-300 mt-2 flex items-center gap-1 font-medium"
            >
              View status timelines <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Verified Skills Integrity */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Evidence Integrity
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{stats.verifiedSkills}</span>
              <span className="text-xs text-slate-400">of {stats.totalSkills} skills verified</span>
            </div>
            <p className="text-[11px] text-amber-400 mt-2">
              {stats.pendingEvidence} evidence records in evaluation queue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Shortcut Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-[#0b1329] to-teal-950/30 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Targeted Interview Preparation</h3>
            <p className="text-xs text-slate-400">
              Generate role-specific interview kits with system design scenarios and gap questions.
            </p>
          </div>
        </div>
        <Link to="/student/interview-prep" className="shrink-0 w-full sm:w-auto">
          <Button variant="teal" size="sm" className="w-full sm:w-auto">
            Launch Interview Prep
          </Button>
        </Link>
      </div>

      {/* Two Column Layout: Recent Applications & Recent Evidence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applications */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Recent Applications</CardTitle>
              <CardDescription>Live status of your submitted candidacies</CardDescription>
            </div>
            <Link
              to="/student/applications"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              View all ({stats.totalApplications})
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentApplications.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="w-6 h-6 text-slate-500" />}
                title="No active applications"
                description="You haven't submitted any job applications yet. Generate a verified resume to apply."
                action={{
                  label: 'Browse Openings',
                  onClick: () => (window.location.href = '/student/jobs'),
                }}
              />
            ) : (
              recentApplications.map((app) => {
                const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'electric' | 'teal' | 'neutral'> = {
                  applied: 'neutral',
                  screening: 'electric',
                  shortlisted: 'teal',
                  assessment: 'warning',
                  interview: 'electric',
                  offered: 'success',
                  rejected: 'danger',
                  withdrawn: 'neutral',
                };

                const companyName =
                  typeof app.job?.company === 'object'
                    ? app.job?.company?.name
                    : 'Company';

                return (
                  <div
                    key={app._id}
                    className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {app.job?.title || 'Job Opening'}
                      </h4>
                      <p className="text-xs text-slate-400 truncate">
                        {companyName} &bull; {app.job?.location || 'Remote'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={statusVariants[app.currentStatus] || 'neutral'} size="sm">
                        {app.currentStatus}
                      </Badge>
                      <Link to={`/student/applications`}>
                        <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />} />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Evidence Status Activity */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Evidence Vault Activity</CardTitle>
              <CardDescription>Audited deliverables backing your skills</CardDescription>
            </div>
            <Link
              to="/student/skills"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              View all ({stats.totalEvidence})
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentEvidence.length === 0 ? (
              <EmptyState
                icon={<FolderGit2 className="w-6 h-6 text-slate-500" />}
                title="No evidence submitted yet"
                description="Upload GitHub repositories, proctored assessments, or project links to prove your skills."
                action={{
                  label: 'Submit Proof',
                  onClick: () => (window.location.href = '/student/skills'),
                }}
              />
            ) : (
              recentEvidence.map((ev) => {
                const statusBadge =
                  ev.status === 'verified'
                    ? { variant: 'success' as const, label: 'Verified' }
                    : ev.status === 'under_review'
                    ? { variant: 'warning' as const, label: 'Under Review' }
                    : ev.status === 'rejected'
                    ? { variant: 'danger' as const, label: 'Rejected' }
                    : { variant: 'electric' as const, label: 'Submitted' };

                return (
                  <div
                    key={ev._id}
                    className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <h4 className="text-sm font-semibold text-white truncate">{ev.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-400 capitalize">
                          {ev.type.replace(/_/g, ' ')}
                        </span>
                        {ev.score !== undefined && (
                          <span className="text-[11px] text-teal-400 font-mono">
                            Score: {ev.score}%
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={statusBadge.variant} size="sm" dot>
                      {statusBadge.label}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
