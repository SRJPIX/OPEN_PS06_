import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap,
  ArrowLeft,
  Award,
  FileCheck2,
  FolderGit2,
  Briefcase,
  FileText,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
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
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import type { StudentDetailsData } from '../../types/officer';

export const StudentDetailsPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    'skills' | 'evidence' | 'projects' | 'assessments' | 'applications' | 'resumes'
  >('skills');

  const { data, isLoading, isError, error, refetch } = useQuery<StudentDetailsData>({
    queryKey: ['officer-student-detail', studentId],
    queryFn: () => api.get<StudentDetailsData>(`/students/${studentId}`),
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !data?.profile) {
    return (
      <ErrorState
        title="Student record not found"
        message={error instanceof Error ? error.message : 'Unable to load student dossier.'}
        onRetry={() => refetch()}
      />
    );
  }

  const { profile, skills = [], evidence = [], projects = [], assessments = [], applications = [], resumes = [] } = data;

  const verifiedSkills = skills.filter((s) => s.isVerified);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Navigation */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/officer/students')}
          className="text-slate-400 hover:text-white mb-3"
        >
          Back to Student Directory
        </Button>

        {/* Profile Dossier Header */}
        <Card className="border-slate-800 bg-[#0b1329] p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-purple-600 to-teal-400 p-[1px] shadow-lg shadow-purple-900/20 shrink-0">
                <div className="w-full h-full bg-[#070d18] rounded-[15px] flex items-center justify-center text-purple-400">
                  <GraduationCap className="w-8 h-8" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-extrabold text-white tracking-tight">
                    {profile.rollNumber}
                  </h1>
                  <Badge variant="teal" size="sm">
                    Class of {profile.graduationYear}
                  </Badge>
                  <Badge variant="electric" size="sm">
                    CGPA: {profile.cgpa?.toFixed(2) || 'N/A'}
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {profile.user?.status || 'active'}
                  </Badge>
                </div>
                <p className="text-sm text-slate-300 mt-1">
                  {profile.degree} &bull; {profile.department}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{profile.user?.email}</p>
                {profile.bio && <p className="text-xs text-slate-300 italic mt-2">{profile.bio}</p>}
              </div>
            </div>

            {/* Quick Stats Pill */}
            <div className="grid grid-cols-3 gap-3 border border-slate-800/80 rounded-xl p-3 bg-[#070d18] text-center self-start md:self-auto">
              <div className="px-3">
                <div className="text-xl font-bold text-emerald-400">{verifiedSkills.length}</div>
                <div className="text-[10px] uppercase text-slate-400 font-medium">Verified</div>
              </div>
              <div className="px-3 border-x border-slate-800">
                <div className="text-xl font-bold text-blue-400">{evidence.length}</div>
                <div className="text-[10px] uppercase text-slate-400 font-medium">Artifacts</div>
              </div>
              <div className="px-3">
                <div className="text-xl font-bold text-purple-400">{applications.length}</div>
                <div className="text-[10px] uppercase text-slate-400 font-medium">Applied</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Dossier Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('skills')}
          className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'skills'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Skills Inventory ({skills.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'evidence'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Evidence Trail ({evidence.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'projects'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>Projects ({projects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assessments')}
          className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'assessments'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Assessments ({assessments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'applications'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Applications ({applications.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resumes')}
          className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shrink-0 ${
            activeTab === 'resumes'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Resumes ({resumes.length})</span>
        </button>
      </div>

      {/* Tab 1: Skills Inventory */}
      {activeTab === 'skills' && (
        <div className="space-y-6">
          <Card className="border-slate-800 bg-[#0b1329]">
            <CardHeader>
              <CardTitle className="text-base font-bold text-white">
                Demonstrated & Verified Competencies
              </CardTitle>
              <CardDescription>
                Skills verified through peer review, code repository analysis, proctored assessments, or certifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {skills.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No skills recorded yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {skills.map((sk) => (
                    <div
                      key={sk._id}
                      className="p-4 rounded-xl bg-[#070d18] border border-slate-800 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white">{sk.skill?.name}</span>
                          <Badge
                            variant={sk.isVerified ? 'success' : 'neutral'}
                            size="sm"
                            dot={sk.isVerified}
                          >
                            {sk.isVerified ? 'Verified' : 'Self-Reported'}
                          </Badge>
                          <span className="text-[11px] text-slate-400 capitalize">
                            &bull; {sk.proficiency}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 capitalize">
                          Category: {sk.skill?.category?.replace('_', ' ')}
                        </p>
                        {sk.evidence && sk.evidence.length > 0 && (
                          <div className="mt-2 text-xs text-blue-400 flex items-center gap-1">
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>{sk.evidence.length} supporting artifact(s)</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-extrabold text-blue-400">
                          {sk.confidenceScore}%
                        </span>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                          Confidence
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Evidence Trail */}
      {activeTab === 'evidence' && (
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Evidence Trail</CardTitle>
            <CardDescription>
              All submitted proof artifacts, evaluation notes, and faculty verification records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {evidence.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No evidence artifacts uploaded.</p>
            ) : (
              evidence.map((ev) => (
                <div
                  key={ev._id}
                  className="p-4 rounded-xl bg-[#070d18] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{ev.title}</span>
                      <Badge
                        variant={
                          ev.status === 'verified'
                            ? 'success'
                            : ev.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {ev.status}
                      </Badge>
                      <span className="text-xs text-slate-400 capitalize">
                        &bull; {ev.type.replace('_', ' ')}
                      </span>
                    </div>
                    {ev.description && (
                      <p className="text-xs text-slate-300 leading-relaxed">{ev.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 flex-wrap">
                      <span>Submitted: {new Date(ev.createdAt).toLocaleDateString()}</span>
                      {ev.skills?.map((s) => (
                        <span key={s._id} className="text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {ev.url && (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="self-start sm:self-center shrink-0"
                    >
                      <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                        Inspect Link
                      </Button>
                    </a>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Projects */}
      {activeTab === 'projects' && (
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Evaluated Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No projects listed.</p>
            ) : (
              projects.map((proj) => (
                <div
                  key={proj._id}
                  className="p-4 rounded-xl bg-[#070d18] border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-white">{proj.title}</h3>
                    {proj.repoUrl && (
                      <a href={proj.repoUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" icon={<FolderGit2 className="w-3.5 h-3.5" />}>
                          Repository
                        </Button>
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">{proj.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {proj.skills?.map((s) => (
                      <Badge key={s._id} variant="neutral" size="sm">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Assessments */}
      {activeTab === 'assessments' && (
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Proctored Assessments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {assessments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No assessments completed.</p>
            ) : (
              assessments.map((ass) => (
                <div
                  key={ass._id}
                  className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{ass.title}</span>
                      <Badge variant={ass.passed ? 'success' : 'danger'} size="sm">
                        {ass.passed ? 'Passed' : 'Failed'}
                      </Badge>
                      <span className="text-xs text-slate-400 uppercase">
                        &bull; {ass.provider}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Score: {ass.score}/{ass.maxScore} (
                      {Math.round((ass.score / ass.maxScore) * 100)}%)
                    </p>
                  </div>
                  {ass.certificateUrl && (
                    <a href={ass.certificateUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                        Certificate
                      </Button>
                    </a>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Applications */}
      {activeTab === 'applications' && (
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Application Pipeline History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {applications.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No job applications submitted yet.</p>
            ) : (
              applications.map((app) => (
                <div
                  key={app._id}
                  className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-bold text-white">
                      {app.job?.title} &bull; {app.job?.company?.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Applied on {new Date(app.appliedAt).toLocaleDateString()} using &quot;
                      {app.resume?.title}&quot; (v{app.resume?.version})
                    </p>
                  </div>
                  <Badge
                    variant={
                      app.currentStatus === 'offered'
                        ? 'success'
                        : app.currentStatus === 'rejected'
                        ? 'danger'
                        : app.currentStatus === 'interview'
                        ? 'electric'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {app.currentStatus}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Resumes */}
      {activeTab === 'resumes' && (
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Resumes Created & Uploaded</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resumes.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No resumes found.</p>
            ) : (
              resumes.map((resItem) => (
                <div
                  key={resItem._id}
                  className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{resItem.title}</span>
                      <span className="text-xs text-slate-400">v{resItem.version}</span>
                      {resItem.isPrimary && (
                        <Badge variant="teal" size="sm">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Status: <span className="capitalize">{resItem.status}</span> &bull; Updated:{' '}
                      {new Date(resItem.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
