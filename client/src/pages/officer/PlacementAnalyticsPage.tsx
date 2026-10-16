import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Users,
  Briefcase,
  Layers,
  GraduationCap,
  RotateCcw,
} from 'lucide-react';
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
import type { OfficerAnalyticsData } from '../../types/officer';

export const PlacementAnalyticsPage: React.FC = () => {
  const { data, isLoading, isError, error, refetch } = useQuery<OfficerAnalyticsData>({
    queryKey: ['officer-analytics'],
    queryFn: () => api.get<OfficerAnalyticsData>('/officer/analytics'),
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-200">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Could not load placement analytics"
        message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
        onRetry={() => refetch()}
      />
    );
  }

  const { funnel, departments = [], batches = [], demandedSkills = [], verifiedSkills = [] } = data;

  const totalApplications = Object.values(funnel).reduce((a, b) => a + b, 0);
  const maxFunnelVal = Math.max(1, funnel.applied || 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Placement Intelligence & Cohort Analytics
            </h1>
            <Badge variant="electric" size="sm">
              Live Database Feeds
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Real-time conversion funnels, department placement performance, and industry skill demand vs verified supply gaps.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={() => refetch()}
        >
          Refresh Data
        </Button>
      </div>

      {/* Conversion Funnel Section */}
      <Card className="border-slate-800 bg-[#0b1329]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Institutional Recruitment Funnel</span>
            </CardTitle>
            <span className="text-xs text-slate-400">{totalApplications} Total Actions Tracked</span>
          </div>
          <CardDescription>
            Conversion rates across the candidate journey from application to accepted offer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { stage: 'Applied (Initial)', count: funnel.applied, color: 'bg-blue-500' },
            { stage: 'Screening', count: funnel.screening, color: 'bg-cyan-500' },
            { stage: 'Shortlisted', count: funnel.shortlisted, color: 'bg-purple-500' },
            { stage: 'Assessment', count: funnel.assessment, color: 'bg-indigo-500' },
            { stage: 'Interview', count: funnel.interview, color: 'bg-amber-500' },
            { stage: 'Offer Extended (Placed)', count: funnel.offered, color: 'bg-emerald-500' },
          ].map((item, idx) => {
            const percentage = Math.round((item.count / maxFunnelVal) * 100);
            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{item.stage}</span>
                  <span className="text-white font-bold">
                    {item.count}{' '}
                    <span className="text-slate-500 font-normal">({percentage}%)</span>
                  </span>
                </div>
                <div className="h-3 w-full bg-[#070d18] rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(item.count > 0 ? 4 : 0, percentage)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Skills Gap Analysis: Industry Demand vs Student Supply */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry Skill Demand */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-400" />
              <span>Top Skills Demanded in Active Openings</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Aggregated requirements from published partner company requisitions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {demandedSkills.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No active job skill requirements.</p>
            ) : (
              demandedSkills.map((sk) => (
                <div
                  key={sk._id}
                  className="p-3 rounded-xl bg-[#070d18] border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{sk.name}</span>
                    <span className="text-[10px] uppercase text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {sk.category}
                    </span>
                  </div>
                  <Badge variant="electric" size="sm">
                    {sk.jobCount} Active Job{sk.jobCount > 1 ? 's' : ''}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Student Verified Competencies */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Top Verified Competencies in Cohort</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Skills backed by faculty-approved evidence and verified projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {verifiedSkills.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No verified skills recorded yet.</p>
            ) : (
              verifiedSkills.map((sk) => (
                <div
                  key={sk._id}
                  className="p-3 rounded-xl bg-[#070d18] border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{sk.name}</span>
                    <span className="text-[10px] uppercase text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {sk.category}
                    </span>
                  </div>
                  <Badge variant="success" size="sm">
                    {sk.verifiedCount} Verified Student{sk.verifiedCount > 1 ? 's' : ''}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown & Batch Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Stats */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-400" />
              <span>Department Cohort Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {departments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No department data recorded.</p>
            ) : (
              departments.map((dept, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white">{dept.department}</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Average CGPA: {dept.avgCgpa.toFixed(2)}
                    </p>
                  </div>
                  <Badge variant="electric" size="sm">
                    {dept.totalStudents} Students
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Batch Distribution */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-400" />
              <span>Graduating Batch Breakdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {batches.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No batch data recorded.</p>
            ) : (
              batches.map((batch, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white">Batch of {batch.year}</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Average CGPA: {batch.avgCgpa.toFixed(2)}
                    </p>
                  </div>
                  <Badge variant="teal" size="sm">
                    {batch.studentCount} Candidates
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
