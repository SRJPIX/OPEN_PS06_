import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Search,
  MapPin,
  Building2,
  Clock,
  ArrowRight,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { JobItem } from '../../types/student';

interface JobsResponse {
  jobs: JobItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const JobDiscoveryPage: React.FC = () => {
  const [titleQuery, setTitleQuery] = useState('');
  const [companyQuery, setCompanyQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [workplaceType, setWorkplaceType] = useState<string>('');
  const [jobType, setJobType] = useState<string>('');

  const queryParams = new URLSearchParams();
  queryParams.set('limit', '50');
  if (titleQuery.trim()) queryParams.set('title', titleQuery.trim());
  if (companyQuery.trim()) queryParams.set('company', companyQuery.trim());
  if (locationQuery.trim()) queryParams.set('location', locationQuery.trim());
  if (workplaceType) queryParams.set('workplaceType', workplaceType);
  if (jobType) queryParams.set('jobType', jobType);

  const { data, isLoading, isError, error, refetch } = useQuery<JobsResponse>({
    queryKey: ['student-jobs', titleQuery, companyQuery, locationQuery, workplaceType, jobType],
    queryFn: () => {
      const qs = queryParams.toString();
      return api.get<JobsResponse>(qs ? `/jobs?${qs}` : '/jobs');
    },
  });

  const clearFilters = () => {
    setTitleQuery('');
    setCompanyQuery('');
    setLocationQuery('');
    setWorkplaceType('');
    setJobType('');
  };

  const hasActiveFilters =
    titleQuery || companyQuery || locationQuery || workplaceType || jobType;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Job Opportunities
            </h1>
            <Badge variant="electric" size="sm" dot>
              Open Requisitions
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Browse published opportunities and inspect your deterministic, evidence-backed fit score.
          </p>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={clearFilters}
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-800 bg-[#0b1329] p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-3.5">
          <Input
            placeholder="Search role title..."
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            value={titleQuery}
            onChange={(e) => setTitleQuery(e.target.value)}
          />

          <Input
            placeholder="Filter by company..."
            leftIcon={<Building2 className="w-4 h-4 text-slate-400" />}
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
          />

          <Input
            placeholder="Filter by location (e.g. Remote, Bengaluru)..."
            leftIcon={<MapPin className="w-4 h-4 text-slate-400" />}
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          {/* Workplace Mode Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-semibold mr-1">Work Mode:</span>
            {[
              { id: '', label: 'All Modes' },
              { id: 'remote', label: 'Remote' },
              { id: 'hybrid', label: 'Hybrid' },
              { id: 'on_site', label: 'On-Site' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setWorkplaceType(mode.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  workplaceType === mode.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#070d18] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Job Type Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-semibold mr-1">Job Type:</span>
            {[
              { id: '', label: 'All Types' },
              { id: 'full_time', label: 'Full-Time' },
              { id: 'internship', label: 'Internship' },
              { id: 'contract', label: 'Contract' },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setJobType(type.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  jobType === type.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#070d18] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Results Header */}
      {(() => {
        const jobsList: JobItem[] = Array.isArray(data) ? data : (data as any)?.jobs || [];
        const totalCount: number = Array.isArray(data)
          ? ((data as any).total ?? (data as any).meta?.total ?? jobsList.length)
          : (data as any)?.total || jobsList.length;

        return (
          <>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing {jobsList.length} of {totalCount} matching jobs
              </span>
            </div>

            {/* Loading Skeletons */}
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-2xl" />
                ))}
              </div>
            )}

            {/* Error State */}
            {isError && (
              <ErrorState
                title="Could not load jobs"
                message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
                onRetry={() => refetch()}
              />
            )}

            {/* Empty State */}
            {!isLoading && !isError && jobsList.length === 0 && (
              <EmptyState
                icon={<Briefcase className="w-8 h-8 text-slate-500" />}
                title="No jobs matching your filters"
                description="Try broadening your search keywords or resetting your workplace filters."
                action={{
                  label: 'Clear All Filters',
                  onClick: clearFilters,
                }}
              />
            )}

            {/* Job Cards Grid */}
            {!isLoading && !isError && jobsList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {jobsList.map((job) => {
                  const companyName =
                    typeof job.company === 'object' ? job.company?.name : 'Company';
                  const companyIndustry =
                    typeof job.company === 'object' ? job.company?.industry : 'Technology';

            return (
              <Card
                key={job._id}
                className="border-slate-800 bg-[#0b1329] hover:border-slate-700 hover:shadow-2xl hover:shadow-blue-900/10 transition-all flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-slate-300">{companyName}</span>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-[11px] text-slate-500">{companyIndustry}</span>
                      </div>
                    </div>
                    <Badge variant="teal" size="sm" dot>
                      Open
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 flex-1">
                  {/* Badges strip */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {job.location}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {job.workplaceType.replace('_', ' ')}
                    </Badge>
                    <Badge variant="electric" size="sm">
                      {job.jobType.replace('_', ' ')}
                    </Badge>
                    {(job.salaryRange?.min ?? job.salaryMin) && (
                      <span className="text-emerald-400 font-mono font-medium text-[11px]">
                        {job.salaryRange?.currency || job.salaryCurrency || 'INR'} {(job.salaryRange?.min ?? job.salaryMin)!.toLocaleString()}
                        {(job.salaryRange?.max ?? job.salaryMax) ? ` - ${(job.salaryRange?.max ?? job.salaryMax)!.toLocaleString()}` : '+'}
                      </span>
                    )}
                  </div>

                  {/* Required skills */}
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Required Skills:
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {job.requiredSkills?.map((s) => (
                        <span
                          key={s._id}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#070d18] border border-blue-500/25 text-blue-300"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Eligibility snippet */}
                  <div className="p-2.5 rounded-xl bg-[#070d18] border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>
                      Criteria: Min CGPA {job.minCgpa || 'None'} &bull; Batches:{' '}
                      {job.eligibleGraduationYears?.join(', ') || 'All'}
                    </span>
                    {job.deadline && (
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(job.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Action CTA */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                    <Link to={`/student/jobs/${job._id}`}>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Sparkles className="w-3.5 h-3.5" />}
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        Inspect Match Fit
                      </Button>
                    </Link>

                    <Link to={`/student/interview-prep?jobId=${job._id}`}>
                      <Button variant="ghost" size="sm" className="text-xs text-slate-400">
                        Interview Prep
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};
