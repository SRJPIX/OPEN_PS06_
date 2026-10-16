import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FolderGit2,
  Plus,
  ExternalLink,
  Calendar,
  Globe,
  Terminal,
} from 'lucide-react';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { queryClient } from '../../lib/queryClient';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { AssessmentItem, ProjectItem } from '../../types/student';

export const AssessmentProjectEvidencePage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<'assessments' | 'projects'>('assessments');

  // Modals
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Assessment Form State
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [assessmentProvider, setAssessmentProvider] = useState<'internal' | 'hackerrank' | 'leetcode' | 'custom'>('internal');
  const [assessmentSkill, setAssessmentSkill] = useState('');
  const [assessmentScore, setAssessmentScore] = useState(85);
  const [assessmentMaxScore, setAssessmentMaxScore] = useState(100);
  const [assessmentCertUrl, setAssessmentCertUrl] = useState('');

  // Project Form State
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectSkills, setProjectSkills] = useState('');
  const [projectRepoUrl, setProjectRepoUrl] = useState('');
  const [projectLiveUrl, setProjectLiveUrl] = useState('');
  const [projectOngoing, setProjectOngoing] = useState(false);

  // Queries
  const {
    data: assessmentsData,
    isLoading: isAssessmentsLoading,
    isError: isAssessmentsError,
    error: assessmentsError,
    refetch: refetchAssessments,
  } = useQuery<AssessmentItem[]>({
    queryKey: ['student-assessments'],
    queryFn: () => api.get<AssessmentItem[]>('/students/assessments'),
  });

  const {
    data: projectsData,
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    error: projectsError,
    refetch: refetchProjects,
  } = useQuery<ProjectItem[]>({
    queryKey: ['student-projects'],
    queryFn: () => api.get<ProjectItem[]>('/students/projects'),
  });

  // Mutations
  const createAssessmentMutation = useMutation({
    mutationFn: (payload: any) => api.post('/students/assessments', payload),
    onSuccess: () => {
      success('Assessment Recorded', 'Assessment recorded and linked to skill evidence.');
      setIsAssessmentModalOpen(false);
      setAssessmentTitle('');
      setAssessmentSkill('');
      setAssessmentCertUrl('');
      queryClient.invalidateQueries({ queryKey: ['student-assessments'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile-me'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
    },
    onError: (err: any) => {
      toastError('Failed to record assessment', err.message || 'Error communicating with server.');
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (payload: any) => api.post('/students/projects', payload),
    onSuccess: () => {
      success('Project Recorded', 'Project deliverable recorded and linked to evidence vault.');
      setIsProjectModalOpen(false);
      setProjectTitle('');
      setProjectDescription('');
      setProjectSkills('');
      setProjectRepoUrl('');
      setProjectLiveUrl('');
      queryClient.invalidateQueries({ queryKey: ['student-projects'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile-me'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
    },
    onError: (err: any) => {
      toastError('Failed to record project', err.message || 'Error communicating with server.');
    },
  });

  if (isAssessmentsLoading || isProjectsLoading) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isAssessmentsError) {
    return (
      <ErrorState
        title="Could not load assessments"
        message={assessmentsError instanceof Error ? assessmentsError.message : 'Connection error'}
        onRetry={() => refetchAssessments()}
      />
    );
  }

  if (isProjectsError) {
    return (
      <ErrorState
        title="Could not load projects"
        message={projectsError instanceof Error ? projectsError.message : 'Connection error'}
        onRetry={() => refetchProjects()}
      />
    );
  }

  const assessments = assessmentsData || [];
  const projects = projectsData || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Assessments &amp; Project Evidence
            </h1>
            <Badge variant="teal" size="sm" dot>
              Auditable Proof
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Submit proctored technical evaluations, coding round results, and project repositories.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'assessments' ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsAssessmentModalOpen(true)}
            >
              Record Assessment
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsProjectModalOpen(true)}
            >
              Submit Project
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-[#0b1329] border border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('assessments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === 'assessments'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Proctored Assessments ({assessments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === 'projects'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          Evaluated Projects ({projects.length})
        </button>
      </div>

      {/* Tab 1: Proctored Assessments */}
      {activeTab === 'assessments' && (
        <div className="space-y-6">
          {assessments.length === 0 ? (
            <EmptyState
              icon={<Terminal className="w-8 h-8 text-slate-500" />}
              title="No proctored assessments recorded"
              description="Record official coding assessments or technical rounds to provide definitive proficiency value."
              action={{
                label: 'Record Assessment',
                onClick: () => setIsAssessmentModalOpen(true),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {assessments.map((item) => {
                const percentage = Math.round((item.score / item.maxScore) * 100);

                return (
                  <Card key={item._id} className="border-slate-800 bg-[#0b1329] hover:border-slate-700 transition">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-white tracking-tight">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                              {item.provider.toUpperCase()}
                            </span>
                            <span className="text-slate-600">&bull;</span>
                            <span className="text-xs text-slate-400">
                              {item.skill?.name || 'Technical'}
                            </span>
                          </div>
                        </div>
                        <Badge variant={item.passed ? 'success' : 'danger'} size="sm" dot>
                          {item.passed ? 'Passed' : 'Failed'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-400">Score Achieved</div>
                          <div className="text-lg font-extrabold text-white font-mono">
                            {item.score} / {item.maxScore}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Proficiency</div>
                          <div className="text-lg font-extrabold text-teal-400 font-mono">
                            {percentage}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(item.takenAt).toLocaleDateString()}
                        </span>
                        {item.certificateUrl && (
                          <a
                            href={item.certificateUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            Certificate <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Evaluated Projects */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          {projects.length === 0 ? (
            <EmptyState
              icon={<FolderGit2 className="w-8 h-8 text-slate-500" />}
              title="No evaluated projects submitted"
              description="Add course projects, open-source repositories, or capstone deliverables backing your skill portfolio."
              action={{
                label: 'Submit Evaluated Project',
                onClick: () => setIsProjectModalOpen(true),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {projects.map((proj) => (
                <Card key={proj._id} className="border-slate-800 bg-[#0b1329] hover:border-slate-700 transition">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight">
                          {proj.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="electric" size="sm">
                            {proj.isOngoing ? 'In Progress' : 'Completed'}
                          </Badge>
                          {proj.repoUrl && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <GithubIcon className="w-3 h-3 text-slate-400" /> Linked Repo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                      {proj.description}
                    </p>

                    {/* Skill tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {proj.skills?.map((s) => (
                        <span
                          key={s._id}
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#070d18] border border-slate-800 text-blue-300"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>

                    {/* Links row */}
                    <div className="flex items-center gap-4 pt-2 border-t border-slate-800/80 text-xs">
                      {proj.repoUrl && (
                        <a
                          href={proj.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
                        >
                          <GithubIcon className="w-3.5 h-3.5" /> Source Code
                        </a>
                      )}
                      {proj.liveUrl && (
                        <a
                          href={proj.liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-400 hover:text-teal-300 flex items-center gap-1.5"
                        >
                          <Globe className="w-3.5 h-3.5" /> Live Demo
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Record Assessment Modal */}
      <Dialog
        isOpen={isAssessmentModalOpen}
        onClose={() => setIsAssessmentModalOpen(false)}
        title="Record Technical Assessment"
        description="Log an official proctored coding test or evaluation to prove your proficiency."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsAssessmentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={createAssessmentMutation.isPending}
              disabled={!assessmentTitle.trim() || !assessmentSkill.trim()}
              onClick={() => {
                createAssessmentMutation.mutate({
                  title: assessmentTitle.trim(),
                  provider: assessmentProvider,
                  skill: assessmentSkill.trim(),
                  score: assessmentScore,
                  maxScore: assessmentMaxScore,
                  passed: assessmentScore / assessmentMaxScore >= 0.6,
                  certificateUrl: assessmentCertUrl.trim() || undefined,
                });
              }}
            >
              Record &amp; Link Evidence
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <Input
            label="Assessment Title"
            placeholder="e.g. Distributed Systems & TypeScript Round"
            value={assessmentTitle}
            onChange={(e) => setAssessmentTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Provider / Testing Platform</label>
              <select
                value={assessmentProvider}
                onChange={(e: any) => setAssessmentProvider(e.target.value)}
                className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              >
                <option value="internal">University / Faculty Internal Assessment</option>
                <option value="hackerrank">HackerRank Technical Assessment</option>
                <option value="leetcode">LeetCode Assessment</option>
                <option value="custom">Standard Industry Test</option>
              </select>
            </div>

            <Input
              label="Assessed Skill"
              placeholder="e.g. TypeScript, React, Python"
              value={assessmentSkill}
              onChange={(e) => setAssessmentSkill(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Score Achieved"
              type="number"
              value={assessmentScore}
              onChange={(e) => setAssessmentScore(Number(e.target.value))}
              required
            />
            <Input
              label="Maximum Score"
              type="number"
              value={assessmentMaxScore}
              onChange={(e) => setAssessmentMaxScore(Number(e.target.value))}
              required
            />
          </div>

          <Input
            label="Certificate / Score Report URL"
            placeholder="https://hackerrank.com/certificates/..."
            value={assessmentCertUrl}
            onChange={(e) => setAssessmentCertUrl(e.target.value)}
          />
        </div>
      </Dialog>

      {/* Submit Project Modal */}
      <Dialog
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        title="Submit Evaluated Project"
        description="Attach project deliverables with faculty evaluations and source code links."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsProjectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={createProjectMutation.isPending}
              disabled={!projectTitle.trim() || !projectDescription.trim() || !projectSkills.trim()}
              onClick={() => {
                const skillsArray = projectSkills
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);

                createProjectMutation.mutate({
                  title: projectTitle.trim(),
                  description: projectDescription.trim(),
                  skills: skillsArray,
                  repoUrl: projectRepoUrl.trim() || undefined,
                  liveUrl: projectLiveUrl.trim() || undefined,
                  isOngoing: projectOngoing,
                });
              }}
            >
              Submit Deliverable
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <Input
            label="Project Title"
            placeholder="e.g. Event-Driven Microservices Hub"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Technical Description</label>
            <textarea
              rows={3}
              placeholder="Describe what the system does, architectural patterns used, and technical challenges overcome..."
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500"
            />
          </div>

          <Input
            label="Skills &amp; Technologies (comma-separated)"
            placeholder="e.g. TypeScript, Node.js, MongoDB, Docker"
            value={projectSkills}
            onChange={(e) => setProjectSkills(e.target.value)}
            required
            helperText="Every skill will be mapped to canonical nodes in your evidence vault."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="GitHub Repository URL"
              placeholder="https://github.com/username/project"
              value={projectRepoUrl}
              onChange={(e) => setProjectRepoUrl(e.target.value)}
            />
            <Input
              label="Live Deployment Demo URL"
              placeholder="https://myproject.dev"
              value={projectLiveUrl}
              onChange={(e) => setProjectLiveUrl(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="ongoing-check"
              checked={projectOngoing}
              onChange={(e) => setProjectOngoing(e.target.checked)}
              className="rounded bg-[#070d18] border-slate-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="ongoing-check" className="text-xs text-slate-300 cursor-pointer">
              This is an active, ongoing project deliverable
            </label>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
