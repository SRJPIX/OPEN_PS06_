import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
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
import type { ResumeClaimItem } from '../../types/officer';

export const ResumeClaimReviewPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(12);
  const [isVerifiedFilter, setIsVerifiedFilter] = useState<string>('false'); // Default to unsupported claims!
  const [claimType, setClaimType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Selected claim for review action
  const [selectedClaim, setSelectedClaim] = useState<ResumeClaimItem | null>(null);
  const [verifyAction, setVerifyAction] = useState<boolean>(true);
  const [confidenceScore, setConfidenceScore] = useState<number>(90);
  const [notes, setNotes] = useState<string>('');

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    isVerified: isVerifiedFilter,
  });
  if (claimType && claimType !== 'all') queryParams.set('claimType', claimType);
  if (search.trim()) queryParams.set('search', search.trim());

  const { data, isLoading, isError, error, refetch } = useQuery<{
    claims: ResumeClaimItem[];
    meta?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      totalUnverified: number;
      totalVerified: number;
    };
  }>({
    queryKey: ['officer-resume-claims', page, limit, isVerifiedFilter, claimType, search],
    queryFn: async () => {
      const res = await api.getWithMeta<ResumeClaimItem[]>(`/resumes/claims?${queryParams.toString()}`);
      return {
        claims: Array.isArray(res.data) ? res.data : (res.data as any)?.claims || [],
        meta: res.meta as any,
      };
    },
  });

  const claims = data?.claims || [];
  const meta = data?.meta || {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
    totalUnverified: 0,
    totalVerified: 0,
  };

  const verifyMutation = useMutation({
    mutationFn: async ({
      id,
      isVerified,
      confidenceScoreVal,
      reviewNotes,
    }: {
      id: string;
      isVerified: boolean;
      confidenceScoreVal: number;
      reviewNotes: string;
    }) => {
      return api.post(`/resumes/claims/${id}/verify`, {
        isVerified,
        confidenceScore: confidenceScoreVal,
        notes: reviewNotes,
      });
    },
    onSuccess: (_, variables) => {
      success(
        variables.isVerified ? 'Claim Verified' : 'Claim Marked Unverified',
        'Resume claim review successfully recorded in audit log.'
      );
      queryClient.invalidateQueries({ queryKey: ['officer-resume-claims'] });
      queryClient.invalidateQueries({ queryKey: ['officer-dashboard-stats'] });
      setSelectedClaim(null);
      setNotes('');
    },
    onError: (err: any) => {
      toastError('Verification Failed', err?.message || 'Could not verify resume claim.');
    },
  });

  const handleOpenReview = (claim: ResumeClaimItem, willVerify: boolean) => {
    setSelectedClaim(claim);
    setVerifyAction(willVerify);
    setConfidenceScore(willVerify ? 90 : 20);
    setNotes(
      willVerify
        ? 'Verified after evaluating student portfolio and coursework performance.'
        : 'Unsupported by factual evidence artifact.'
    );
  };

  const handleConfirmReview = () => {
    if (!selectedClaim) return;
    verifyMutation.mutate({
      id: selectedClaim._id,
      isVerified: verifyAction,
      confidenceScoreVal: confidenceScore,
      reviewNotes: notes,
    });
  };

  const clearFilters = () => {
    setIsVerifiedFilter('false');
    setClaimType('all');
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters = isVerifiedFilter !== 'false' || claimType !== 'all' || search;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Resume Claim Audit & Verification
            </h1>
            <Badge variant="warning" size="sm" dot>
              {meta.totalUnverified} Unsupported Claims
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Audit unverified claims made in student resumes against factual evidence artifacts and resolve discrepancies.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-800 bg-[#0b1329] p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-3.5">
          <Input
            placeholder="Search claim text, student roll, or email..."
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={isVerifiedFilter}
            onChange={(e) => {
              setIsVerifiedFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="false">Unsupported Claims Only (Unverified)</option>
            <option value="true">Verified Claims Only</option>
            <option value="all">All Claims</option>
          </select>

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={claimType}
            onChange={(e) => {
              setClaimType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Claim Types</option>
            <option value="skill">Skill Proficiency</option>
            <option value="project">Project Experience</option>
            <option value="experience">Work Experience</option>
            <option value="education">Education</option>
            <option value="achievement">Achievement</option>
          </select>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-400">
          <div>
            Showing <span className="text-white font-semibold">{claims.length}</span> of{' '}
            <span className="text-white font-semibold">{meta.total}</span> claims
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
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <ErrorState
          title="Could not load resume claims"
          message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !isError && claims.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 className="w-8 h-8 text-emerald-400" />}
          title="No claims match your filters"
          description="Try broadening your verification filter or searching for another student."
        />
      )}

      {/* Claims List */}
      {!isLoading && !isError && claims.length > 0 && (
        <div className="space-y-3.5">
          {claims.map((claim) => (
            <Card
              key={claim._id}
              className="border-slate-800 bg-[#0b1329] hover:border-slate-700 transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Badge variant={claim.isVerified ? 'success' : 'warning'} size="sm" dot>
                    {claim.isVerified ? 'Verified Proof' : 'Unsupported Claim'}
                  </Badge>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {claim.claimType}
                  </span>
                  <span className="text-xs text-slate-400">
                    Confidence: <span className="font-bold text-white">{claim.confidenceScore}%</span>
                  </span>
                </div>

                <p className="text-sm font-semibold text-white tracking-tight leading-snug">
                  &ldquo;{claim.text}&rdquo;
                </p>

                <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                  <span className="text-slate-300 font-medium">
                    {claim.student?.rollNumber || 'Student'} ({claim.student?.department})
                  </span>
                  <span>&bull;</span>
                  <span>Resume: {claim.resume?.title || 'Resume'} (v{claim.resume?.version || 1})</span>
                  <span>&bull;</span>
                  <span>Created: {new Date(claim.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Evidence links if any */}
                {claim.evidence && claim.evidence.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 text-xs text-blue-400 flex-wrap">
                    <span className="text-slate-500">Supporting proof:</span>
                    {claim.evidence.map((ev) => (
                      <span key={ev._id} className="bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {ev.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {!claim.isVerified ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    onClick={() => handleOpenReview(claim, true)}
                  >
                    Verify Claim
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                    icon={<XCircle className="w-3.5 h-3.5" />}
                    onClick={() => handleOpenReview(claim, false)}
                  >
                    Mark Unverified
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !isError && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">
            Page {meta.page} of {meta.totalPages} ({meta.total} total claims)
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

      {/* Verify / Unverify Dialog */}
      {selectedClaim && (
        <Dialog
          isOpen={!!selectedClaim}
          onClose={() => setSelectedClaim(null)}
          maxWidth="md"
          title={verifyAction ? 'Verify Resume Claim' : 'Mark Claim Unverified'}
          description={
            verifyAction
              ? 'Confirm evidence validity and assign high confidence weight.'
              : 'Flag this claim as unsupported by factual evidence.'
          }
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="ghost" size="sm" onClick={() => setSelectedClaim(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={verifyMutation.isPending}
                onClick={handleConfirmReview}
              >
                Save Decision
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block">Claim Text:</span>
              <p className="font-bold text-white text-sm">&ldquo;{selectedClaim.text}&rdquo;</p>
              <p className="text-slate-400 pt-1">
                Candidate: {selectedClaim.student?.rollNumber} &bull; {selectedClaim.student?.department}
              </p>
            </div>

            {verifyAction && (
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Assigned Confidence Score:</span>
                  <span className="text-blue-400 font-bold">{confidenceScore}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={confidenceScore}
                  onChange={(e) => setConfidenceScore(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Audit Review Notes
              </label>
              <textarea
                rows={3}
                className="w-full bg-[#070d18] border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none text-xs"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
