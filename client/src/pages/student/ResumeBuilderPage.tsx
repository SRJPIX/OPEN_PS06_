import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FileText,
  Printer,
  Sparkles,
  CheckCircle2,
  Trash2,
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
import type { ResumeItem, ResumeClaimItem, JobItem } from '../../types/student';

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
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [targetJobId, setTargetJobId] = useState(searchParams.get('jobId') || '');
  const [targetRole, setTargetRole] = useState('Fullstack Engineer');
  const [resumeTitle, setResumeTitle] = useState('');

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

  // 4. Generate Resume Mutation
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
      }
    },
    onError: (err: any) => {
      toastError('Generation Failed', err.message || 'Could not generate resume.');
    },
  });

  // 5. Delete Resume Mutation
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

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Tailored Resume Builder
            </h1>
            <Badge variant="electric" size="sm" dot>
              Evidence Grounded
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Generate verifiable, ATS-friendly resumes where every bullet point is backed by audited
            evidence.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/student/resume-analysis">
            <Button variant="outline" size="sm" icon={<FileText className="w-3.5 h-3.5" />}>
              Analyze Uploaded Resume
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

          {/* Right Column: Active Resume & PDF Printable Preview */}
          <div className="lg:col-span-2 space-y-6">
            {isDetailLoading || !activeResume ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
              </div>
            ) : (
              <>
                {/* Actions Toolbar */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#0b1329] border border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{activeResume.title}</h3>
                    <p className="text-xs text-slate-400">
                      Version {activeResume.version} &bull; {claims.length} Factual Claims Tracked
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Printer className="w-3.5 h-3.5" />}
                      onClick={handlePrint}
                    >
                      Print / Download PDF
                    </Button>
                  </div>
                </div>

                {/* ATS / Printable Document Preview */}
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
                        Verified Executive Summary
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
                const found = jobsData?.jobs?.find((j) => j._id === e.target.value);
                if (found) {
                  setTargetRole(found.title);
                  setResumeTitle(`${found.title} Tailored Resume`);
                }
              }}
              className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
            >
              <option value="">-- No specific job (General role alignment) --</option>
              {jobsData?.jobs?.map((j) => (
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
