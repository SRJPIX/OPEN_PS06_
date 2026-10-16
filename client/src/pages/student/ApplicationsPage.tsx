import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  FileText,
  AlertCircle,
  Search,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { queryClient } from '../../lib/queryClient';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { ApplicationItem, ApplicationHistoryItem } from '../../types/student';

interface ApplicationDetailPayload {
  application: ApplicationItem;
  history: ApplicationHistoryItem[];
}

export const ApplicationsPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [withdrawingAppId, setWithdrawingAppId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');

  // 1. Fetch All Applications for Authenticated Student
  const {
    data: applications = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApplicationItem[]>({
    queryKey: ['student-applications'],
    queryFn: () => api.get<ApplicationItem[]>('/applications/me'),
  });

  // 2. Fetch Selected Application Detail + Status History Timeline
  const {
    data: selectedDetail,
    isLoading: isDetailLoading,
  } = useQuery<ApplicationDetailPayload>({
    queryKey: ['student-application-detail', selectedAppId],
    queryFn: () => api.get<ApplicationDetailPayload>(`/applications/${selectedAppId}`),
    enabled: !!selectedAppId,
  });

  // 3. Withdraw Application Mutation
  const withdrawMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.patch(`/applications/${id}/withdraw`, { reason }),
    onSuccess: () => {
      success('Application Withdrawn', 'Your application has been safely withdrawn.');
      queryClient.invalidateQueries({ queryKey: ['student-applications'] });
      if (selectedAppId) {
        queryClient.invalidateQueries({ queryKey: ['student-application-detail', selectedAppId] });
      }
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
      setWithdrawingAppId(null);
      setWithdrawReason('');
    },
    onError: (err: any) => {
      toastError('Withdrawal Failed', err.message || 'Could not withdraw application.');
    },
  });

  // Filter logic
  const filteredApps = applications.filter((app) => {
    const jobTitle = typeof app.job === 'object' ? app.job?.title || '' : '';
    const companyName =
      typeof app.job === 'object' && app.job?.company && typeof app.job.company === 'object'
        ? app.job.company.name
        : '';
    const matchesSearch =
      jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      companyName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') {
      return ['applied', 'screening', 'shortlisted', 'assessment', 'interview'].includes(
        app.currentStatus
      );
    }
    if (statusFilter === 'offered') {
      return app.currentStatus === 'offered';
    }
    if (statusFilter === 'closed') {
      return ['rejected', 'withdrawn'].includes(app.currentStatus);
    }
    return app.currentStatus === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'offered':
        return <Badge variant="success">Offer Extended</Badge>;
      case 'interview':
        return <Badge variant="electric">Interview Stage</Badge>;
      case 'shortlisted':
        return <Badge variant="teal">Shortlisted</Badge>;
      case 'assessment':
        return <Badge variant="warning">Assessment Assigned</Badge>;
      case 'screening':
        return <Badge variant="neutral">Under Review</Badge>;
      case 'applied':
        return <Badge variant="default">Applied</Badge>;
      case 'rejected':
        return <Badge variant="danger">Not Selected</Badge>;
      case 'withdrawn':
        return <Badge variant="neutral">Withdrawn</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const formatDateTime = (dateStr: string) => {
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to Load Applications"
        message={error instanceof Error ? error.message : 'Unable to retrieve applications.'}
        onRetry={() => refetch()}
      />
    );
  }

  // Calculate high-level metrics
  const activeCount = applications.filter((a) =>
    ['applied', 'screening', 'shortlisted', 'assessment', 'interview'].includes(a.currentStatus)
  ).length;
  const interviewCount = applications.filter((a) => a.currentStatus === 'interview').length;
  const offeredCount = applications.filter((a) => a.currentStatus === 'offered').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-blue-400" />
            My Applications & Career Pipeline
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track real-time hiring decisions, audit chronological status transitions, and prepare for interviews.
          </p>
        </div>
        <Link to="/student/jobs">
          <Button variant="primary" icon={<Search className="w-4 h-4" />}>
            Discover Jobs
          </Button>
        </Link>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-[#0b1329] border-slate-800/80 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Submissions</p>
          <p className="text-2xl font-bold text-white mt-1">{applications.length}</p>
        </Card>
        <Card className="bg-[#0b1329] border-slate-800/80 p-4">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">In Progress</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">{activeCount}</p>
        </Card>
        <Card className="bg-[#0b1329] border-slate-800/80 p-4">
          <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Interviews</p>
          <p className="text-2xl font-bold text-purple-300 mt-1">{interviewCount}</p>
        </Card>
        <Card className="bg-[#0b1329] border-slate-800/80 p-4">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Offers Received</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{offeredCount}</p>
        </Card>
      </div>

      {/* Controls: Search and Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active Pipeline' },
            { id: 'interview', label: 'Interviews' },
            { id: 'offered', label: 'Offers' },
            { id: 'closed', label: 'Closed / Withdrawn' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[#0e172e] text-slate-400 hover:text-slate-200 hover:bg-[#13203f]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by job or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0b1329] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Applications Listing */}
      {filteredApps.length === 0 ? (
        <EmptyState
          title={searchQuery || statusFilter !== 'all' ? 'No Matching Applications' : 'No Applications Submitted'}
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Try modifying your search query or tab filter.'
              : 'You have not submitted any applications yet. Explore matched jobs and submit with your verified resume.'
          }
          action={{
            label: 'Browse Available Jobs',
            onClick: () => window.location.assign('/student/jobs'),
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredApps.map((app) => {
            const job = typeof app.job === 'object' ? app.job : null;
            const company = job?.company && typeof job.company === 'object' ? job.company : null;
            const companyName = company?.name || 'Partner Company';
            const canWithdraw = app.currentStatus !== 'withdrawn' && app.currentStatus !== 'rejected';

            return (
              <Card
                key={app._id}
                className="bg-[#0b1329] border-slate-800 hover:border-slate-700/80 transition-all p-5 shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-semibold text-white tracking-tight">
                        {job?.title || 'Job Opening'}
                      </h3>
                      {getStatusBadge(app.currentStatus)}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1.5 font-medium text-slate-300">
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        {companyName}
                      </span>
                      {job?.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {job.location} ({job.workplaceType?.replace('_', ' ') || 'on-site'})
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        Applied on {formatDateTime(app.appliedAt)}
                      </span>
                      {app.resume && typeof app.resume === 'object' && (
                        <span className="flex items-center gap-1.5 text-blue-400/90 font-mono">
                          <FileText className="w-3.5 h-3.5" />
                          {app.resume.title} (v{app.resume.version})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                    {/* View Details / Timeline */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedAppId(app._id)}
                      className="border-slate-700 text-slate-300 hover:text-white"
                    >
                      Status History
                    </Button>

                    {/* Interview Prep shortcut if in active stages */}
                    {['screening', 'shortlisted', 'assessment', 'interview'].includes(app.currentStatus) && job?._id && (
                      <Link to={`/student/interview-prep?jobId=${job._id}`}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Sparkles className="w-3.5 h-3.5 text-teal-400" />}
                        >
                          Interview Prep
                        </Button>
                      </Link>
                    )}

                    {/* Withdraw Button */}
                    {canWithdraw && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setWithdrawingAppId(app._id)}
                        className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/20"
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal 1: Chronological Status History & Detail Dialog */}
      <Dialog
        isOpen={!!selectedAppId}
        onClose={() => setSelectedAppId(null)}
        title="Application Status & Chronological History"
        description="Persisted audit trail of recruitment workflow decisions and milestones."
        maxWidth="lg"
      >
        {isDetailLoading || !selectedDetail ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Header Summary */}
            <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-white">
                  {selectedDetail.application.job?.title}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(selectedDetail.application.job?.company as any)?.name} • Applied on{' '}
                  {formatDateTime(selectedDetail.application.appliedAt)}
                </p>
              </div>
              <div>{getStatusBadge(selectedDetail.application.currentStatus)}</div>
            </div>

            {/* Resume & Submission Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#0e172e] border border-slate-800">
                <p className="text-slate-400 font-medium mb-1">Submitted Resume</p>
                <div className="flex items-center gap-2 text-white font-medium">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>{selectedDetail.application.resume?.title || 'Verified ATS Resume'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    v{selectedDetail.application.resume?.version || 1}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0e172e] border border-slate-800">
                <p className="text-slate-400 font-medium mb-1">Compensation / Terms</p>
                <p className="text-white font-medium">
                  {selectedDetail.application.job?.salaryMin
                    ? `${selectedDetail.application.job.salaryCurrency || 'INR'} ${selectedDetail.application.job.salaryMin.toLocaleString()} - ${selectedDetail.application.job.salaryMax?.toLocaleString() || 'DOE'}`
                    : 'Disclosed in interview stage'}
                </p>
              </div>
            </div>

            {/* Cover letter if present */}
            {selectedDetail.application.coverLetter && (
              <div className="p-3.5 rounded-lg bg-[#0e172e] border border-slate-800 text-xs space-y-1">
                <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  Candidate Note / Cover Letter
                </p>
                <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedDetail.application.coverLetter}
                </p>
              </div>
            )}

            {/* Chronological Status History Timeline */}
            <div className="space-y-3">
              <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Workflow History Log ({selectedDetail.history.length} Events)
              </h5>

              {selectedDetail.history.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-[#070d18] rounded-lg border border-slate-800">
                  No subsequent transitions recorded yet.
                </p>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {selectedDetail.history.map((event, idx) => (
                    <div key={event._id || idx} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-[#0b1329] border-2 border-blue-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      </div>

                      <div className="bg-[#0e172e] border border-slate-800/80 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {event.fromStatus && (
                              <span className="text-xs text-slate-400 line-through">
                                {event.fromStatus}
                              </span>
                            )}
                            {event.fromStatus && <ArrowRight className="w-3 h-3 text-slate-600" />}
                            <span className="text-xs font-semibold text-white capitalize">
                              {event.toStatus.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {formatDateTime(event.changedAt)}
                          </span>
                        </div>

                        {event.notes && (
                          <p className="text-xs text-slate-300 bg-[#070d18]/60 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed">
                            {event.notes}
                          </p>
                        )}

                        {event.changedBy && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                            <span>Evaluator:</span>
                            <span className="font-mono text-slate-400">{event.changedBy.role}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setSelectedAppId(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Modal 2: Withdraw Confirmation Dialog */}
      <Dialog
        isOpen={!!withdrawingAppId}
        onClose={() => {
          setWithdrawingAppId(null);
          setWithdrawReason('');
        }}
        title="Withdraw Job Application"
        description="Are you sure you want to withdraw your application? This decision cannot be reversed."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Withdrawing your candidacy notifies the hiring committee and cancels any pending interview or assessment scheduling.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Reason for withdrawal (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g., Accepted another offer, scheduling conflict, etc."
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
              className="w-full bg-[#070d18] border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setWithdrawingAppId(null);
                setWithdrawReason('');
              }}
              disabled={withdrawMutation.isPending}
            >
              Keep Application
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (withdrawingAppId) {
                  withdrawMutation.mutate({ id: withdrawingAppId, reason: withdrawReason });
                }
              }}
              isLoading={withdrawMutation.isPending}
            >
              Confirm Withdrawal
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
