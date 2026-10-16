import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Users,
  Plus,
  CheckCircle2,
  ExternalLink,
  Building,
  Globe,
  Filter,
  Eye,
  Download,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';

interface CompanyProfile {
  _id: string;
  name: string;
  website?: string;
  industry?: string;
  description?: string;
  logoUrl?: string;
}

interface RecruiterJob {
  _id: string;
  title: string;
  department?: string;
  location?: string;
  type?: string;
  status: string;
  salaryRange?: { min?: number; max?: number; currency?: string };
  eligibilityCriteria?: { minCgpa?: number; graduationYears?: number[] };
  requiredSkills?: Array<{ _id: string; name: string }>;
  preferredSkills?: Array<{ _id: string; name: string }>;
  applicationsCount: number;
  applicationsByStatus: Record<string, number>;
  createdAt: string;
}

interface CandidateItem {
  applicationId: string;
  currentStatus: string;
  appliedAt: string;
  resumeVersion?: number;
  resumeId?: string;
  interviewDetails?: { round?: string; scheduledAt?: string };
  offerDetails?: { ctcOffered?: number };
  student: {
    _id: string;
    fullName: string;
    email?: string;
    rollNumber?: string;
    department?: string;
    graduationYear?: number;
    cgpa?: number;
  };
  fitScore: number;
  eligibility: {
    status: 'MET' | 'NOT_MET' | 'CONDITIONAL';
    cgpaMet: boolean;
    backlogsMet: boolean;
    reasons: string[];
  };
  supportedSkills: Array<{ skillId: string; name: string; score: number }>;
  missingRequiredSkills: Array<{ skillId: string; name: string }>;
  missingPreferredSkills: Array<{ skillId: string; name: string }>;
}

interface EvidenceItem {
  _id: string;
  title: string;
  type: string;
  verificationStatus: string;
  score?: number;
  url?: string;
  description?: string;
  verifiedAt?: string;
  skills?: Array<{ _id: string; name: string }>;
}

