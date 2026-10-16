import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Search,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  History,
  FileText,
  RotateCcw,
  Briefcase,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { ApplicationPipelineItem } from '../../types/officer';

export const ApplicationPipelinePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [department, setDepartment] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Selected for status transition
  const [transitioningApp, setTransitioningApp] = useState<ApplicationPipelineItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('screening');
  const [transitionNotes, setTransitionNotes] = useState<string>('');

  // Selected for chronological history modal
  const [historyAppId, setHistoryAppId] = useState<string | null>(null);

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (statusFilter && statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (department) queryParams.set('department', department);
  if (search.trim()) queryParams.set('search', search.trim());

  const { data, isLoading, isError, error, refetch } = useQuery<{
    applications: ApplicationPipelineItem[];
    meta?: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ['officer-applications', page, limit, statusFilter, department, search],
    queryFn: async () => {
      const res = await api.getWithMeta<ApplicationPipelineItem[]>(
        `/applications?${queryParams.toString()}`
      );
      return {
        applications: Array.isArray(res.data) ? res.data : (res.data as any)?.applications || [],
        meta: res.meta as any,
      };
    },
  });

  const applications = data?.applications || [];
  const meta = data?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };

  // Status History Query for modal
  const { data: historyData, isLoading: isLoadingHistory } = useQuery<{
    application: any;
    history: Array<{
      _id: string;
      fromStatus?: string;
      toStatus: string;
      notes?: string;
      changedAt: string;
      changedBy?: { email: string; role: string };
    }>;
  }>({
    queryKey: ['officer-app-history', historyAppId],
    queryFn: () => api.get<any>(`/applications/${historyAppId}`),
    enabled: !!historyAppId,
  });

  // Authoritative Status Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: async ({
      id,
      toStatus,
      notes,
    }: {
      id: string;
      toStatus: string;
      notes: string;
    }) => {
      return api.patch(`/applications/${id}/status`, { toStatus, notes });
    },
    onSuccess: (_, variables) => {
      success('Status Transitioned', `Application advanced to "${variables.toStatus}".`);
      queryClient.invalidateQueries({ queryKey: ['officer-applications'] });
      queryClient.invalidateQueries({ queryKey: ['officer-dashboard-stats'] });
      setTransitioningApp(null);
      setTransitionNotes('');
    },
    onError: (err: any) => {
      toastError('Transition Disallowed', err?.message || 'Invalid state transition.');
    },
  });

  const handleOpenTransition = (app: ApplicationPipelineItem) => {
    setTransitioningApp(app);
    // Suggest next logical forward step
    switch (app.currentStatus) {
      case 'applied':
        setTargetStatus('screening');
        break;
      case 'screening':
        setTargetStatus('shortlisted');
        break;
      case 'shortlisted':
        setTargetStatus('interview');
        break;
      case 'assessment':
        setTargetStatus('interview');
        break;
      case 'interview':
        setTargetStatus('offered');
        break;
      default:
        setTargetStatus('screening');
    }
    setTransitionNotes('');
  };

  const handleConfirmTransition = () => {
    if (!transitioningApp) return;
    transitionMutation.mutate({
      id: transitioningApp._id,
      toStatus: targetStatus,
      notes: transitionNotes,
    });
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setDepartment('');
    setSearch('');
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'offered':
        return <Badge variant="success" size="sm">Offered</Badge>;
      case 'interview':
        return <Badge variant="electric" size="sm">Interview</Badge>;
      case 'assessment':
        return <Badge variant="teal" size="sm">Assessment</Badge>;
      case 'shortlisted':
        return <Badge variant="electric" size="sm">Shortlisted</Badge>;
      case 'screening':
        return <Badge variant="warning" size="sm">Screening</Badge>;
      case 'rejected':
        return <Badge variant="danger" size="sm">Rejected</Badge>;
      case 'withdrawn':
        return <Badge variant="neutral" size="sm">Withdrawn</Badge>;
      default:
        return <Badge variant="neutral" size="sm">Applied</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Application Pipeline Operations
            </h1>
            <Badge variant="teal" size="sm">
              {meta.total} Applications
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Track student applications, execute authoritative backend stage transitions, and audit complete candidate status histories.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-800 bg-[#0b1329] p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-3.5">
          <Input
            placeholder="Search candidate roll, email, or role..."
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
            <option value="all">All Stages (Full Pipeline)</option>
            <option value="applied">Applied (Initial)</option>
            <option value="screening">Screening</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="assessment">Assessment</option>
            <option value="interview">Interview</option>
            <option value="offered">Offered (Hired)</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </select>

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Departments</option>
            <option value="Computer Science">Computer Science & Eng.</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Electronics">Electronics & Comm.</option>
            <option value="Electrical">Electrical Eng.</option>
            <option value="Mechanical">Mechanical Eng.</option>
          </select>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-400">
          <div>
            Showing <span className="text-white font-semibold">{applications.length}</span> of{' '}
            <span className="text-white font-semibold">{meta.total}</span> pipeline entries
          </div>
          {(statusFilter !== 'all' || department || search) && (
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
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <ErrorState
          title="Could not load application pipeline"
          message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !isError && applications.length === 0 && (
        <EmptyState
          icon={<Layers className="w-8 h-8 text-slate-500" />}
          title="No applications match the filter"
          description="Try broadening the status stage or resetting your search keywords."
        />
      )}

      {/* Applications List */}
      {!isLoading && !isError && applications.length > 0 && (
        <div className="space-y-3.5">
          {applications.map((app) => (
            <Card
              key={app._id}
              className="border-slate-800 bg-[#0b1329] hover:border-slate-700 transition-all p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-base font-bold text-white tracking-tight">
                    {app.student?.rollNumber || 'Candidate'}
                  </span>
                  <span className="text-xs text-slate-400">({app.student?.user?.email})</span>
                  {getStatusBadge(app.currentStatus)}
                  <span className="text-xs text-slate-400">
                    &bull; CGPA: {app.student?.cgpa?.toFixed(2) || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
                  <span className="font-semibold text-white flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                    {app.job?.title}
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-slate-400">{app.job?.company?.name}</span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-slate-400 capitalize">{app.job?.location}</span>
                </div>

                <div className="flex items-center gap-3 pt-1 text-xs text-slate-400 flex-wrap">
                  <span>Applied on: {new Date(app.appliedAt).toLocaleDateString()}</span>
                  {app.resume && (
                    <span className="flex items-center gap-1 text-slate-300">
                      <FileText className="w-3 h-3 text-slate-400" />
                      Resume: {app.resume.title} (v{app.resume.version})
                    </span>
                  )}
                  {app.coverLetter && (
                    <span className="text-slate-400 italic truncate max-w-sm">
                      &quot;{app.coverLetter}&quot;
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<History className="w-3.5 h-3.5 text-slate-400" />}
                  onClick={() => setHistoryAppId(app._id)}
                >
                  Audit History
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  onClick={() => handleOpenTransition(app)}
                >
                  Advance Stage
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !isError && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">
            Page {meta.page} of {meta.totalPages} ({meta.total} total applications)
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

      {/* Transition Modal */}
      {transitioningApp && (
        <Dialog
          isOpen={!!transitioningApp}
          onClose={() => setTransitioningApp(null)}
          maxWidth="md"
          title="Update Application Status"
          description={`Execute authorized state transition for candidate ${transitioningApp.student?.rollNumber} applying to ${transitioningApp.job?.title}.`}
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="ghost" size="sm" onClick={() => setTransitioningApp(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={transitionMutation.isPending}
                onClick={handleConfirmTransition}
              >
                Confirm Transition
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block text-[11px]">Current Status:</span>
                <span className="text-white font-bold text-sm capitalize">
                  {transitioningApp.currentStatus}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <div>
                <span className="text-slate-400 block text-[11px]">Target Next Status:</span>
                <span className="text-blue-400 font-bold text-sm capitalize">{targetStatus}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Pipeline Stage
              </label>
              <select
                className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
              >
                <option value="screening">Screening</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="assessment">Technical Assessment</option>
                <option value="interview">Interview</option>
                <option value="offered">Offer Extended (Hired)</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Audit Transition Notes
              </label>
              <textarea
                rows={3}
                placeholder="Reason or interview feedback notes..."
                className="w-full bg-[#070d18] border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none text-xs"
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
              />
            </div>
          </div>
        </Dialog>
      )}

      {/* History Timeline Modal */}
      {historyAppId && (
        <Dialog
          isOpen={!!historyAppId}
          onClose={() => setHistoryAppId(null)}
          maxWidth="md"
          title="Application Status Timeline"
          description="Chronological transition log and audit trail for this application."
          footer={
            <div className="flex justify-end w-full">
              <Button variant="ghost" size="sm" onClick={() => setHistoryAppId(null)}>
                Close Timeline
              </Button>
            </div>
          }
        >

          <div className="py-3 max-h-[60vh] overflow-y-auto">
            {isLoadingHistory ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !historyData?.history || historyData.history.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No history records logged.</p>
            ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
                {historyData.history.map((hist, idx) => (
                  <div key={hist._id || idx} className="relative flex items-start gap-4 text-xs">
                    <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 z-10">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="p-3 rounded-xl bg-[#070d18] border border-slate-800 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-white capitalize">
                          {hist.fromStatus ? `${hist.fromStatus} → ${hist.toStatus}` : hist.toStatus}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          {new Date(hist.changedAt).toLocaleString()}
                        </span>
                      </div>
                      {hist.notes && (
                        <p className="text-slate-300 mt-1 leading-relaxed text-[11px]">
                          {hist.notes}
                        </p>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1">
                        Changed by: {hist.changedBy?.email || 'Authorized Evaluator'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
};
