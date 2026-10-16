import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Layers,
  MessageSquare,
  ChevronRight,
  Check,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { InterviewPrepData, JobItem } from '../../types/student';

interface JobsResponse {
  jobs: JobItem[];
  total: number;
}

export const InterviewPrepPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlJobId = searchParams.get('jobId');

  const [selectedJobId, setSelectedJobId] = useState<string>(urlJobId || '');
  const [completedQuestions, setCompletedQuestions] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'strengths' | 'gaps' | 'system' | 'behavioral'>('all');

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

  const availableJobs = jobsData?.jobs || [];

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
    refetch,
  } = useQuery<InterviewPrepData>({
    queryKey: ['interview-prep-kit', selectedJobId],
    queryFn: () => api.get<InterviewPrepData>(`/matching/jobs/${selectedJobId}/interview-prep`),
    enabled: !!selectedJobId,
  });

  const toggleComplete = (id: string) => {
    setCompletedQuestions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Job Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-teal-400" />
            Interview Preparation Intelligence
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Personalized technical probes, gap bridge strategies, and scenario questions generated from your verified evidence.
          </p>
        </div>

        {/* Job Switcher Dropdown */}
        <div className="flex items-center gap-2.5">
          <label className="text-xs font-medium text-slate-400 whitespace-nowrap">
            Target Role:
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
          onRetry={() => refetch()}
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

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
            {[
              { id: 'all', label: 'Complete Kit' },
              { id: 'strengths', label: `Technical Strengths (${prepKit.strengthQuestions.length})` },
              { id: 'gaps', label: `Skill Gaps Bridge (${prepKit.gapQuestions.length})` },
              { id: 'system', label: 'System Design Scenario' },
              { id: 'behavioral', label: `Behavioral (${prepKit.behavioralQuestions.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e172e]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {/* Section 1: Technical Strength Deep Dives */}
            {(activeTab === 'all' || activeTab === 'strengths') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Verified Strength Questions ({prepKit.strengthQuestions.length})
                  </h3>
                  <span className="text-xs text-slate-400">
                    Probing questions expected for your verified core competencies
                  </span>
                </div>

                {prepKit.strengthQuestions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 bg-[#0b1329] rounded-xl border border-slate-800">
                    No verified skills match this job's requirements yet. Submit evidence in your Evidence Vault to generate targeted strength questions.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5">
                    {prepKit.strengthQuestions.map((q, idx) => {
                      const id = `strength-${idx}`;
                      const isDone = completedQuestions[id];
                      return (
                        <Card
                          key={id}
                          className={`bg-[#0b1329] border transition-all p-5 ${
                            isDone ? 'border-emerald-500/30 opacity-75' : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {q.skill}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {q.difficulty}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-white leading-relaxed">
                                {q.question}
                              </p>
                              <div className="flex items-start gap-2 p-3 rounded-lg bg-[#070d18] border border-slate-800/80 text-xs text-slate-300">
                                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">
                                  <strong className="text-amber-300">Strategy:</strong> {q.tips}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleComplete(id)}
                              className={`p-2 rounded-lg border transition-colors shrink-0 ${
                                isDone
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                  : 'bg-[#070d18] border-slate-800 text-slate-400 hover:text-white'
                              }`}
                              title={isDone ? 'Marked as practiced' : 'Mark as practiced'}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Gap Bridge Questions & Ramp-up Strategies */}
            {(activeTab === 'all' || activeTab === 'gaps') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Targeted Gap Bridge Strategies ({prepKit.gapQuestions.length})
                  </h3>
                  <span className="text-xs text-slate-400">
                    How to address missing required skills convincingly during interviews
                  </span>
                </div>

                {prepKit.gapQuestions.length === 0 ? (
                  <p className="text-xs text-emerald-400/90 italic p-4 bg-emerald-950/10 rounded-xl border border-emerald-800/30">
                    No required skill gaps detected! Your profile satisfies all mandatory competencies for this role.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5">
                    {prepKit.gapQuestions.map((q, idx) => {
                      const id = `gap-${idx}`;
                      const isDone = completedQuestions[id];
                      return (
                        <Card
                          key={id}
                          className={`bg-[#0b1329] border transition-all p-5 ${
                            isDone ? 'border-amber-500/30 opacity-75' : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  {q.skill} (Skill Gap)
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {q.difficulty}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-white leading-relaxed">
                                {q.question}
                              </p>
                              <div className="flex items-start gap-2 p-3 rounded-lg bg-[#070d18] border border-slate-800/80 text-xs text-slate-300">
                                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <span className="leading-relaxed">
                                  <strong className="text-amber-300">Ramp-Up Tip:</strong> {q.tips}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleComplete(id)}
                              className={`p-2 rounded-lg border transition-colors shrink-0 ${
                                isDone
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                                  : 'bg-[#070d18] border-slate-800 text-slate-400 hover:text-white'
                              }`}
                              title={isDone ? 'Marked as practiced' : 'Mark as practiced'}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Section 3: System Design & Architecture Challenge */}
            {(activeTab === 'all' || activeTab === 'system') && prepKit.scenarioQuestion && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  System Architecture Challenge
                </h3>

                <Card className="bg-[#0b1329] border-slate-800 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-base font-semibold text-white">
                      {prepKit.scenarioQuestion.title}
                    </h4>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                      Architecture & Scale
                    </span>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed bg-[#070d18] p-4 rounded-xl border border-slate-800">
                    {prepKit.scenarioQuestion.scenario}
                  </p>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Key Technical Evaluation Focus Areas:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {prepKit.scenarioQuestion.focusAreas.map((area, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-slate-200 bg-[#0e172e] px-3 py-2 rounded-lg border border-slate-800"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{area}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Section 4: Behavioral & Alignment Probes */}
            {(activeTab === 'all' || activeTab === 'behavioral') && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Behavioral & Domain Alignment ({prepKit.behavioralQuestions.length})
                </h3>

                <div className="grid grid-cols-1 gap-3.5">
                  {prepKit.behavioralQuestions.map((b, idx) => {
                    const id = `behavioral-${idx}`;
                    const isDone = completedQuestions[id];
                    return (
                      <Card
                        key={id}
                        className={`bg-[#0b1329] border transition-all p-5 ${
                          isDone ? 'border-purple-500/30 opacity-75' : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <p className="text-sm font-medium text-white leading-relaxed">
                              {b.question}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-950/20 px-3 py-2 rounded-lg border border-purple-800/30">
                              <span className="font-semibold text-purple-400 uppercase tracking-wider text-[10px]">
                                Evaluator Intent:
                              </span>
                              <span>{b.focus}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleComplete(id)}
                            className={`p-2 rounded-lg border transition-colors shrink-0 ${
                              isDone
                                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                : 'bg-[#070d18] border-slate-800 text-slate-400 hover:text-white'
                            }`}
                            title={isDone ? 'Marked as practiced' : 'Mark as practiced'}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
