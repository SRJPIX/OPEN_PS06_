import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FileText,
  Printer,
  Sparkles,
  CheckCircle2,
  Trash2,
  Download,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { queryClient } from '../../lib/queryClient';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type {
  ResumeItem,
  ResumeClaimItem,
  JobItem,
  ResumeProvenanceResponse,
} from '../../types/student';

interface ResumeDetailResponse {
  resume: ResumeItem;
  claims: ResumeClaimItem[];
}

interface JobsResponse {
  jobs: JobItem[];
}

export const ResumeBuilderPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { success, error: toastError } = useToast();
  const [searchParams] = useSearchParams();

  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'provenance' | 'exclusions'>('preview');
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [targetJobId, setTargetJobId] = useState(searchParams.get('jobId') || '');
  const [targetRole, setTargetRole] = useState('Fullstack Engineer');
  const [resumeTitle, setResumeTitle] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // 1. Fetch Resumes
  const {
    data: resumesData,
    isLoading: isResumesLoading,
    isError: isResumesError,
    error: resumesError,
    refetch: refetchResumes,
  } = useQuery<ResumeItem[]>({
    queryKey: ['student-resumes'],
    queryFn: () => api.get<ResumeItem[]>('/resumes/me'),
  });

  // Select first resume by default or when created
  useEffect(() => {
    if (resumesData && resumesData.length > 0 && !selectedResumeId) {
      setSelectedResumeId(resumesData[0]._id);
    }
  }, [resumesData, selectedResumeId]);

  // 2. Fetch Active Jobs for generation target
  const { data: jobsData } = useQuery<JobsResponse>({
    queryKey: ['student-jobs-for-resume'],
    queryFn: () => api.get<JobsResponse>('/jobs?limit=20'),
  });

  // 3. Fetch Selected Resume Detail
  const {
    data: resumeDetail,
    isLoading: isDetailLoading,
  } = useQuery<ResumeDetailResponse>({
    queryKey: ['resume-detail', selectedResumeId],
    queryFn: () => api.get<ResumeDetailResponse>(`/resumes/${selectedResumeId}`),
    enabled: !!selectedResumeId,
  });

  // 4. Fetch Selected Resume Provenance
  const {
    data: provenanceData,
    isLoading: isProvenanceLoading,
  } = useQuery<ResumeProvenanceResponse>({
    queryKey: ['resume-provenance', selectedResumeId],
    queryFn: () => api.get<ResumeProvenanceResponse>(`/resumes/${selectedResumeId}/provenance`),
    enabled: !!selectedResumeId && activeTab === 'provenance',
  });

  // 5. Generate Resume Mutation
  const generateMutation = useMutation({
    mutationFn: (payload: { jobId?: string; targetRole?: string; title?: string }) =>
      api.post<{ resume: ResumeItem; claims: ResumeClaimItem[] }>('/resumes/generate', payload),
    onSuccess: (res) => {
      success('Resume Generated', 'Tailored resume created with verified claims.');
      setIsGenerateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['student-resumes'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
      if (res?.resume?._id) {
        setSelectedResumeId(res.resume._id);
        setActiveTab('preview');
      }
    },
    onError: (err: any) => {
      toastError('Generation Failed', err.message || 'Could not generate resume.');
    },
  });

  // 6. Delete Resume Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/resumes/${id}`),
    onSuccess: () => {
      success('Resume Deleted', 'Resume removed successfully.');
      setSelectedResumeId(null);
      queryClient.invalidateQueries({ queryKey: ['student-resumes'] });
    },
    onError: (err: any) => {
      toastError('Deletion Failed', err.message || 'Could not delete resume.');
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!activeResume) return;
    try {
      setIsDownloadingPdf(true);
      const blob = await api.getBlob(`/resumes/${activeResume._id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (activeResume.title || 'Resume').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${safeTitle}_v${activeResume.version}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      success('PDF Downloaded', 'ATS-friendly selectable text PDF saved.');
    } catch (err: any) {
      toastError('Download Error', err.message || 'Could not download PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isResumesLoading) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (isResumesError) {
    return (
      <ErrorState
        title="Could not load resumes"
        message={resumesError instanceof Error ? resumesError.message : 'Connection failed'}
        onRetry={() => refetchResumes()}
      />
    );
  }

  const resumes = resumesData || [];
  const activeResume = resumeDetail?.resume;
  const claims = resumeDetail?.claims || [];

  const skillClaims = claims.filter((c) => c.claimType === 'skill');
  const projectClaims = claims.filter((c) => c.claimType === 'project');
  const excludedItems = activeResume?.excludedItems || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Truthful Resume Generator
            </h1>
            <Badge variant="electric" size="sm" dot>
              Zero-Hallucination Verified
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Generate verifiable, ATS-friendly resumes where every bullet point is backed by audited
            evidence and unverified claims are omitted.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/student/resume-analysis">
            <Button variant="outline" size="sm" icon={<FileText className="w-3.5 h-3.5" />}>
              Audit Uploaded Resume
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            icon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => setIsGenerateModalOpen(true)}
          >
            Generate Tailored Resume
          </Button>
        </div>
      </div>

      {resumes.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-slate-500" />}
          title="No evidence-backed resumes yet"
          description="Generate a tailored resume aligned with open jobs or target roles to apply with verified claims."
          action={{
            label: 'Generate My First Resume',
            onClick: () => setIsGenerateModalOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Resumes List */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Saved Resumes ({resumes.length})
            </h3>
            <div className="space-y-2.5">
              {resumes.map((r) => {
                const isSelected = selectedResumeId === r._id;
                return (
                  <div
                    key={r._id}
                    onClick={() => setSelectedResumeId(r._id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#111d38] border-blue-500 shadow-md shadow-blue-600/10'
                        : 'bg-[#0b1329] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">{r.title}</h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          Role: {r.targetRole || 'General'} &bull; v{r.version}
                        </p>
                      </div>
                      <Badge variant={r.status === 'verified' ? 'success' : 'electric'} size="sm">
                        {r.status}
                      </Badge>
                    </div>

                    {r.generationStats && (
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                        <span>{r.generationStats.verifiedSkillsIncluded} Skills</span>
                        <span>&bull;</span>
                        <span>{r.generationStats.projectsIncluded} Projects</span>
                        <span>&bull;</span>
                        <span className="text-emerald-400">
                          {r.generationStats.totalEvidenceLinked} Proofs
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-2.5 border-t border-slate-800/80">
                      <span>{new Date(r.updatedAt).toLocaleDateString()}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this resume and its claims?')) {
                            deleteMutation.mutate(r._id);
                          }
                        }}
                        className="text-slate-500 hover:text-rose-400 p-0.5 transition"
                        title="Delete resume"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Resume & Tabs */}
          <div className="lg:col-span-2 space-y-6">
            {isDetailLoading || !activeResume ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
              </div>
            ) : (
              <>
                {/* Actions & Navigation Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#0b1329] border border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      {activeResume.title}
                      <Badge variant="neutral" size="sm">
                        v{activeResume.version}
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeResume.targetRole || 'General'} &bull; {claims.length} Verified Claims Tracked
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Printer className="w-3.5 h-3.5" />}
                      onClick={handlePrint}
                    >
                      Print View
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Download className="w-3.5 h-3.5" />}
                      isLoading={isDownloadingPdf}
                      onClick={handleDownloadPdf}
                    >
                      Download ATS PDF
                    </Button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      activeTab === 'preview'
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    ATS Document Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('provenance')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                      activeTab === 'provenance'
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Evidence Provenance ({claims.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('exclusions')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                      activeTab === 'exclusions'
                        ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Omitted Claims ({excludedItems.length})
                  </button>
                </div>

                {/* Tab 1: ATS Document Preview */}
                {activeTab === 'preview' && (
                  <div
                    id="printable-resume"
                    className="bg-white text-slate-900 rounded-2xl p-8 sm:p-10 shadow-2xl space-y-6 font-sans print:p-0 print:shadow-none print:m-0"
                  >
                    {/* Document Header */}
                    <div className="border-b border-slate-300 pb-5">
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        {profile?.rollNumber || 'Candidate Name'}
                      </h1>
                      <p className="text-sm font-medium text-blue-700 mt-0.5">
                        {activeResume.targetRole || 'Software Development Engineer'}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
                        <span>{user?.email}</span>
                        {profile?.phone && (
                          <>
                            <span>&bull;</span>
                            <span>{profile.phone}</span>
                          </>
                        )}
                        <span>&bull;</span>
                        <span>
                          {profile?.degree} in {profile?.department} (CGPA: {profile?.cgpa})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                        {profile?.links?.github && (
                          <a
                            href={profile.links.github}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            GitHub Profile
                          </a>
                        )}
                        {profile?.links?.linkedin && (
                          <>
                            <span>&bull;</span>
                            <a
                              href={profile.links.linkedin}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              LinkedIn Profile
                            </a>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Professional Summary */}
                    {activeResume.summary && (
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-2">
                          Verified Professional Summary
                        </h2>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {activeResume.summary}
                        </p>
                      </div>
                    )}

                    {/* Verified Skills */}
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-2.5">
                        Technical Skills &amp; Evaluated Proficiencies
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {skillClaims.map((claim) => (
                          <div
                            key={claim._id}
                            className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200"
                          >
                            <span className="font-medium text-slate-800">{claim.text}</span>
                            {claim.isVerified ? (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                Self-Reported
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Project Deliverables */}
                    {projectClaims.length > 0 && (
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-2.5">
                          Evaluated Projects &amp; Deliverables
                        </h2>
                        <div className="space-y-3">
                          {projectClaims.map((claim) => (
                            <div key={claim._id} className="text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800">{claim.text}</span>
                                {claim.isVerified && (
                                  <span className="text-[10px] text-emerald-700 font-medium">
                                    [Audited Proof Linked]
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Education */}
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-2">
                        Academic Credentials
                      </h2>
                      <div className="text-xs text-slate-700">
                        <p className="font-medium">
                          {profile?.degree} in {profile?.department}
                        </p>
                        <p className="text-slate-500">
                          Class of {profile?.graduationYear} &bull; Cumulative CGPA:{' '}
                          <span className="font-semibold text-slate-800">{profile?.cgpa} / 10.0</span>
                        </p>
                      </div>
                    </div>

                    {/* Verification Cryptographic Footer */}
                    <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        Generated by Evidra Placement Intelligence &bull; Verified via University Ledger
                      </span>
                      <span className="font-mono">ID: {activeResume._id}</span>
                    </div>
                  </div>
                )}

                {/* Tab 2: Evidence Provenance Ledger */}
                {activeTab === 'provenance' && (
                  <div className="space-y-4">
                    {isProvenanceLoading ? (
                      <Skeleton className="h-64 rounded-xl" />
                    ) : (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-[#0b1329] border border-slate-800">
                          <h4 className="text-sm font-semibold text-white">Bullet-Level Provenance</h4>
                          <p className="text-xs text-slate-400 mt-1">
                            Every single sentence and skill in this generated resume is traceable to
                            immutable evidence in the student vault.
                          </p>
                        </div>

                        {(provenanceData?.bulletsProvenance || []).map((bp) => (
                          <div
                            key={bp.bulletId}
                            className="p-4 rounded-xl bg-[#0b1329] border border-slate-800 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <Badge variant="neutral" size="sm" className="mb-1.5 uppercase">
                                  {bp.section}
                                </Badge>
                                <p className="text-sm text-slate-200 font-medium">{bp.text}</p>
                              </div>
                              <Badge
                                variant={bp.validationStatus === 'SUPPORTED' ? 'success' : 'warning'}
                                size="sm"
                              >
                                {bp.validationStatus} ({bp.confidenceScore}%)
                              </Badge>
                            </div>

                            {bp.evidence && bp.evidence.length > 0 && (
                              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                  Supporting Vault Artifacts ({bp.evidence.length})
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {bp.evidence.map((ev: any) => (
                                    <div
                                      key={ev._id}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#070d18] border border-slate-700/80 text-xs text-slate-300"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      <span className="font-medium truncate max-w-[200px]">
                                        {ev.title}
                                      </span>
                                      <Badge variant="neutral" size="sm" className="text-[10px]">
                                        {ev.type}
                                      </Badge>
                                      {ev.verificationScore && (
                                        <span className="text-[10px] text-emerald-400 font-mono">
                                          {ev.verificationScore}%
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Omitted Claims & Anti-Hallucination Explanations */}
                {activeTab === 'exclusions' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        Omission Transparency Policy
                      </div>
                      <p className="text-xs text-amber-300/80 mt-1">
                        To guarantee zero hallucinations for campus recruiters, any self-reported
                        profile item lacking verified evidence artifacts is omitted from the ATS
                        document.
                      </p>
                    </div>

                    {excludedItems.length === 0 ? (
                      <EmptyState
                        icon={<CheckCircle2 className="w-8 h-8 text-emerald-500" />}
                        title="Zero Omissions"
                        description="All items in your profile were verified and safely included in this resume."
                      />
                    ) : (
                      <div className="space-y-3">
                        {excludedItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-xl bg-[#0b1329] border border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-semibold text-slate-200">{item.text}</h5>
                              <Badge variant="warning" size="sm">
                                OMITTED ({item.type})
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-400">{item.reason}</p>
                            <div className="pt-2">
                              <Link to="/student/evidence">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-blue-400 hover:text-blue-300 p-0"
                                  icon={<ExternalLink className="w-3 h-3" />}
                                >
                                  Submit Proof to Unlock
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Generate Resume Dialog */}
      <Dialog
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Evidence-Backed Resume"
        description="Select an open job or specify a role. Factual bullet points will be constructed and linked to your verified evidence."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsGenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={generateMutation.isPending}
              onClick={() => {
                generateMutation.mutate({
                  jobId: targetJobId || undefined,
                  targetRole: targetRole.trim(),
                  title: resumeTitle.trim() || undefined,
                });
              }}
            >
              Generate Resume
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          {/* Target Job selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Align with Open Job Requisition (Recommended)
            </label>
            <select
              value={targetJobId}
              onChange={(e) => {
                setTargetJobId(e.target.value);
                const jobsList = Array.isArray(jobsData) ? jobsData : jobsData?.jobs || [];
                const found = jobsList.find((j) => j._id === e.target.value);
                if (found) {
                  setTargetRole(found.title);
                  setResumeTitle(`${found.title} Tailored Resume`);
                }
              }}
              className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
            >
              <option value="">-- No specific job (General role alignment) --</option>
              {(Array.isArray(jobsData) ? jobsData : jobsData?.jobs || []).map((j) => (
                <option key={j._id} value={j._id}>
                  {j.title} &bull; {typeof j.company === 'object' ? j.company?.name : 'Company'}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Target Role Title"
            placeholder="e.g. Senior Backend Engineer"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            required
          />

          <Input
            label="Custom Resume Title (Optional)"
            placeholder="e.g. Google Software Engineering Resume"
            value={resumeTitle}
            onChange={(e) => setResumeTitle(e.target.value)}
          />
        </div>
      </Dialog>
    </div>
  );
};