export const RecruiterDashboard: React.FC = () => {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'candidates' | 'company'>('overview');

  // Selected job for candidate shortlist
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<string>('all');
  const [candidateSearch, setCandidateSearch] = useState<string>('');

  // Modals
  const [evidenceCandidate, setEvidenceCandidate] = useState<{ id: string; name: string } | null>(null);
  const [statusUpdateApp, setStatusUpdateApp] = useState<{ id: string; studentName: string; currentStatus: string } | null>(null);
  const [newStatus, setNewStatus] = useState<string>('under_review');
  const [statusNotes, setStatusNotes] = useState<string>('');
  const [interviewRound, setInterviewRound] = useState<string>('Technical Round 1');
  const [isCreateJobOpen, setIsCreateJobOpen] = useState<boolean>(false);

  // New Job Form State
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobLocation, setJobLocation] = useState('Remote / Hybrid');
  const [jobType, setJobType] = useState('full-time');
  const [jobMinCgpa, setJobMinCgpa] = useState('7.0');

  // 1. Fetch Company Profile
  const { data: companyData, isLoading: isCompanyLoading } = useQuery<{ company: CompanyProfile }>({
    queryKey: ['recruiter-company'],
    queryFn: async () => {
      const res = await api.get<{ company: CompanyProfile }>('/recruiter/company');
      return res;
    },
  });

  // 2. Fetch Recruiter Jobs
  const {
    data: jobsData,
    isLoading: isJobsLoading,
    refetch: refetchJobs,
  } = useQuery<{ company: CompanyProfile; jobs: RecruiterJob[] }>({
    queryKey: ['recruiter-jobs'],
    queryFn: async () => {
      const res = await api.get<{ company: CompanyProfile; jobs: RecruiterJob[] }>('/recruiter/jobs');
      return res;
    },
  });

  // Set default selected job if none selected
  const jobs = jobsData?.jobs || [];
  const activeJobId = selectedJobId || (jobs.length > 0 ? jobs[0]._id : '');

  // 3. Fetch Candidates for Active Job
  const {
    data: candidatesData,
    isLoading: isCandidatesLoading,
    isError: isCandidatesError,
    error: candidatesErr,
    refetch: refetchCandidates,
  } = useQuery<{ job: RecruiterJob; candidates: CandidateItem[] }>({
    queryKey: ['recruiter-candidates', activeJobId],
    queryFn: async () => {
      if (!activeJobId) return { job: {} as RecruiterJob, candidates: [] };
      const res = await api.get<{ job: RecruiterJob; candidates: CandidateItem[] }>(
        `/recruiter/jobs/${activeJobId}/candidates`
      );
      return res;
    },
    enabled: Boolean(activeJobId),
  });

  // 4. Fetch Candidate Evidence
  const { data: evidenceData, isLoading: isEvidenceLoading } = useQuery<{ evidence: EvidenceItem[] }>({
    queryKey: ['recruiter-candidate-evidence', evidenceCandidate?.id],
    queryFn: async () => {
      if (!evidenceCandidate?.id) return { evidence: [] };
      const res = await api.get<{ evidence: EvidenceItem[] }>(
        `/recruiter/candidates/${evidenceCandidate.id}/evidence`
      );
      return res;
    },
    enabled: Boolean(evidenceCandidate?.id),
  });

  // 5. Update Company Mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (payload: Partial<CompanyProfile>) => {
      return api.put<{ company: CompanyProfile }>('/recruiter/company', payload);
    },
    onSuccess: () => {
      success('Company profile updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['recruiter-company'] });
    },
    onError: (err: any) => {
      toastError(err.message || 'Failed to update company profile');
    },
  });

  // 6. Update Application Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      appId,
      status,
      notes,
      round,
    }: {
      appId: string;
      status: string;
      notes?: string;
      round?: string;
    }) => {
      if (status === 'interview') {
        return api.patch(`/applications/${appId}/interview`, {
          round: round || 'Technical Interview',
          scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
          meetingLink: 'https://meet.google.com/evidra-interview',
          notes,
        });
      }
      return api.patch(`/applications/${appId}/status`, {
        status,
        notes: notes || `Status updated to ${status} by recruiter`,
      });
    },
    onSuccess: () => {
      success('Candidate application status updated.');
      setStatusUpdateApp(null);
      setStatusNotes('');
      queryClient.invalidateQueries({ queryKey: ['recruiter-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['recruiter-jobs'] });
    },
    onError: (err: any) => {
      toastError(err.message || 'Failed to update candidate application status');
    },
  });

  // 7. Create Job Mutation
  const createJobMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/jobs', payload);
    },
    onSuccess: () => {
      success('New job requisition posted successfully.');
      setIsCreateJobOpen(false);
      setJobTitle('');
      setJobDescription('');
      queryClient.invalidateQueries({ queryKey: ['recruiter-jobs'] });
    },
    onError: (err: any) => {
      toastError(err.message || 'Failed to post job requisition');
    },
  });

  // Profile Form State
  const company = companyData?.company;
  const [profileWebsite, setProfileWebsite] = useState('');
  const [profileIndustry, setProfileIndustry] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [profileLogoUrl, setProfileLogoUrl] = useState('');
  const [isProfileInitialized, setIsProfileInitialized] = useState(false);

  if (company && !isProfileInitialized) {
    setProfileWebsite(company.website || '');
    setProfileIndustry(company.industry || '');
    setProfileDescription(company.description || '');
    setProfileLogoUrl(company.logoUrl || '');
    setIsProfileInitialized(true);
  }

  // Summary Metrics
  const totalJobs = jobs.length;
  const totalApplications = jobs.reduce((acc, j) => acc + (j.applicationsCount || 0), 0);
  const candidatesList = candidatesData?.candidates || [];
  const highFitCandidates = candidatesList.filter((c) => c.fitScore >= 70).length;

  // Filtered candidates for table
  const filteredCandidates = candidatesList.filter((c) => {
    const matchesStatus =
      candidateStatusFilter === 'all' ||
      c.currentStatus.toLowerCase() === candidateStatusFilter.toLowerCase();
    const matchesSearch =
      !candidateSearch.trim() ||
      c.student.fullName.toLowerCase().includes(candidateSearch.toLowerCase()) ||
      c.student.email?.toLowerCase().includes(candidateSearch.toLowerCase()) ||
      c.student.rollNumber?.toLowerCase().includes(candidateSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleDownloadResume = async (resumeId?: string) => {
    if (!resumeId) {
      toastError('Candidate does not have an attached verified ATS resume.');
      return;
    }
    try {
      const blob = await api.getBlob(`/resumes/${resumeId}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evidra-resume-${resumeId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success('ATS Resume PDF downloaded successfully.');
    } catch (err: any) {
      toastError(err.message || 'Failed to download ATS resume');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Recruiter Talent Suite
            </h1>
            <Badge variant="teal" size="sm" dot>
              {company?.name || user?.email || 'Verified Partner'}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Source candidates backed by verified academic deliverables and deterministically audited code skills.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchJobs();
              if (activeJobId) refetchCandidates();
            }}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateJobOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Post Requisition
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Overview &amp; Metrics
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'jobs'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          Company Requisitions ({totalJobs})
        </button>
        <button
          onClick={() => setActiveTab('candidates')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'candidates'
              ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Candidate Shortlist ({totalApplications})
        </button>
        <button
          onClick={() => setActiveTab('company')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'company'
              ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Company Profile
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Active Postings
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Briefcase className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-white">{totalJobs} Requisitions</div>
                <p className="text-[11px] text-blue-400/80 mt-1">Live for verified campus cohorts</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Applications
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-white">{totalApplications} Candidates</div>
                <p className="text-[11px] text-teal-400/80 mt-1">Directly applied to company roles</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    High Fit Ratio
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-white">{highFitCandidates} Qualified</div>
                <p className="text-[11px] text-purple-400/80 mt-1">&ge;70% Deterministic match</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Verification
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-white">100% Audited</div>
                <p className="text-[11px] text-emerald-400/80 mt-1">Zero fabricated claims</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Listings Overview */}
          <Card className="border-slate-800 bg-[#0b1329]">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Job Openings</CardTitle>
                <CardDescription>
                  Your company's open campus drives with real-time application pipelines.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('jobs')}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Manage All
              </Button>
            </CardHeader>
            <CardContent>
              {isJobsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : jobs.length === 0 ? (
                <EmptyState
                  title="No Requisitions Yet"
                  description="Post your first job opening to start receiving verified student applications."
                  action={{
                    label: 'Post Opening',
                    onClick: () => setIsCreateJobOpen(true),
                  }}
                />
              ) : (
                <div className="space-y-3">
                  {jobs.slice(0, 5).map((job) => (
                    <div
                      key={job._id}
                      className="p-4 rounded-xl bg-[#070d18] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-white">{job.title}</h4>
                          <Badge variant="teal" size="sm">
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {job.location || 'Remote'} &bull; {job.type || 'Full-time'} &bull; Min CGPA: {job.eligibilityCriteria?.minCgpa || 7.0}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs font-bold text-teal-400">
                            {job.applicationsCount} Applicants
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {job.applicationsByStatus?.interview || 0} in interview
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedJobId(job._id);
                            setActiveTab('candidates');
                          }}
                        >
                          View Shortlist
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: COMPANY REQUISITIONS */}
      {activeTab === 'jobs' && (
        <div className="space-y-6">
          <Card className="border-slate-800 bg-[#0b1329]">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Company Job Requisitions</CardTitle>
                <CardDescription>
                  Manage active campus postings, eligibility thresholds, and skill demands.
                </CardDescription>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateJobOpen(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                New Requisition
              </Button>
            </CardHeader>
            <CardContent>
              {isJobsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : jobs.length === 0 ? (
                <EmptyState
                  title="No Requisitions Found"
                  description="You have not published any job openings for this recruitment cycle."
                />
              ) : (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <div
                      key={job._id}
                      className="p-5 rounded-xl bg-[#070d18] border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white">{job.title}</h3>
                          <Badge variant="success" size="sm">
                            {job.status.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            ID: {job._id.slice(-6)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {job.location} &bull; {job.type} &bull; Min CGPA: {job.eligibilityCriteria?.minCgpa || 7.0}
                        </p>
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {job.requiredSkills?.map((s) => (
                            <span
                              key={s._id}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-teal-400">
                            {job.applicationsCount} Applied
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {job.applicationsByStatus?.interview || 0} in Interview &bull;{' '}
                            {job.applicationsByStatus?.offer || 0} Offered
                          </div>
                        </div>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setSelectedJobId(job._id);
                            setActiveTab('candidates');
                          }}
                          icon={<Users className="w-3.5 h-3.5" />}
                        >
                          Ranked Shortlist
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: CANDIDATE SHORTLIST & EVALUATION */}
      {activeTab === 'candidates' && (
        <div className="space-y-6">
          {/* Controls: Requisition Picker & Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-[#0b1329] border border-slate-800">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <label className="text-xs font-semibold text-slate-300">Requisition:</label>
              <select
                value={activeJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500"
              >
                {jobs.map((j) => (
                  <option key={j._id} value={j._id}>
                    {j.title} ({j.applicationsCount} applicants)
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={candidateStatusFilter}
                  onChange={(e) => setCandidateStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="applied">Applied</option>
                  <option value="screening">Screening</option>
                  <option value="under_review">Under Review</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="w-full md:w-64">
              <Input
                placeholder="Search candidates by name..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className="text-xs py-1.5"
              />
            </div>
          </div>

          {/* Ranked Candidates Table */}
          <Card className="border-slate-800 bg-[#0b1329]">
            <CardHeader>
              <CardTitle>
                Ranked Candidates ({filteredCandidates.length})
              </CardTitle>
              <CardDescription>
                Deterministic fit scoring evaluated against verified student projects, assessments, and code artifacts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCandidatesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : isCandidatesError ? (
                <ErrorState
                  title="Failed to Load Candidates"
                  message={(candidatesErr as any)?.message || 'Could not load candidate shortlist'}
                  onRetry={() => refetchCandidates()}
                />
              ) : filteredCandidates.length === 0 ? (
                <EmptyState
                  title="No Candidates Found"
                  description="No applicants match the current filter criteria for this requisition."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">Rank / Candidate</th>
                        <th className="py-3 px-4">Academic Specs</th>
                        <th className="py-3 px-4">Verified Fit Score</th>
                        <th className="py-3 px-4">Skill Match Breakdown</th>
                        <th className="py-3 px-4">Pipeline Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {filteredCandidates.map((cand, idx) => (
                        <tr key={cand.applicationId} className="hover:bg-slate-800/30 transition-colors">
                          {/* Candidate info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                                #{idx + 1}
                              </span>
                              <div>
                                <div className="font-bold text-white">{cand.student.fullName}</div>
                                <div className="text-[11px] text-slate-400">
                                  {cand.student.email || 'Verified Candidate'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Academic specs */}
                          <td className="py-3.5 px-4 text-slate-300">
                            <div>CGPA: <span className="font-semibold text-white">{cand.student.cgpa?.toFixed(2) || 'N/A'}</span></div>
                            <div className="text-[11px] text-slate-400">
                              {cand.student.department || 'B.Tech'} ({cand.student.graduationYear || '2025'})
                            </div>
                          </td>

                          {/* Fit Score & Eligibility */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-base font-extrabold ${
                                  cand.fitScore >= 80
                                    ? 'text-emerald-400'
                                    : cand.fitScore >= 60
                                    ? 'text-teal-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {cand.fitScore}%
                              </span>
                              {cand.eligibility.status === 'MET' ? (
                                <Badge variant="success" size="sm">
                                  Eligible
                                </Badge>
                              ) : (
                                <Badge variant="danger" size="sm">
                                  Not Met
                                </Badge>
                              )}
                            </div>
                            {cand.eligibility.reasons.length > 0 && (
                              <div className="text-[10px] text-rose-400/80 mt-0.5">
                                {cand.eligibility.reasons[0]}
                              </div>
                            )}
                          </td>

                          {/* Skill breakdown */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1 max-w-xs">
                              <div className="flex items-center gap-1 flex-wrap">
                                {cand.supportedSkills.slice(0, 3).map((s) => (
                                  <span
                                    key={s.skillId}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  >
                                    ✓ {s.name}
                                  </span>
                                ))}
                                {cand.supportedSkills.length > 3 && (
                                  <span className="text-[10px] text-slate-500">
                                    +{cand.supportedSkills.length - 3} more
                                  </span>
                                )}
                              </div>
                              {cand.missingRequiredSkills.length > 0 && (
                                <div className="text-[10px] text-rose-400">
                                  Missing: {cand.missingRequiredSkills.map((m) => m.name).join(', ')}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Pipeline status */}
                          <td className="py-3.5 px-4">
                            <Badge
                              variant={
                                cand.currentStatus === 'offer'
                                  ? 'success'
                                  : cand.currentStatus === 'interview'
                                  ? 'teal'
                                  : cand.currentStatus === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                              }
                              size="sm"
                            >
                              {cand.currentStatus.toUpperCase()}
                            </Badge>
                            {cand.interviewDetails?.round && (
                              <div className="text-[10px] text-blue-400 mt-0.5">
                                {cand.interviewDetails.round}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Inspect Evidence */}
                              <Button
                                variant="outline"
                                size="sm"
                                title="Inspect Verified Deliverables"
                                onClick={() =>
                                  setEvidenceCandidate({
                                    id: cand.student._id,
                                    name: cand.student.fullName,
                                  })
                                }
                                icon={<Eye className="w-3.5 h-3.5 text-teal-400" />}
                              >
                                Evidence
                              </Button>

                              {/* ATS Resume PDF */}
                              <Button
                                variant="outline"
                                size="sm"
                                title="Download Verified ATS Resume"
                                onClick={() => handleDownloadResume(cand.resumeId)}
                                icon={<Download className="w-3.5 h-3.5 text-blue-400" />}
                              >
                                Resume
                              </Button>

                              {/* Advance/Update Pipeline Status */}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setStatusUpdateApp({
                                    id: cand.applicationId,
                                    studentName: cand.student.fullName,
                                    currentStatus: cand.currentStatus,
                                  })
                                }
                              >
                                Status
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: COMPANY PROFILE */}
      {activeTab === 'company' && (
        <div className="space-y-6 max-w-3xl">
          <Card className="border-slate-800 bg-[#0b1329]">
            <CardHeader>
              <CardTitle>Company Profile Management</CardTitle>
              <CardDescription>
                Update company presentation visible to students during campus recruitment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCompanyLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateCompanyMutation.mutate({
                      website: profileWebsite,
                      industry: profileIndustry,
                      description: profileDescription,
                      logoUrl: profileLogoUrl,
                    });
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Company Name
                    </label>
                    <Input value={company?.name || ''} disabled className="bg-slate-900/60" />
                    <span className="text-[10px] text-slate-500">
                      Company identity is verified by the university placement department.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Industry / Domain
                      </label>
                      <Input
                        placeholder="e.g. Enterprise Software, FinTech"
                        value={profileIndustry}
                        onChange={(e) => setProfileIndustry(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Website URL
                      </label>
                      <Input
                        placeholder="https://company.com"
                        value={profileWebsite}
                        onChange={(e) => setProfileWebsite(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Logo URL
                    </label>
                    <Input
                      placeholder="https://assets.company.com/logo.png"
                      value={profileLogoUrl}
                      onChange={(e) => setProfileLogoUrl(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Company Mission &amp; Overview
                    </label>
                    <textarea
                      rows={4}
                      value={profileDescription}
                      onChange={(e) => setProfileDescription(e.target.value)}
                      className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-3 text-xs text-white outline-none focus:border-blue-500"
                      placeholder="Tell students about your company culture, engineering stack, and growth..."
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={updateCompanyMutation.isPending}
                    >
                      Save Profile Changes
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL 1: EVIDENCE DELIVERABLES INSPECTOR */}
      <Dialog
        isOpen={Boolean(evidenceCandidate)}
        onClose={() => setEvidenceCandidate(null)}
        title={`Verified Evidence: ${evidenceCandidate?.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            All code deliverables, repositories, and technical credentials below have been signed and validated by campus placement authorities.
          </p>

          {isEvidenceLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !evidenceData?.evidence || evidenceData.evidence.length === 0 ? (
            <EmptyState
              title="No Evidence Records"
              description="Candidate has not submitted verified evidence items yet."
            />
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {evidenceData.evidence.map((item) => (
                <div
                  key={item._id}
                  className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{item.title}</span>
                      <Badge variant="success" size="sm">
                        {item.verificationStatus}
                      </Badge>
                    </div>
                    {item.score && (
                      <span className="text-xs font-bold text-teal-400">
                        Score: {item.score}/100
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-400">{item.description}</p>
                  )}
                  {item.url && (
                    <div className="pt-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Live Project / Repository
                      </a>
                    </div>
                  )}
                  {item.skills && item.skills.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {item.skills.map((s) => (
                        <span
                          key={s._id}
                          className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setEvidenceCandidate(null)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 2: APPLICATION STATUS TRANSITION */}
      <Dialog
        isOpen={Boolean(statusUpdateApp)}
        onClose={() => setStatusUpdateApp(null)}
        title={`Update Pipeline Status: ${statusUpdateApp?.studentName}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Authorized recruiter action to transition candidate along the hiring workflow.
          </p>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Select Target Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500"
            >
              <option value="under_review">Under Review</option>
              <option value="interview">Schedule Interview</option>
              <option value="offer">Extend Job Offer</option>
              <option value="rejected">Reject Candidate</option>
            </select>
          </div>

          {newStatus === 'interview' && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Interview Round / Stage
              </label>
              <Input
                value={interviewRound}
                onChange={(e) => setInterviewRound(e.target.value)}
                placeholder="e.g. Technical Round 1, System Design"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Evaluation Notes / Feedback
            </label>
            <textarea
              rows={3}
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="Candidate demonstrated deep understanding of distributed systems..."
              className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusUpdateApp(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={updateStatusMutation.isPending}
              onClick={() => {
                if (statusUpdateApp) {
                  updateStatusMutation.mutate({
                    appId: statusUpdateApp.id,
                    status: newStatus,
                    notes: statusNotes,
                    round: interviewRound,
                  });
                }
              }}
            >
              Update Status
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 3: POST REQUISITION */}
      <Dialog
        isOpen={isCreateJobOpen}
        onClose={() => setIsCreateJobOpen(false)}
        title="Post New Campus Requisition"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createJobMutation.mutate({
              title: jobTitle,
              description: jobDescription,
              location: jobLocation,
              type: jobType,
              eligibilityCriteria: {
                minCgpa: parseFloat(jobMinCgpa) || 7.0,
                maxBacklogs: 0,
              },
              sourceType: 'partner_posting',
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Job Title *
            </label>
            <Input
              required
              placeholder="e.g. Associate Software Engineer (Fullstack)"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Location
              </label>
              <Input
                value={jobLocation}
                onChange={(e) => setJobLocation(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Role Type
              </label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-2.5 text-xs text-white"
              >
                <option value="full-time">Full-time</option>
                <option value="internship">Internship</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Min CGPA
              </label>
              <Input
                type="number"
                step="0.1"
                value={jobMinCgpa}
                onChange={(e) => setJobMinCgpa(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Job Description &amp; Responsibilities *
            </label>
            <textarea
              required
              rows={4}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Provide a detailed overview of the role, team, and tech stack..."
              className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-3 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateJobOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createJobMutation.isPending}
            >
              Publish Requisition
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
