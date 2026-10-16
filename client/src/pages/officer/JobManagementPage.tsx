import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Search,
  Plus,
  UploadCloud,
  ExternalLink,
  Archive,
  Edit,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Building2,
  MapPin,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { JobItem } from '../../types/student';

export const JobManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [workplaceFilter, setWorkplaceFilter] = useState<string>('');
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('');

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search.trim()) queryParams.set('title', search.trim());
  if (statusFilter && statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (workplaceFilter) queryParams.set('workplaceType', workplaceFilter);
  if (jobTypeFilter) queryParams.set('jobType', jobTypeFilter);

  const { data, isLoading, isError, error, refetch } = useQuery<{
    jobs: JobItem[];
    meta?: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ['officer-jobs', page, limit, search, statusFilter, workplaceFilter, jobTypeFilter],
    queryFn: async () => {
      const res = await api.getWithMeta<JobItem[]>(`/jobs?${queryParams.toString()}`);
      return {
        jobs: Array.isArray(res.data) ? res.data : (res.data as any)?.jobs || [],
        meta: res.meta as { page: number; limit: number; total: number; totalPages: number },
      };
    },
  });

  const jobs = data?.jobs || [];
  const meta = data?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/jobs/${id}/archive`),
    onSuccess: () => {
      success('Job Archived', 'The job opening has been archived and removed from student discovery.');
      queryClient.invalidateQueries({ queryKey: ['officer-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['officer-dashboard-stats'] });
    },
    onError: (err: any) => {
      toastError('Archive Failed', err?.message || 'Could not archive job.');
    },
  });

  // Toggle publish/close mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/jobs/${id}`, { status }),
    onSuccess: () => {
      success('Status Updated', 'Requisition status successfully changed.');
      queryClient.invalidateQueries({ queryKey: ['officer-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['officer-dashboard-stats'] });
    },
    onError: (err: any) => {
      toastError('Update Failed', err?.message || 'Could not update status.');
    },
  });

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setWorkplaceFilter('');
    setJobTypeFilter('');
    setPage(1);
  };

  const hasActiveFilters = search || statusFilter || workplaceFilter || jobTypeFilter;

  const getSourceBadge = (job: any) => {
    const srcType = job.sourceType || 'manual_entry';
    switch (srcType) {
      case 'placement_office':
        return <Badge variant="electric" size="sm">Office Verified</Badge>;
      case 'recruiter_portal':
        return <Badge variant="teal" size="sm">Recruiter Direct</Badge>;
      case 'csv_import':
        return <Badge variant="electric" size="sm">CSV Ingest</Badge>;
      case 'ats_feed':
        return <Badge variant="warning" size="sm">ATS Feed</Badge>;
      case 'scraped':
        return <Badge variant="neutral" size="sm">Web Source</Badge>;
      default:
        return <Badge variant="neutral" size="sm">Standard Entry</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Job Requisition Management
            </h1>
            <Badge variant="electric" size="sm">
              {meta.total} Requisitions
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Create, publish, edit and archive institutional job postings, inspect source provenance, and trigger cohort matching.
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
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/officer/jobs/create')}
          >
            Create Opening
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-800 bg-[#0b1329] p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-3.5">
          <Input
            placeholder="Search role title..."
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="open">Open (Published to Students)</option>
            <option value="draft">Draft (Unpublished)</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={workplaceFilter}
            onChange={(e) => {
              setWorkplaceFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Work Modes</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="on_site">On-Site</option>
          </select>

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={jobTypeFilter}
            onChange={(e) => {
              setJobTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Job Types</option>
            <option value="full_time">Full-Time</option>
            <option value="internship">Internship</option>
            <option value="contract">Contract</option>
          </select>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-400">
          <div>
            Showing <span className="text-white font-semibold">{jobs.length}</span> of{' '}
            <span className="text-white font-semibold">{meta.total}</span> requisitions
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={clearFilters}
              className="text-xs"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <ErrorState
          title="Could not load job requisitions"
          message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !isError && jobs.length === 0 && (
        <EmptyState
          icon={<Briefcase className="w-8 h-8 text-slate-500" />}
          title="No job requisitions found"
          description="Create a new job opening or adjust your search keywords to view postings."
          action={{
            label: 'Post New Job',
            onClick: () => navigate('/officer/jobs/create'),
          }}
        />
      )}

      {/* Job Card List */}
      {!isLoading && !isError && jobs.length > 0 && (
        <div className="space-y-4">
          {jobs.map((job) => {
            const companyName =
              typeof job.company === 'object' ? job.company?.name : 'Company';

            return (
              <Card
                key={job._id}
                className="border-slate-800 bg-[#0b1329] hover:border-slate-700 transition-all p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                      {job.title}
                    </h3>
                    <Badge
                      variant={
                        job.status === 'open'
                          ? 'success'
                          : job.status === 'draft'
                          ? 'neutral'
                          : job.status === 'archived'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                      dot={job.status === 'open'}
                    >
                      {job.status.toUpperCase()}
                    </Badge>
                    {getSourceBadge(job)}
                    {job.requisitionId && (
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {job.requisitionId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                    <span className="font-semibold text-white flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {companyName}
                    </span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                      {job.location} ({job.workplaceType})
                    </span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="capitalize text-slate-400">{job.jobType.replace('_', ' ')}</span>
                    {job.minCgpa && (
                      <>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-emerald-400 font-medium">Min CGPA: {job.minCgpa}</span>
                      </>
                    )}
                  </div>

                  {/* Skills tags */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] text-slate-500 font-medium">Required:</span>
                    {job.requiredSkills?.map((s) => (
                      <span
                        key={s._id}
                        className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full"
                      >
                        {s.name}
                      </span>
                    ))}
                    {job.preferredSkills && job.preferredSkills.length > 0 && (
                      <>
                        <span className="text-[11px] text-slate-500 font-medium ml-2">Preferred:</span>
                        {job.preferredSkills.slice(0, 3).map((s) => (
                          <span
                            key={s._id}
                            className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full"
                          >
                            {s.name}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Actions Button Bar */}
                <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Sparkles className="w-3.5 h-3.5 text-blue-400" />}
                      onClick={() => navigate(`/officer/matching?jobId=${job._id}`)}
                    >
                      Match Batch
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Edit className="w-3.5 h-3.5" />}
                      onClick={() => navigate(`/officer/jobs/${job._id}/edit`)}
                    >
                      Edit
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === 'draft' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                        onClick={() =>
                          updateStatusMutation.mutate({ id: job._id, status: 'open' })
                        }
                      >
                        Publish Open
                      </Button>
                    ) : job.status === 'open' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-400 hover:text-amber-300"
                        onClick={() =>
                          updateStatusMutation.mutate({ id: job._id, status: 'closed' })
                        }
                      >
                        Close Listing
                      </Button>
                    ) : null}

                    {job.status !== 'archived' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-slate-400 hover:text-rose-400"
                        icon={<Archive className="w-3 h-3" />}
                        onClick={() => archiveMutation.mutate(job._id)}
                      >
                        Archive
                      </Button>
                    )}

                    {job.sourceUrl && (
                      <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ExternalLink className="w-3 h-3" />}
                          title="Original Source URL"
                        />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !isError && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">
            Page {meta.page} of {meta.totalPages} ({meta.total} total jobs)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
