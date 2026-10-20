import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Building2,
  MapPin,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { queryClient } from '../../lib/queryClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import type { JobItem, MatchAnalysis, ResumeItem } from '../../types/student';

interface JobDetailResponse {
  job: JobItem;
}

interface MatchResponse {
  match: MatchAnalysis;
}

export const JobDetailsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [coverLetter, setCoverLetter] = useState('');

  // 1. Fetch Job Details
  const {
    data: jobData,
    isLoading: isJobLoading,
    isError: isJobError,
    error: jobError,
  } = useQuery<JobDetailResponse>({
    queryKey: ['job-detail', jobId],
    queryFn: () => api.get<JobDetailResponse>(`/jobs/${jobId}`),
    enabled: !!jobId,
  });

  // 2. Fetch Deterministic Job Fit Analysis
  const {
    data: matchData,
    isLoading: isMatchLoading,
  } = useQuery<MatchResponse>({
    queryKey: ['job-fit-analysis', jobId],
    queryFn: () => api.get<MatchResponse>(`/matching/jobs/${jobId}/my-fit`),
    enabled: !!jobId,
  });

  // 3. Fetch Student Resumes for the apply modal
  const { data: resumesData } = useQuery<ResumeItem[]>({
    queryKey: ['student-resumes'],
    queryFn: () => api.get<ResumeItem[]>('/resumes/me'),
    enabled: isApplyModalOpen,
  });

  // 4. Submit Application Mutation
  const applyMutation = useMutation({
    mutationFn: (payload: { jobId: string; resumeId: string; coverLetter?: string }) =>
      api.post('/applications', payload),
    onSuccess: () => {
      success('Application Submitted', 'Your candidacy has been submitted with your verified resume.');
      setIsApplyModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['student-applications'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
      navigate('/student/applications');
    },
    onError: (err: any) => {
      toastError('Application Failed', err.message || 'Could not submit application.');
    },
  });

  if (isJobLoading) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (isJobError || !jobData?.job) {
    return (
      <ErrorState
        title="Job Listing Unavailable"
        message={jobError instanceof Error ? jobError.message : 'The job requisition was not found.'}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const job = jobData.job;
  const match = matchData?.match;
  const companyName = typeof job.company === 'object' ? job.company?.name : 'Company';

  const eligibleResumes = (resumesData || []).filter(
    (r) => r.status === 'generated' || r.status === 'verified'
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Back button */}
      <div>
        <Link
          to="/student/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition font-medium"
        >
          <ChevronLeft className="w-4 h-4" /> Back to all jobs
        </Link>
      </div>

      {/* Main Job Banner */}
      <Card className="border-slate-800 bg-[#0b1329] p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {job.title}
              </h1>
              <Badge variant="teal" size="sm" dot>
                {job.status.toUpperCase()}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="flex items-center gap-1.5 font-medium text-white">
                <Building2 className="w-4 h-4 text-slate-400" />
                {companyName}
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <MapPin className="w-4 h-4 text-slate-500" />
                {job.location} ({job.workplaceType.replace('_', ' ')})
              </span>
              <span className="text-slate-600">&bull;</span>
              <Badge variant="electric" size="sm">
                {job.jobType.replace('_', ' ')}
              </Badge>
            </div>

            {/* Compensation & Deadline */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              {(job.salaryRange?.min ?? job.salaryMin) && (
                <span className="text-emerald-400 font-mono font-semibold text-sm">
                  {job.salaryRange?.currency || job.salaryCurrency || 'INR'} {(job.salaryRange?.min ?? job.salaryMin)!.toLocaleString()}
                  {(job.salaryRange?.max ?? job.salaryMax) ? ` - ${(job.salaryRange?.max ?? job.salaryMax)!.toLocaleString()}` : '+'}
                </span>
              )}
              {job.deadline && (
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Application Deadline: {new Date(job.deadline).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => setIsApplyModalOpen(true)}
            >
              Apply With Verified Resume
            </Button>

            <Link to={`/student/interview-prep?jobId=${job._id}`}>
              <Button
                variant="outline"
                size="md"
                className="w-full"
                icon={<Sparkles className="w-4 h-4 text-teal-400" />}
              >
                Launch Interview Prep
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Deterministic Match Explanation Card */}
      <Card className="border-blue-900/40 bg-gradient-to-b from-[#0b1329] to-[#070d18] shadow-2xl">
        <CardHeader className="border-b border-slate-800/80 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <CardTitle>Deterministic Match &amp; Verification Analysis</CardTitle>
              </div>
              <CardDescription>
                Calculated by Evidra Matching Engine v{match?.scoringPolicy?.version || '1.0'} using
                reviewed database records.
              </CardDescription>
            </div>

            {match && (
              <div className="flex items-center gap-4">
                {/* Fit Score */}
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Engine Fit Score
                  </div>
                  <div className="text-3xl font-extrabold text-teal-400 font-mono leading-none mt-0.5">
                    {match.fitScore} <span className="text-sm font-normal text-slate-500">/ 100</span>
                  </div>
                </div>

                {/* Eligibility Badge */}
                <div>
                  {match.eligibility.status === 'MET' ? (
                    <Badge variant="success" size="md" dot>
                      Eligibility Met
                    </Badge>
                  ) : match.eligibility.status === 'NOT_MET' ? (
                    <Badge variant="danger" size="md" dot>
                      Eligibility Failed
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="md" dot>
                      Eligibility Unknown
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {isMatchLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : match ? (
            <>
              {/* Engine Plain Language Explanation */}
              <div className="p-4 rounded-xl bg-[#070d18] border border-blue-500/25">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-300 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  Engine Match Explanation
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed">{match.explanation}</p>
                {match.eligibility.reasons.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Eligibility Audit Check:</span>{' '}
                    {match.eligibility.reasons.join(' ')}
                  </div>
                )}
              </div>

              {/* Supported Skills & Gap Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Supported Skills */}
                <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Supported Skills ({match.supportedSkills.length})
                    </h4>
                  </div>
                  {match.supportedSkills.length === 0 ? (
                    <p className="text-xs text-slate-500">No verified skill claims matched for this job.</p>
                  ) : (
                    <div className="space-y-2">
                      {match.supportedSkills.map((s) => (
                        <div
                          key={s.skillId}
                          className="p-2.5 rounded-lg bg-[#0b1329] border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-white">{s.skillName}</span>
                          <span className="font-mono text-emerald-400 font-semibold">
                            Match: {(s.matchValue * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Skill Gaps */}
                <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Required Skill Gaps ({match.requiredSkillGaps.length})
                    </h4>
                  </div>
                  {match.requiredSkillGaps.length === 0 ? (
                    <p className="text-xs text-emerald-400 font-medium">
                      All required skills are supported by verified evidence!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {match.requiredSkillGaps.map((s) => (
                        <div
                          key={s.skillId}
                          className="p-2.5 rounded-lg bg-[#0b1329] border border-rose-950/40 flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-slate-200">{s.skillName}</span>
                          <span className="text-[11px] text-rose-400 font-medium">Missing Evidence</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Unable to calculate match. Please ensure your student profile has been created.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Job Description & Requirements */}
      <Card className="border-slate-800 bg-[#0b1329]">
        <CardHeader>
          <CardTitle>Role Description &amp; Responsibilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <div className="whitespace-pre-line">{job.description}</div>

          {job.responsibilities && job.responsibilities.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Key Responsibilities:
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                {job.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Required vs Preferred Skills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-2">
                Mandatory Required Skills (Weight 3x):
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {job.requiredSkills?.map((s) => (
                  <span
                    key={s._id}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-[#070d18] border border-blue-500/30 text-blue-300"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-2">
                Preferred Skills (Weight 1x):
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {job.preferredSkills?.map((s) => (
                  <span
                    key={s._id}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-[#070d18] border border-teal-500/30 text-teal-300"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apply Modal */}
      <Dialog
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title={`Apply to ${job.title}`}
        description={`Submit your verified credentials to ${companyName}.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsApplyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={applyMutation.isPending}
              disabled={!selectedResumeId}
              onClick={() => {
                applyMutation.mutate({
                  jobId: job._id,
                  resumeId: selectedResumeId,
                  coverLetter: coverLetter.trim() || undefined,
                });
              }}
            >
              Confirm Application
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          {eligibleResumes.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 space-y-3">
              <div className="font-semibold text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" /> Approved Resume Required
              </div>
              <p>
                Applications require a tailored, evidence-backed resume generated through the platform.
              </p>
              <Link to={`/student/resumes?jobId=${job._id}`}>
                <Button variant="primary" size="sm">
                  Generate Tailored Resume for this Job
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Select Approved Resume <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose an evidence-backed resume --</option>
                  {eligibleResumes.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.title} (v{r.version}) &bull; {r.status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Cover Letter / Candidate Note (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Share any specific context regarding your verified project deliverables..."
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
};
