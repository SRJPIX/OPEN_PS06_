import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  ShieldAlert,
  MapPin,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { DuplicateCandidateItem } from '../../types/officer';

export const DuplicateReviewPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [selectedPair, setSelectedPair] = useState<{
    primaryJob: any;
    duplicate: any;
  } | null>(null);
  const [mergeNotes, setMergeNotes] = useState<string>('');

  const { data, isLoading, isError, error, refetch } = useQuery<{
    candidates: DuplicateCandidateItem[];
    total: number;
  }>({
    queryKey: ['officer-duplicate-jobs'],
    queryFn: () => api.get<{ candidates: DuplicateCandidateItem[]; total: number }>('/jobs/duplicates/all'),
  });

  const mergeMutation = useMutation({
    mutationFn: async ({
      primaryJobId,
      duplicateJobId,
      notes,
    }: {
      primaryJobId: string;
      duplicateJobId: string;
      notes: string;
    }) => {
      return api.post('/jobs/merge', {
        primaryJobId,
        duplicateJobId,
        notes,
      });
    },
    onSuccess: () => {
      success('Merge Complete', 'The duplicate opening was merged into the primary job and archived.');
      queryClient.invalidateQueries({ queryKey: ['officer-duplicate-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['officer-jobs'] });
      setSelectedPair(null);
      setMergeNotes('');
    },
    onError: (err: any) => {
      toastError(
        'Merge Blocked',
        err?.message || 'Cannot merge distinct requisitions or unauthorized job.'
      );
    },
  });

  const candidates = data?.candidates || [];

  const handleOpenMergeDialog = (primaryJob: any, duplicate: any) => {
    setSelectedPair({ primaryJob, duplicate });
    setMergeNotes(`Merged duplicate "${duplicate.title}" into canonical requisition.`);
  };

  const handleConfirmMerge = () => {
    if (!selectedPair) return;
    mergeMutation.mutate({
      primaryJobId: selectedPair.primaryJob._id,
      duplicateJobId: selectedPair.duplicate.jobId,
      notes: mergeNotes,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Duplicate Opening Review & Reconciliation
            </h1>
            <Badge variant="warning" size="sm" dot>
              {candidates.length} Detected Pairs
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Review suspected duplicate job postings across channels and merge provenance without corrupting distinct requisitions.
          </p>
        </div>
      </div>

      {/* Critical Rule Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3.5 text-xs text-amber-200 leading-relaxed">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white block mb-0.5">
            Institutional Safeguard: Distinct Requisition Protection
          </span>
          Evidra&apos;s authoritative deduplication engine prevents blindly merging distinct job openings.
          Positions with different Requisition IDs are treated as separate headcounts even if titles and company names match identically.
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <ErrorState
          title="Could not inspect duplicate openings"
          message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !isError && candidates.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 className="w-8 h-8 text-emerald-400" />}
          title="No suspect duplicates detected"
          description="Your job catalog is clean. All active requisitions are verified unique."
        />
      )}

      {/* Duplicate Candidates List */}
      {!isLoading && !isError && candidates.length > 0 && (
        <div className="space-y-6">
          {candidates.map((pair, idx) => {
            const primary = pair.job;
            return (
              <Card key={idx} className="border-slate-800 bg-[#0b1329] overflow-hidden">
                <CardHeader className="bg-[#070d18] border-b border-slate-800/80 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Primary Requisition:
                      </span>
                      <span className="font-bold text-white text-sm">{primary.title}</span>
                      <span className="text-xs text-slate-400">({primary.company?.name})</span>
                    </div>
                    {primary.requisitionId && (
                      <span className="font-mono text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        Req ID: {primary.requisitionId}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {pair.duplicates.map((dup, dupIdx) => {
                    const hasDifferingReqIds =
                      primary.requisitionId &&
                      dup.requisitionId &&
                      primary.requisitionId.trim().toLowerCase() !==
                        dup.requisitionId.trim().toLowerCase();

                    return (
                      <div
                        key={dupIdx}
                        className="p-4 rounded-xl bg-[#070d18] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-bold text-sm text-slate-200">
                              Candidate Duplicate: {dup.title}
                            </span>
                            <Badge
                              variant={dup.similarityScore >= 85 ? 'warning' : 'neutral'}
                              size="sm"
                            >
                              {dup.similarityScore}% Similarity Match
                            </Badge>
                            {dup.requisitionId ? (
                              <span
                                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                                  hasDifferingReqIds
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                Req: {dup.requisitionId}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">
                                (No Requisition ID on duplicate)
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span>Location: {dup.location}</span>
                          </div>

                          {/* Match reasons */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                            <span className="text-slate-500 text-[11px]">Flagged reasons:</span>
                            {dup.reasons?.map((reason: string, rIdx: number) => (
                              <span
                                key={rIdx}
                                className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>

                          {hasDifferingReqIds && (
                            <div className="text-[11px] text-rose-400 flex items-center gap-1.5 pt-1 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Blocked from merging: Distinct Requisition IDs (&quot;{primary.requisitionId}&quot; vs &quot;{dup.requisitionId}&quot;).
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 self-end md:self-center">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<GitMerge className="w-3.5 h-3.5" />}
                            disabled={hasDifferingReqIds}
                            onClick={() => handleOpenMergeDialog(primary, dup)}
                          >
                            Reconcile & Merge
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Merge Confirmation Dialog */}
      {selectedPair && (
        <Dialog
          isOpen={!!selectedPair}
          onClose={() => setSelectedPair(null)}
          maxWidth="md"
          title="Confirm Requisition Reconciliation"
          description="Merge duplicate opening into canonical primary job. Source URLs will be combined and duplicate will be archived."
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="ghost" size="sm" onClick={() => setSelectedPair(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={mergeMutation.isPending}
                icon={<GitMerge className="w-3.5 h-3.5" />}
                onClick={handleConfirmMerge}
              >
                Confirm & Merge Jobs
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 space-y-2">
              <div className="text-slate-300">
                <span className="font-semibold text-white">Primary Canonical Job:</span>{' '}
                {selectedPair.primaryJob.title}
              </div>
              <div className="text-slate-300">
                <span className="font-semibold text-white">Duplicate Opening to Merge:</span>{' '}
                {selectedPair.duplicate.title}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Audit Reconciliation Notes
              </label>
              <textarea
                rows={3}
                className="w-full bg-[#070d18] border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none text-xs"
                value={mergeNotes}
                onChange={(e) => setMergeNotes(e.target.value)}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
