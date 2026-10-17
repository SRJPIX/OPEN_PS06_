import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Check,
  BookOpen,
  Plus,
  Filter,
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
import type { InterviewPrepData, JobItem } from '../../types/student';

interface JobsResponse {
  jobs: JobItem[];
  total: number;
}

interface QuestionBankItem {
  question: string;
  topic: string;
  difficulty: string;
  tips?: string;
  codeSnippet?: string;
  companyName: string;
  role: string;
  roundName: string;
  driveYear: number;
}

interface InterviewExperienceItem {
  _id: string;
  companyName: string;
  role: string;
  driveYear: number;
  difficulty: string;
  outcome: string;
  isAnonymous: boolean;
  authorDisplay?: string;
  overallExperience: string;
  preparationTips?: string;
  rounds: Array<{
    roundNumber: number;
    roundName: string;
    durationMinutes?: number;
    questions: Array<{ question: string; topic: string; difficulty?: string; tips?: string }>;
  }>;
}

export const InterviewPrepPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlJobId = searchParams.get('jobId');
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Top-level Mode: 'blueprint' (AI Match Prep) vs 'repository' (Company Question Bank & Experiences)
  const [activeMode, setActiveMode] = useState<'blueprint' | 'repository'>('blueprint');

  // Blueprint State
  const [selectedJobId, setSelectedJobId] = useState<string>(urlJobId || '');
  const [completedQuestions, setCompletedQuestions] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'strengths' | 'gaps' | 'system' | 'behavioral'>('all');

  // Repository State
  const [repoCompanyFilter, setRepoCompanyFilter] = useState<string>('');
  const [repoTopicFilter, setRepoTopicFilter] = useState<string>('');
  const [repoSearch, setRepoSearch] = useState<string>('');
  const [repoView, setRepoView] = useState<'questions' | 'experiences'>('questions');

  // Share Report Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareCompany, setShareCompany] = useState('');
  const [shareRole, setShareRole] = useState('');
  const [shareDifficulty, setShareDifficulty] = useState('medium');
  const [shareOutcome, setShareOutcome] = useState('offered');
  const [shareAnonymous, setShareAnonymous] = useState(false);
  const [shareExperience, setShareExperience] = useState('');
  const [shareTips, setShareTips] = useState('');
  const [shareRoundName, setShareRoundName] = useState('Technical Round 1');
  const [shareQuestionText, setShareQuestionText] = useState('');
  const [shareQuestionTopic, setShareQuestionTopic] = useState('Algorithms');

  // Sync state if URL param changes
  useEffect(() => {
    if (urlJobId && urlJobId !== selectedJobId) {
      setSelectedJobId(urlJobId);
    }
  }, [urlJobId]);

  // 1. Fetch available jobs for the selector dropdown
  const { data: jobsData } = useQuery<JobsResponse>({
    queryKey: ['available-jobs-prep'],
    queryFn: () => api.get<JobsResponse>('/jobs?limit=50'),
  });

  const availableJobs: JobItem[] = Array.isArray(jobsData) ? jobsData : jobsData?.jobs || [];

  // If no job is selected yet and jobs are loaded, auto-select the first job
  useEffect(() => {
    if (!selectedJobId && availableJobs.length > 0) {
      const firstId = availableJobs[0]._id;
      setSelectedJobId(firstId);
      setSearchParams({ jobId: firstId });
    }
  }, [selectedJobId, availableJobs, setSearchParams]);

  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    setSearchParams({ jobId });
  };

  // 2. Fetch Personalized Interview Prep Kit
  const {
    data: prepKit,
    isLoading: isPrepLoading,
    isError: isPrepError,
    error: prepError,
    refetch: refetchPrep,
  } = useQuery<InterviewPrepData>({
    queryKey: ['interview-prep-kit', selectedJobId],
    queryFn: () => {
      if (!selectedJobId) {
        throw new Error('Please select a target job opening first.');
      }
      return api.get<InterviewPrepData>(`/matching/jobs/${selectedJobId}/interview-prep`);
    },
    enabled: !!selectedJobId && activeMode === 'blueprint',
  });

  // 3. Fetch Company Question Bank
  const {
    data: questionsData,
    isLoading: isQuestionsLoading,
    refetch: refetchQuestions,
  } = useQuery<{ totalQuestions: number; questions: QuestionBankItem[] }>({
    queryKey: ['interview-questions', repoCompanyFilter, repoTopicFilter, repoSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (repoCompanyFilter) params.set('company', repoCompanyFilter);
      if (repoTopicFilter) params.set('topic', repoTopicFilter);
      if (repoSearch.trim()) params.set('search', repoSearch.trim());
      return api.get<{ totalQuestions: number; questions: QuestionBankItem[] }>(
        `/interviews/questions?${params.toString()}`
      );
    },
    enabled: activeMode === 'repository',
  });

  // 4. Fetch Approved Interview Experiences
  const {
    data: experiencesData,
    isLoading: isExpLoading,
    refetch: refetchExperiences,
  } = useQuery<{ reports: InterviewExperienceItem[] }>({
    queryKey: ['interview-experiences', repoCompanyFilter, repoSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (repoCompanyFilter) params.set('company', repoCompanyFilter);
      if (repoSearch.trim()) params.set('search', repoSearch.trim());
      return api.get<{ reports: InterviewExperienceItem[] }>(
        `/interviews/experiences?${params.toString()}`
      );
    },
    enabled: activeMode === 'repository',
  });

  // 5. Submit Interview Report Mutation
  const submitReportMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/interviews/experiences', payload);
    },
    onSuccess: () => {
      success('Interview report contributed successfully! Thank you for supporting your peers.');
      setIsShareModalOpen(false);
      setShareCompany('');
      setShareRole('');
      setShareExperience('');
      setShareTips('');
      setShareQuestionText('');
      queryClient.invalidateQueries({ queryKey: ['interview-questions'] });
      queryClient.invalidateQueries({ queryKey: ['interview-experiences'] });
    },
    onError: (err: any) => {
      toastError(err.message || 'Failed to submit interview report');
    },
  });

  const toggleComplete = (id: string) => {
    setCompletedQuestions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const questionsList = questionsData?.questions || [];
  const experiencesList = experiencesData?.reports || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-teal-400" />
            Interview Intelligence Suite
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Personalized technical probes derived from your verified evidence, plus campus-wide company question repositories.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 bg-[#070d18] p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveMode('blueprint')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeMode === 'blueprint'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Role Blueprint
          </button>
          <button
            onClick={() => setActiveMode('repository')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeMode === 'repository'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Question Repository &amp; Reports
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: PERSONALIZED BLUEPRINT (ORIGINAL MATCH-DRIVEN VIEW)                */}
      {/* ========================================================================= */}
      {activeMode === 'blueprint' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <label className="text-xs font-medium text-slate-400 whitespace-nowrap">
                Target Requisition:
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => handleJobChange(e.target.value)}
                className="bg-[#0b1329] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500 max-w-xs truncate"
              >
                {availableJobs.map((j) => (
                  <option key={j._id} value={j._id}>
                    {j.title} — {(j.company as any)?.name || 'Company'}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedJobId || isPrepLoading}
              onClick={() => {
                if (!selectedJobId) {
                  toastError('Job Selection Required', 'Please select a target requisition to generate interview blueprint.');
                  return;
                }
                refetchPrep();
              }}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Regenerate Blueprint
            </Button>
          </div>

          {isPrepLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-28 rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : isPrepError ? (
            <ErrorState
              title="Failed to Generate Interview Prep"
              message={prepError instanceof Error ? prepError.message : 'Unable to generate interview kit.'}
              onRetry={() => refetchPrep()}
            />
          ) : !prepKit ? (
            <EmptyState
              title="Select a Job Opening"
              description="Choose a target job opening above to generate a tailored interview preparation blueprint."
            />
          ) : (
            <>
              {/* Candidate Alignment Banner */}
              <Card className="bg-gradient-to-r from-[#0b162c] via-[#091428] to-[#070e1c] border-slate-800 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">
                        Customized Blueprint for
                      </span>
                      <Badge variant="neutral" size="sm">
                        {prepKit.job.company}
                      </Badge>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      {prepKit.job.title}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Calculated against your verified skills, completed evaluations, and required job competencies.
                    </p>
                  </div>

                  {/* Match Metrics Summary */}
                  <div className="flex items-center gap-3 sm:gap-6 shrink-0 bg-[#070d18]/70 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-center px-2">
                      <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Fit Score</p>
                      <p className="text-2xl font-black text-blue-400 mt-0.5">
                        {prepKit.matchSummary.fitScore}
                        <span className="text-xs font-normal text-slate-500">/100</span>
                      </p>
                    </div>
                    <div className="w-[1px] h-8 bg-slate-800" />
                    <div className="text-center px-2">
                      <p className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wider">Strengths</p>
                      <p className="text-2xl font-black text-emerald-400 mt-0.5">
                        {prepKit.matchSummary.supportedSkillsCount}
                      </p>
                    </div>
                    <div className="w-[1px] h-8 bg-slate-800" />
                    <div className="text-center px-2">
                      <p className="text-[10px] uppercase font-semibold text-amber-400 tracking-wider">Gap Areas</p>
                      <p className="text-2xl font-black text-amber-400 mt-0.5">
                        {prepKit.matchSummary.gapCount}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Navigation Pill Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
                {[
                  { id: 'all', label: 'All Interview Areas' },
                  { id: 'strengths', label: `Verified Strengths (${prepKit.strengthQuestions.length})` },
                  { id: 'gaps', label: `Targeted Gap Probes (${prepKit.gapQuestions.length})` },
                  { id: 'system', label: 'Scenario Architecture' },
                  { id: 'behavioral', label: `Evidence Narratives (${prepKit.behavioralQuestions.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e172e]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Question Sections */}
              <div className="space-y-6">
                {(activeTab === 'all' || activeTab === 'strengths') && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Verified Strength Questions ({prepKit.strengthQuestions.length})
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {prepKit.strengthQuestions.map((q, idx) => {
                        const id = `strength-${idx}`;
                        const isDone = completedQuestions[id];
                        return (
                          <Card
                            key={id}
                            className={`bg-[#0b1329] border p-4 transition-all ${
                              isDone ? 'border-emerald-500/30 opacity-75' : 'border-slate-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {q.skill || 'Core Competency'}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">{q.difficulty}</span>
                                </div>
                                <p className="text-xs font-medium text-white">{q.question}</p>
                                {q.tips && (
                                  <p className="text-[11px] text-slate-400">Tip: {q.tips}</p>
                                )}
                              </div>
                              <button
                                onClick={() => toggleComplete(id)}
                                className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
                                  isDone
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                {isDone ? 'Reviewed' : 'Mark Ready'}
                              </button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(activeTab === 'all' || activeTab === 'gaps') && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Skill Gap Probes &amp; Mitigation ({prepKit.gapQuestions.length})
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {prepKit.gapQuestions.map((q, idx) => {
                        const id = `gap-${idx}`;
                        const isDone = completedQuestions[id];
                        return (
                          <Card
                            key={id}
                            className={`bg-[#0b1329] border p-4 transition-all ${
                              isDone ? 'border-amber-500/30 opacity-75' : 'border-slate-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Gap: {q.skill || 'Missing Skill'}
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-white">{q.question}</p>
                                {q.tips && (
                                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-300/90 flex items-start gap-2">
                                    <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>Preparation Strategy: {q.tips}</span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => toggleComplete(id)}
                                className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
                                  isDone
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                {isDone ? 'Reviewed' : 'Mark Ready'}
                              </button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(activeTab === 'all' || activeTab === 'system') && prepKit.scenarioQuestion && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Scenario Architecture: {prepKit.scenarioQuestion.title}
                    </h3>
                    <Card className="bg-[#0b1329] border border-slate-800 p-4 space-y-2">
                      <p className="text-xs text-white leading-relaxed">{prepKit.scenarioQuestion.scenario}</p>
                      {prepKit.scenarioQuestion.focusAreas && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {prepKit.scenarioQuestion.focusAreas.map((fa, i) => (
                            <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                              {fa}
                            </span>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {(activeTab === 'all' || activeTab === 'behavioral') && prepKit.behavioralQuestions && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Evidence Narratives ({prepKit.behavioralQuestions.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {prepKit.behavioralQuestions.map((bq, bIdx) => (
                        <Card key={bIdx} className="bg-[#0b1329] border border-slate-800 p-4 space-y-1.5">
                          <span className="text-[10px] font-semibold text-purple-400 uppercase">Focus: {bq.focus}</span>
                          <p className="text-xs font-medium text-white">{bq.question}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: COMPANY QUESTION REPOSITORY & EXPERIENCES                          */}
      {/* ========================================================================= */}
      {activeMode === 'repository' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-4 rounded-xl bg-[#0b1329] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="flex items-center gap-1.5 bg-[#070d18] p-1 rounded-lg border border-slate-700">
                <button
                  onClick={() => setRepoView('questions')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    repoView === 'questions' ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Question Bank ({questionsList.length})
                </button>
                <button
                  onClick={() => setRepoView('experiences')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    repoView === 'experiences' ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Peer Reports ({experiencesList.length})
                </button>
              </div>

              <div className="w-full sm:w-56">
                <Input
                  placeholder="Search questions or company..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="text-xs py-1.5"
                />
              </div>

              <div className="w-full sm:w-44">
                <Input
                  placeholder="Filter by company..."
                  value={repoCompanyFilter}
                  onChange={(e) => setRepoCompanyFilter(e.target.value)}
                  className="text-xs py-1.5"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={repoTopicFilter}
                  onChange={(e) => setRepoTopicFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none"
                >
                  <option value="">All Topics</option>
                  <option value="React">React</option>
                  <option value="Algorithms">Algorithms</option>
                  <option value="Node.js">Node.js</option>
                  <option value="Kubernetes">Kubernetes</option>
                  <option value="Distributed">Distributed Systems</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchQuestions();
                  refetchExperiences();
                }}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsShareModalOpen(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                Share Experience
              </Button>
            </div>
          </div>

          {/* VIEW A: QUESTION BANK */}
          {repoView === 'questions' && (
            <div className="space-y-4">
              {isQuestionsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : questionsList.length === 0 ? (
                <EmptyState
                  title="No Questions Found"
                  description="Try adjusting your topic or search query, or be the first to contribute a question!"
                  action={{
                    label: 'Share Question',
                    onClick: () => setIsShareModalOpen(true),
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {questionsList.map((q, idx) => (
                    <Card key={idx} className="border-slate-800 bg-[#0b1329] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="teal" size="sm">
                            {q.companyName}
                          </Badge>
                          <span className="text-[11px] text-slate-400">{q.roundName}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            q.difficulty === 'hard'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-white leading-relaxed">
                        &ldquo;{q.question}&rdquo;
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                          Topic: {q.topic}
                        </span>
                        <span>Drive: {q.driveYear}</span>
                      </div>

                      {q.tips && (
                        <div className="p-2 rounded bg-blue-500/5 border border-blue-500/10 text-[11px] text-blue-300">
                          Tip: {q.tips}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW B: INTERVIEW EXPERIENCES */}
          {repoView === 'experiences' && (
            <div className="space-y-4">
              {isExpLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : experiencesList.length === 0 ? (
                <EmptyState
                  title="No Experience Reports Yet"
                  description="Share your recent campus hiring drive experience to help fellow students prepare."
                  action={{
                    label: 'Share Report',
                    onClick: () => setIsShareModalOpen(true),
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {experiencesList.map((exp) => (
                    <Card key={exp._id} className="border-slate-800 bg-[#0b1329] p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{exp.companyName}</h3>
                            <Badge variant="teal" size="sm">
                              {exp.role}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Drive Year: {exp.driveYear} &bull; Contributed by{' '}
                            <span className="text-slate-300 font-medium">
                              {exp.isAnonymous ? 'Anonymous Student' : exp.authorDisplay || 'Verified Student'}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={exp.outcome === 'offered' ? 'success' : 'neutral'}
                            size="sm"
                          >
                            {exp.outcome.toUpperCase()}
                          </Badge>
                          <Badge variant="warning" size="sm">
                            {exp.difficulty.toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      {/* Overall narrative */}
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {exp.overallExperience}
                      </p>

                      {exp.preparationTips && (
                        <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/20 text-xs text-teal-300">
                          <span className="font-semibold block mb-0.5">Prep Recommendation:</span>
                          {exp.preparationTips}
                        </div>
                      )}

                      {/* Rounds */}
                      {exp.rounds && exp.rounds.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Rounds Breakdown:
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {exp.rounds.map((rnd, rIdx) => (
                              <div
                                key={rIdx}
                                className="p-2.5 rounded-lg bg-[#070d18] border border-slate-800 text-xs space-y-1"
                              >
                                <div className="font-semibold text-white">
                                  Round {rnd.roundNumber}: {rnd.roundName}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {rnd.questions?.length || 0} questions documented
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SHARE REPORT MODAL */}
      <Dialog
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Share Campus Interview Experience"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitReportMutation.mutate({
              companyName: shareCompany,
              role: shareRole,
              difficulty: shareDifficulty,
              outcome: shareOutcome,
              isAnonymous: shareAnonymous,
              overallExperience: shareExperience,
              preparationTips: shareTips,
              rounds: [
                {
                  roundNumber: 1,
                  roundName: shareRoundName,
                  questions: shareQuestionText
                    ? [
                        {
                          question: shareQuestionText,
                          topic: shareQuestionTopic,
                          difficulty: shareDifficulty,
                        },
                      ]
                    : [],
                },
              ],
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Company *</label>
              <Input
                required
                value={shareCompany}
                onChange={(e) => setShareCompany(e.target.value)}
                placeholder="e.g. Acme Innovations, Microsoft"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Role *</label>
              <Input
                required
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value)}
                placeholder="e.g. Frontend Developer Intern"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Difficulty</label>
              <select
                value={shareDifficulty}
                onChange={(e) => setShareDifficulty(e.target.value)}
                className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-2.5 text-xs text-white"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="challenging">Challenging</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Outcome</label>
              <select
                value={shareOutcome}
                onChange={(e) => setShareOutcome(e.target.value)}
                className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-2.5 text-xs text-white"
              >
                <option value="offered">Offered</option>
                <option value="rejected">Rejected</option>
                <option value="opted_out">Opted Out</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Overall Experience &amp; Rounds Summary *
            </label>
            <textarea
              required
              rows={3}
              value={shareExperience}
              onChange={(e) => setShareExperience(e.target.value)}
              placeholder="Describe the interview flow, interviewer demeanor, and key focus areas..."
              className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Interview Stage / Round Name
            </label>
            <Input
              value={shareRoundName}
              onChange={(e) => setShareRoundName(e.target.value)}
              placeholder="e.g. Technical Round 1, System Design, HR"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Notable Question Asked
              </label>
              <Input
                value={shareQuestionText}
                onChange={(e) => setShareQuestionText(e.target.value)}
                placeholder="e.g. Implement LRU Cache in O(1)"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Question Topic</label>
              <Input
                value={shareQuestionTopic}
                onChange={(e) => setShareQuestionTopic(e.target.value)}
                placeholder="e.g. Data Structures, React"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Preparation Advice for Juniors (Optional)
            </label>
            <textarea
              rows={2}
              value={shareTips}
              onChange={(e) => setShareTips(e.target.value)}
              placeholder="What topics or resources would you recommend focusing on?"
              className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          {/* Privacy Control */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="anonCheck"
              checked={shareAnonymous}
              onChange={(e) => setShareAnonymous(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-teal-500"
            />
            <label htmlFor="anonCheck" className="text-xs text-slate-300 select-none cursor-pointer">
              Post anonymously (Hides your email/name from peers in the question repository)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsShareModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitReportMutation.isPending}
            >
              Contribute Report
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
