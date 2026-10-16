import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileCheck2,
  Sparkles,
  Users,
  Briefcase,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  History,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import type { OfficerDashboardStats } from '../../types/officer';

export const PlacementDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useQuery<OfficerDashboardStats>({
    queryKey: ['officer-dashboard-stats'],
    queryFn: () => api.get<OfficerDashboardStats>('/officer/dashboard/stats'),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="space-y-2">
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load placement metrics"
        message={error instanceof Error ? error.message : 'Error communicating with backend service'}
        onRetry={() => refetch()}
      />
    );
  }

  const metrics = data?.metrics || {
    pendingEvidenceCount: 0,
    activeJobsCount: 0,
    totalJobsCount: 0,
    totalStudentsCount: 0,
    unverifiedClaimsCount: 0,
    activeApplicationsCount: 0,
    placedStudentsCount: 0,
    placementRate: 0,
  };

  const recentLogs = data?.recentAuditLogs || [];
  const recentEvidence = data?.recentPendingEvidence || [];
  const recentApps = data?.recentApplications || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Placement Officer Command Center
            </h1>
            <Badge variant="electric" size="sm" dot>
              {user?.email || 'Authorized Evaluator'}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Real-time placement operations, evidence auditing, and explainable cohort ranking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            icon={<UploadCloud className="w-4 h-4 text-slate-300" />}
            onClick={() => navigate('/officer/jobs/import-csv')}
          >
            Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Briefcase className="w-4 h-4 text-blue-400" />}
            onClick={() => navigate('/officer/jobs/create')}
          >
            Post Job
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Sparkles className="w-4 h-4" />}
            onClick={() => navigate('/officer/matching')}
          >
            Batch Ranking
          </Button>
        </div>
      </div>

      {/* Real Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Evidence in Queue */}
        <Link to="/officer/evidence-reviews" className="block group">
          <Card className="border-slate-800 bg-[#0b1329] group-hover:border-blue-500/50 group-hover:shadow-lg group-hover:shadow-blue-500/10 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Evidence In Queue
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <FileCheck2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {metrics.pendingEvidenceCount} Pending
              </div>
              <p className="text-[11px] text-blue-400/90 mt-1 flex items-center gap-1">
                <span>Requires evaluator review</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Metric 2: Active Requisitions */}
        <Link to="/officer/jobs" className="block group">
          <Card className="border-slate-800 bg-[#0b1329] group-hover:border-teal-500/50 group-hover:shadow-lg group-hover:shadow-teal-500/10 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Active Requisitions
                </span>
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {metrics.activeJobsCount} Active Jobs
              </div>
              <p className="text-[11px] text-teal-400/90 mt-1">
                {metrics.totalJobsCount} total postings in catalog
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Metric 3: Registered Cohort */}
        <Link to="/officer/students" className="block group">
          <Card className="border-slate-800 bg-[#0b1329] group-hover:border-purple-500/50 group-hover:shadow-lg group-hover:shadow-purple-500/10 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Registered Cohort
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {metrics.totalStudentsCount} Students
              </div>
              <p className="text-[11px] text-purple-400/90 mt-1">
                Active candidates in directory
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Metric 4: Placement Rate & Offers */}
        <Link to="/officer/analytics" className="block group">
          <Card className="border-slate-800 bg-[#0b1329] group-hover:border-emerald-500/50 group-hover:shadow-lg group-hover:shadow-emerald-500/10 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Placement Rate
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {metrics.placementRate}% Placed
              </div>
              <p className="text-[11px] text-emerald-400/90 mt-1">
                {metrics.placedStudentsCount} offers / {metrics.activeApplicationsCount} active in pipeline
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Action Navigation Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Button
          variant="outline"
          size="sm"
          className="justify-start bg-[#0b1329] border-slate-800 text-xs text-slate-300 hover:text-white"
          icon={<FileCheck2 className="w-3.5 h-3.5 text-blue-400" />}
          onClick={() => navigate('/officer/evidence-reviews')}
        >
          Evidence Queue
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start bg-[#0b1329] border-slate-800 text-xs text-slate-300 hover:text-white"
          icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
          onClick={() => navigate('/officer/resume-claims')}
        >
          Resume Claims ({metrics.unverifiedClaimsCount})
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start bg-[#0b1329] border-slate-800 text-xs text-slate-300 hover:text-white"
          icon={<Layers className="w-3.5 h-3.5 text-teal-400" />}
          onClick={() => navigate('/officer/applications')}
        >
          Pipeline ({metrics.activeApplicationsCount})
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start bg-[#0b1329] border-slate-800 text-xs text-slate-300 hover:text-white"
          icon={<Briefcase className="w-3.5 h-3.5 text-indigo-400" />}
          onClick={() => navigate('/officer/jobs/duplicates')}
        >
          Duplicate Check
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start bg-[#0b1329] border-slate-800 text-xs text-slate-300 hover:text-white"
          icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
          onClick={() => navigate('/officer/analytics')}
        >
          Analytics Hub
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start bg-[#0b1329] border-slate-800 text-xs text-slate-300 hover:text-white"
          icon={<History className="w-3.5 h-3.5 text-purple-400" />}
          onClick={() => navigate('/officer/audit-logs')}
        >
          Audit History
        </Button>
      </div>

      {/* Primary Workspaces Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Evidence Verification Queue Card */}
        <Card className="border-slate-800 bg-[#0b1329] flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-blue-400" />
                <span>Pending Evidence Queue</span>
              </CardTitle>
              <Badge variant={metrics.pendingEvidenceCount > 0 ? 'warning' : 'success'} size="sm">
                {metrics.pendingEvidenceCount} to review
              </Badge>
            </div>
            <CardDescription>
              Evaluate submitted student artifacts, verify skills, and maintain audit records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex-1">
            {recentEvidence.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/80 mx-auto mb-2" />
                <span>All submitted evidence has been evaluated. Great job!</span>
              </div>
            ) : (
              recentEvidence.map((ev) => (
                <div
                  key={ev._id}
                  className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">
                        {ev.student?.rollNumber || 'Student'}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        ({ev.student?.department || 'Department'})
                      </span>
                      {ev.skills?.[0] && (
                        <Badge variant="electric" size="sm">
                          {ev.skills[0].name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      {ev.title} &bull; <span className="capitalize">{ev.type.replace('_', ' ')}</span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/officer/evidence-reviews')}
                  >
                    Evaluate
                  </Button>
                </div>
              ))
            )}
          </CardContent>
          <div className="p-4 border-t border-slate-800/80 bg-[#070d18]/40 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={() => navigate('/officer/evidence-reviews')}
            >
              Open Full Review Queue
            </Button>
          </div>
        </Card>

        {/* Explainable Batch Ranking Spotlight Card */}
        <Card className="border-slate-800 bg-[#0b1329] flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Deterministic Match Engine Hub</span>
              </CardTitle>
              <Badge variant="electric" size="sm">
                Real-Time Scoring
              </Badge>
            </div>
            <CardDescription>
              Rank graduating batches against active job requisitions with mathematical explanation and proof inspection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 space-y-2.5 text-xs">
              <div className="text-slate-300 font-semibold flex items-center justify-between">
                <span>Core Algorithm Configuration</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Strict Pre-Check
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Required Skills Multiplier:</span>
                <span className="font-semibold text-blue-400">3.0x (Verified Proof Backed)</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Preferred Skills Multiplier:</span>
                <span className="font-semibold text-teal-400">1.0x</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Unverified Penalty:</span>
                <span className="font-semibold text-rose-400">0.2x Multiplier</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Eligibility Criteria:</span>
                <span className="font-semibold text-slate-200">CGPA + Dept + Batch Year</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-slate-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                Deterministic tie-breaking prioritizes verified evidence count, verified CGPA, and earliest application submission.
              </span>
            </div>
          </CardContent>
          <div className="p-4 border-t border-slate-800/80 bg-[#070d18]/40">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => navigate('/officer/matching')}
            >
              Launch Batch Ranking Console
            </Button>
          </div>
        </Card>
      </div>

      {/* Bottom Section: Recent Pipeline Applications & Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Application Pipeline Card */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                <span>Recent Candidate Applications</span>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/officer/applications')}
                className="text-xs"
              >
                View Pipeline
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentApps.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent applications submitted.</p>
            ) : (
              recentApps.map((app) => (
                <div
                  key={app._id}
                  className="p-3 rounded-xl bg-[#070d18] border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-semibold text-white truncate">
                      {app.student?.rollNumber} &bull; {app.job?.title}
                    </p>
                    <p className="text-slate-400 text-[11px] truncate mt-0.5">
                      {app.job?.company?.name} &bull; Applied{' '}
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      app.currentStatus === 'offered'
                        ? 'success'
                        : app.currentStatus === 'rejected'
                        ? 'danger'
                        : app.currentStatus === 'interview'
                        ? 'electric'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {app.currentStatus}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Audit Log Card */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                <span>Institutional Audit Activity</span>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/officer/audit-logs')}
                className="text-xs"
              >
                View Full Log
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent audit records.</p>
            ) : (
              recentLogs.slice(0, 5).map((log) => (
                <div
                  key={log._id}
                  className="p-3 rounded-xl bg-[#070d18] border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-semibold text-slate-200 truncate">{log.action}</p>
                    <p className="text-slate-500 text-[11px] truncate mt-0.5">
                      {log.user?.email || 'System'} &bull; {log.entityType} &bull;{' '}
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {log.entityType}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
