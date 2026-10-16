import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck2,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ExternalLink,
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
import type { EvidenceItemWithStudent } from '../../types/officer';

export const EvidenceReviewPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('submitted');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Selected item for evaluation dialog
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItemWithStudent | null>(null);
  const [reviewAction, setReviewAction] = useState<
    'approve' | 'reject' | 'request_evidence' | 'under_review'
  >('approve');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [confidenceScore, setConfidenceScore] = useState<number>(85);
  const [score, setScore] = useState<number>(90);

  const { data: evidenceItems = [], isLoading, isError, error, refetch } = useQuery<
    EvidenceItemWithStudent[]
  >({
    queryKey: ['officer-pending-evidence', statusFilter],
    queryFn: () => {
      const url =
        statusFilter && statusFilter !== 'all'
          ? `/evidence/reviews/pending?status=${statusFilter}`
          : '/evidence/reviews/pending';
      return api.get<EvidenceItemWithStudent[]>(url);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      notes,
      scoreVal,
      confScore,
    }: {
      id: string;
      action: string;
      notes: string;
      scoreVal?: number;
      confScore?: number;
    }) => {
      return api.post(`/evidence/${id}/review`, {
        action,
        notes,
        score: scoreVal,
        confidenceScore: confScore,
      });
    },
    onSuccess: () => {
      success('Evaluation Recorded', 'The evidence record and student skill status have been updated.');
      queryClient.invalidateQueries({ queryKey: ['officer-pending-evidence'] });
      queryClient.invalidateQueries({ queryKey: ['officer-dashboard-stats'] });
      setSelectedEvidence(null);
      setReviewNotes('');
    },
    onError: (err: any) => {
      toastError('Evaluation Failed', err?.message || 'Could not record evidence evaluation.');
    },
  });

  const handleOpenReview = (item: EvidenceItemWithStudent) => {
    setSelectedEvidence(item);
    setReviewAction('approve');
    setConfidenceScore(85);
    setScore(item.score || 90);
    setReviewNotes('');
  };

  const handleConfirmReview = () => {
    if (!selectedEvidence) return;
    reviewMutation.mutate({
      id: selectedEvidence._id,
      action: reviewAction,
      notes: reviewNotes,
      scoreVal: score,
      confScore: confidenceScore,
    });
  };

  const filteredItems = evidenceItems.filter((item) => {
    if (typeFilter && item.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const titleMatch = item.title?.toLowerCase().includes(q);
      const rollMatch = item.student?.rollNumber?.toLowerCase().includes(q);
      const emailMatch = item.student?.user?.email?.toLowerCase().includes(q);
      const skillMatch = item.skills?.some((s) => s.name.toLowerCase().includes(q));
      if (!titleMatch && !rollMatch && !emailMatch && !skillMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Evidence Verification Queue
            </h1>
            <Badge variant="warning" size="sm" dot>
              {filteredItems.length} to Review
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Review submitted student artifacts, assess demonstrated proficiency, and record authoritative approvals or rejections.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-800 bg-[#0b1329] p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Input
            placeholder="Search student roll, skill, or artifact title..."
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="submitted">Status: Submitted (Awaiting Review)</option>
            <option value="under_review">Status: Under Review</option>
            <option value="needs_additional_evidence">Status: Needs Additional Proof</option>
            <option value="all">Status: All Unverified Queue</option>
          </select>

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Evidence Types</option>
            <option value="coding_assessment">Coding Assessment</option>
            <option value="technical_quiz">Technical Quiz</option>
            <option value="evaluated_project">Evaluated Project</option>
            <option value="github_repo">GitHub Repository</option>
            <option value="verified_certification">Verified Certification</option>
            <option value="other_reviewed_evidence">Other Reviewed Evidence</option>
          </select>
        </div>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <ErrorState
          title="Could not load pending evidence"
          message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !isError && filteredItems.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 className="w-8 h-8 text-emerald-400" />}
          title="No pending evidence in queue"
          description="All submitted student artifacts for the current filter criteria have been processed."
          action={{
            label: 'Show All Statuses',
            onClick: () => {
              setStatusFilter('all');
              setTypeFilter('');
              setSearch('');
            },
          }}
        />
      )}

      {/* Evidence Cards List */}
      {!isLoading && !isError && filteredItems.length > 0 && (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <Card
              key={item._id}
              className="border-slate-800 bg-[#0b1329] hover:border-slate-700 transition-all p-5 flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-base font-bold text-white tracking-tight">
                    {item.title}
                  </span>
                  <Badge variant="electric" size="sm">
                    {item.type.replace('_', ' ')}
                  </Badge>
                  <Badge
                    variant={
                      item.status === 'submitted'
                        ? 'warning'
                        : item.status === 'under_review'
                        ? 'neutral'
                        : 'default'
                    }
                    size="sm"
                  >
                    {item.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
                  <span className="font-semibold text-slate-200">
                    {item.student?.rollNumber || 'Student'}
                  </span>
                  <span className="text-slate-500">&bull;</span>
                  <span className="text-slate-400">{item.student?.department}</span>
                  <span className="text-slate-500">&bull;</span>
                  <span className="text-slate-400">Class of {item.student?.graduationYear}</span>
                  {item.student?.cgpa && (
                    <>
                      <span className="text-slate-500">&bull;</span>
                      <span className="text-slate-400">CGPA: {item.student.cgpa.toFixed(2)}</span>
                    </>
                  )}
                </div>

                {item.description && (
                  <p className="text-xs text-slate-400 leading-relaxed max-w-3xl line-clamp-2">
                    {item.description}
                  </p>
                )}

                {/* Targeted Skills Tags */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-slate-400 font-medium">Claims skill:</span>
                  {item.skills?.map((sk) => (
                    <span
                      key={sk._id}
                      className="text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full"
                    >
                      {sk.name}
                    </span>
                  ))}
                  <span className="text-[11px] text-slate-500 ml-2">
                    Submitted: {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                      Proof Link
                    </Button>
                  </a>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FileCheck2 className="w-4 h-4" />}
                  onClick={() => handleOpenReview(item)}
                >
                  Record Evaluation
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      {selectedEvidence && (
        <Dialog
          isOpen={!!selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
          maxWidth="lg"
          title="Evaluate Evidence Submission"
          description="Review student artifact and assign authoritative proficiency confirmation."
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="ghost" size="sm" onClick={() => setSelectedEvidence(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={reviewMutation.isPending}
                onClick={handleConfirmReview}
              >
                Submit Evaluation
              </Button>
            </div>
          }
        >

          <div className="space-y-5 py-3">
            {/* Artifact Context Box */}
            <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-bold text-sm text-white">{selectedEvidence.title}</span>
                <span className="capitalize text-slate-400">
                  {selectedEvidence.type.replace('_', ' ')}
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed">{selectedEvidence.description}</p>
              <div className="flex items-center gap-2 pt-1 text-slate-400">
                <span>Candidate: {selectedEvidence.student?.rollNumber}</span>
                <span>&bull;</span>
                <span>Dept: {selectedEvidence.student?.department}</span>
              </div>
              {selectedEvidence.url && (
                <div className="pt-2">
                  <a
                    href={selectedEvidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Inspect external submission artifact ({selectedEvidence.url})</span>
                  </a>
                </div>
              )}
            </div>

            {/* Decision Action Buttons */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Evaluation Decision
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewAction('approve')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    reviewAction === 'approve'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold shadow-md shadow-emerald-900/20'
                      : 'border-slate-800 bg-[#070d18] text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                  <span className="text-xs">Approve & Verify</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewAction('reject')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    reviewAction === 'reject'
                      ? 'bg-rose-600/20 border-rose-500 text-rose-400 font-bold shadow-md shadow-rose-900/20'
                      : 'border-slate-800 bg-[#070d18] text-slate-400 hover:text-white'
                  }`}
                >
                  <XCircle className="w-5 h-5 mx-auto mb-1 text-rose-400" />
                  <span className="text-xs">Reject</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewAction('request_evidence')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    reviewAction === 'request_evidence'
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-bold shadow-md shadow-amber-900/20'
                      : 'border-slate-800 bg-[#070d18] text-slate-400 hover:text-white'
                  }`}
                >
                  <HelpCircle className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                  <span className="text-xs">Request Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewAction('under_review')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    reviewAction === 'under_review'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-bold shadow-md shadow-blue-900/20'
                      : 'border-slate-800 bg-[#070d18] text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                  <span className="text-xs">Under Review</span>
                </button>
              </div>
            </div>

            {/* Conditional Confidence & Score Controls */}
            {reviewAction === 'approve' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#070d18] border border-slate-800">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
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
                  <span className="text-[10px] text-slate-500">
                    High-confidence skills receive top weight in matching algorithms.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Demonstrated Proficiency Score (0-100)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            {/* Evaluator Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Evaluator Feedback / Audit Notes
              </label>
              <textarea
                rows={3}
                className="w-full bg-[#070d18] border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Add constructive evaluator remarks or reasons for decision..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
