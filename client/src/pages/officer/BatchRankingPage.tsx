import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Users,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { BatchRankCandidate } from '../../types/officer';
import type { JobItem } from '../../types/student';

export const BatchRankingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { success, error: toastError } = useToast();

  const initialJobId = searchParams.get('jobId') || '';

  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId);
  const [batchYear, setBatchYear] = useState<string>('2026');
  const [department, setDepartment] = useState<string>('');
  const [eligibilityFilter, setEligibilityFilter] = useState<string>('ALL');
  const [minScore] = useState<string>('0');
  const [requiredWeight, setRequiredWeight] = useState<number>(3.0);
  const [preferredWeight, setPreferredWeight] = useState<number>(1.0);

  // Evidence inspection modal state
  const [inspectedCandidate, setInspectedCandidate] = useState<BatchRankCandidate | null>(null);

  // Load available jobs for selection
  const { data: jobsData } = useQuery<{ jobs: JobItem[] }>({
    queryKey: ['officer-match-jobs'],
    queryFn: async () => {
      const res = await api.getWithMeta<JobItem[]>('/jobs?limit=50&status=open');
      const list = Array.isArray(res.data) ? res.data : (res.data as any)?.jobs || [];
      if (!selectedJobId && list.length > 0) {
        setSelectedJobId(list[0]._id);
      }
      return { jobs: list };
    },
  });

  const jobsList = jobsData?.jobs || [];

  // Query candidate rankings
  const rankQueryParams = new URLSearchParams({
    graduationYear: batchYear,
    eligibility: eligibilityFilter,
    requiredSkillWeight: requiredWeight.toString(),
    preferredSkillWeight: preferredWeight.toString(),
    limit: '50',
  });
  if (department) rankQueryParams.set('department', department);
  if (minScore && Number(minScore) > 0) rankQueryParams.set('minScore', minScore);

  const {
    data: rankData,
    isLoading: isLoadingRankings,
    isError: isRankError,
    error: rankError,
    refetch: refetchRankings,
  } = useQuery<{
    job: any;
    scoringPolicy: any;
    rankings: BatchRankCandidate[];
  }>({
    queryKey: [
      'officer-batch-rankings',
      selectedJobId,
      batchYear,
      department,
      eligibilityFilter,
      minScore,
      requiredWeight,
      preferredWeight,
    ],
    queryFn: () =>
      api.get<{ job: any; scoringPolicy: any; rankings: BatchRankCandidate[] }>(
        `/matching/jobs/${selectedJobId}/rank?${rankQueryParams.toString()}`
      ),
    enabled: !!selectedJobId,
  });

  const rankings = rankData?.rankings || [];

  // CSV Export handler
  const handleExportCsv = async () => {
    if (!selectedJobId) return;
    try {
      const csvText = await api.get<string>(
        `/matching/jobs/${selectedJobId}/export/csv?${rankQueryParams.toString()}`
      );
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rankings-${selectedJobId}-batch-${batchYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      success('CSV Exported', 'Ranked candidates exported successfully.');
    } catch (err: any) {
      toastError('Export Failed', err?.message || 'Could not export rankings.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Cohort Match & Ranking Engine
            </h1>
            <Badge variant="electric" size="sm">
              Deterministic Algorithm
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Select a target requisition and graduating batch to compute evidence-backed fit scores, analyze skill gaps, and inspect verified proof.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4 text-emerald-400" />}
            disabled={!selectedJobId || rankings.length === 0}
            onClick={handleExportCsv}
          >
            Export Rankings CSV
          </Button>
        </div>
      </div>

      {/* Control Panel: Job & Batch Selection */}
      <Card className="border-slate-800 bg-[#0b1329] p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* 1. Job Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Target Requisition
            </label>
            <select
              className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
            >
              {jobsList.map((job) => (
                <option key={job._id} value={job._id}>
                  {job.title} ({typeof job.company === 'object' ? job.company?.name : 'Company'})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Batch Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Graduating Batch Year
            </label>
            <select
              className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
            >
              <option value="2026">Batch 2026 (Final Year)</option>
              <option value="2025">Batch 2025 (Graduated)</option>
              <option value="2027">Batch 2027 (Pre-Final Year)</option>
              <option value="2024">Batch 2024</option>
            </select>
          </div>

          {/* 3. Department */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Department Filter
            </label>
            <select
              className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All Departments</option>
              <option value="Computer Science">Computer Science & Eng.</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Electronics">Electronics & Comm.</option>
              <option value="Electrical">Electrical Eng.</option>
              <option value="Mechanical">Mechanical Eng.</option>
            </select>
          </div>

          {/* 4. Eligibility */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Eligibility Status
            </label>
            <select
              className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
            >
              <option value="ALL">Show All Candidates</option>
              <option value="ELIGIBLE">Eligible Candidates Only</option>
              <option value="INELIGIBLE">Ineligible Candidates Only</option>
            </select>
          </div>
        </div>

        {/* Algorithm Weight Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-slate-800/80">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Required Skills Multiplier:</span>
              <span className="font-bold text-blue-400">{requiredWeight.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.5"
              value={requiredWeight}
              onChange={(e) => setRequiredWeight(parseFloat(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Preferred Skills Multiplier:</span>
              <span className="font-bold text-teal-400">{preferredWeight.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.5"
              value={preferredWeight}
              onChange={(e) => setPreferredWeight(parseFloat(e.target.value))}
              className="w-full accent-teal-500 cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {isLoadingRankings && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isRankError && (
        <ErrorState
          title="Could not compute batch rankings"
          message={rankError instanceof Error ? rankError.message : 'Please check your connection and retry.'}
          onRetry={() => refetchRankings()}
        />
      )}

      {/* Empty State */}
      {!isLoadingRankings && !isRankError && rankings.length === 0 && (
        <EmptyState
          icon={<Users className="w-8 h-8 text-slate-500" />}
          title="No candidates matched the criteria"
          description="Try broadening the graduating batch or resetting the eligibility filter."
        />
      )}

      {/* Ranked Candidate Results */}
      {!isLoadingRankings && !isRankError && rankings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Ranked <span className="font-bold text-white">{rankings.length}</span> students for{' '}
              <span className="text-white font-semibold">{rankData?.job?.title}</span>
            </span>
            <span className="text-slate-500">Deterministic tie-breaking applied</span>
          </div>

          {rankings.map((cand, idx) => {
            const isEligible = cand.eligibility.isEligible;
            return (
              <Card
                key={cand.candidateId}
                className="border-slate-800 bg-[#0b1329] hover:border-slate-700 transition-all p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left: Rank & Academic Profile */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-base shrink-0 ${
                      idx === 0
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-md shadow-amber-900/20'
                        : idx === 1
                        ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30'
                        : idx === 2
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-base font-bold text-white tracking-tight">
                        {cand.rollNumber}
                      </span>
                      <Badge
                        variant={isEligible ? 'success' : 'danger'}
                        size="sm"
                        dot={isEligible}
                      >
                        {cand.eligibility.status}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {cand.department} &bull; CGPA: {cand.cgpa?.toFixed(2) || 'N/A'}
                      </span>
                    </div>

                    {/* Fit Score & Breakdown Bar */}
                    <div className="flex items-center gap-3 pt-1">
                      <div className="text-sm font-extrabold text-white">
                        Fit Score:{' '}
                        <span
                          className={
                            cand.fitScore >= 80
                              ? 'text-emerald-400'
                              : cand.fitScore >= 60
                              ? 'text-blue-400'
                              : 'text-amber-400'
                          }
                        >
                          {cand.fitScore}%
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        (Req: {cand.breakdown.requiredSkillsScore.toFixed(1)} / Pref:{' '}
                        {cand.breakdown.preferredSkillsScore.toFixed(1)})
                      </div>
                    </div>

                    {/* Matched Skills */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                      <span className="text-slate-500 text-[11px] font-medium">Matched:</span>
                      {cand.matchedRequiredSkills.map((sk) => (
                        <span
                          key={sk.skillId}
                          className="text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>{sk.skillName}</span>
                        </span>
                      ))}
                      {cand.matchedPreferredSkills.map((sk) => (
                        <span
                          key={sk.skillId}
                          className="text-[10px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full"
                        >
                          {sk.skillName}
                        </span>
                      ))}
                    </div>

                    {/* Skill Gaps */}
                    {(cand.missingRequiredSkills.length > 0 ||
                      cand.missingPreferredSkills.length > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs">
                        <span className="text-rose-400/90 text-[11px] font-medium">Missing Gaps:</span>
                        {cand.missingRequiredSkills.map((sk) => (
                          <span
                            key={sk.skillId}
                            className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full"
                          >
                            {sk.skillName}*
                          </span>
                        ))}
                        {cand.missingPreferredSkills.map((sk) => (
                          <span
                            key={sk.skillId}
                            className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full"
                          >
                            {sk.skillName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Inspect Evidence Action */}
                <div className="shrink-0 self-end lg:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<FileCheck2 className="w-3.5 h-3.5 text-blue-400" />}
                    onClick={() => setInspectedCandidate(cand)}
                  >
                    Inspect Evidence ({cand.matchedRequiredSkills.length + cand.matchedPreferredSkills.length})
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Inspect Evidence Modal */}
      {inspectedCandidate && (
        <Dialog
          isOpen={!!inspectedCandidate}
          onClose={() => setInspectedCandidate(null)}
          maxWidth="lg"
          title="Candidate Evidence Inspection"
          description={`Verified proof artifacts backing matched competencies for candidate ${inspectedCandidate.rollNumber}.`}
          footer={
            <div className="flex justify-end w-full">
              <Button variant="ghost" size="sm" onClick={() => setInspectedCandidate(null)}>
                Close Inspection
              </Button>
            </div>
          }
        >

          <div className="space-y-4 py-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-white font-bold">
                <span>Roll: {inspectedCandidate.rollNumber}</span>
                <span className="text-emerald-400">Fit Score: {inspectedCandidate.fitScore}%</span>
              </div>
              <p className="text-slate-400">
                Department: {inspectedCandidate.department} &bull; CGPA:{' '}
                {inspectedCandidate.cgpa?.toFixed(2)} &bull; Batch {inspectedCandidate.graduationYear}
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Matched Required Skills Proof
              </h4>
              {inspectedCandidate.matchedRequiredSkills.map((sk) => (
                <div
                  key={sk.skillId}
                  className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{sk.skillName}</span>
                    <Badge variant={sk.isSupported ? 'success' : 'neutral'} size="sm">
                      {sk.isSupported ? 'Evidence Backed' : 'Self-Reported'}
                    </Badge>
                  </div>

                  {sk.evidenceItems && sk.evidenceItems.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {sk.evidenceItems.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-2.5 rounded-lg bg-[#0b1329] border border-slate-800 flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <span className="font-semibold text-slate-200">{ev.title}</span>
                            <span className="text-slate-500 capitalize ml-2">
                              ({ev.type.replace('_', ' ')})
                            </span>
                          </div>
                          {ev.url && (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline flex items-center gap-1 shrink-0 ml-2"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>View Proof</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-[11px] italic">
                      No linked verification artifact. Candidate self-reported this skill.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
