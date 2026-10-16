import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Award,
  ShieldCheck,
  Clock,
  AlertCircle,
  FileCheck,
  Plus,
  ExternalLink,
  Search,
  CheckCircle2,
  FolderGit2,
} from 'lucide-react';
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
import type { StudentSkillItem, EvidenceItem } from '../../types/student';

interface ProfileResponse {
  skills: StudentSkillItem[];
  metrics: {
    totalSkills: number;
    verifiedSkills: number;
    totalEvidence: number;
    verifiedEvidence: number;
  };
}

export const SkillsPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'verified' | 'under_review' | 'self_reported'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddSkillModalOpen, setIsAddSkillModalOpen] = useState(false);
  const [isSubmitEvidenceModalOpen, setIsSubmitEvidenceModalOpen] = useState(false);
  const [inspectEvidenceItem, setInspectEvidenceItem] = useState<EvidenceItem | null>(null);

  // Form states for adding skill
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillProficiency, setNewSkillProficiency] = useState<'beginner' | 'intermediate' | 'advanced' | 'expert'>('intermediate');

  // Form states for submitting evidence
  const [evidenceType, setEvidenceType] = useState('evaluated_project');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceSkill, setEvidenceSkill] = useState('');

  // Fetch student skills
  const { data: profileData, isLoading: isSkillsLoading, isError: isSkillsError, error: skillsError, refetch: refetchSkills } = useQuery<ProfileResponse>({
    queryKey: ['student-profile-me'],
    queryFn: () => api.get<ProfileResponse>('/students/profile/me'),
  });

  // Fetch student evidence items
  const { data: evidenceData, isLoading: isEvidenceLoading } = useQuery<EvidenceItem[]>({
    queryKey: ['student-evidence-list'],
    queryFn: () => api.get<EvidenceItem[]>('/evidence'),
  });

  // Add Skill Mutation
  const addSkillMutation = useMutation({
    mutationFn: (payload: { name: string; proficiency: string }) =>
      api.post('/students/skills', payload),
    onSuccess: () => {
      success('Skill Recorded', 'Skill recorded and resolved to canonical dictionary.');
      setIsAddSkillModalOpen(false);
      setNewSkillName('');
      queryClient.invalidateQueries({ queryKey: ['student-profile-me'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
    },
    onError: (err: any) => {
      toastError('Failed to record skill', err.message || 'Error communicating with dictionary.');
    },
  });

  // Submit Evidence Mutation
  const submitEvidenceMutation = useMutation({
    mutationFn: (payload: {
      type: string;
      title: string;
      description?: string;
      url?: string;
      skills: string[];
    }) => api.post('/evidence', payload),
    onSuccess: () => {
      success('Evidence Submitted', 'Artifact recorded with status "Submitted". Awaiting faculty review.');
      setIsSubmitEvidenceModalOpen(false);
      setEvidenceTitle('');
      setEvidenceDescription('');
      setEvidenceUrl('');
      setEvidenceSkill('');
      queryClient.invalidateQueries({ queryKey: ['student-profile-me'] });
      queryClient.invalidateQueries({ queryKey: ['student-evidence-list'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
    },
    onError: (err: any) => {
      toastError('Submission Failed', err.message || 'Could not submit evidence.');
    },
  });

  if (isSkillsLoading || isEvidenceLoading) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (isSkillsError) {
    return (
      <ErrorState
        title="Could not load skills & evidence"
        message={skillsError instanceof Error ? skillsError.message : 'Please check your connection.'}
        onRetry={() => refetchSkills()}
      />
    );
  }

  const allSkills = profileData?.skills || [];
  const allEvidence = evidenceData || [];

  // Filter skills by tab and search
  const filteredSkills = allSkills.filter((s) => {
    const matchesSearch =
      s.skill?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.skill?.category?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'verified') return s.isVerified && s.status === 'verified';
    if (activeTab === 'under_review') return s.status === 'under_review' || s.status === 'submitted';
    if (activeTab === 'self_reported') return s.status === 'self_reported';
    return true;
  });

  const verifiedSkillsCount = allSkills.filter((s) => s.isVerified).length;
  const underReviewCount = allSkills.filter((s) => s.status === 'under_review' || s.status === 'submitted').length;
  const selfReportedCount = allSkills.filter((s) => s.status === 'self_reported').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Skills &amp; Evidence Vault
            </h1>
            <Badge variant="electric" size="sm" dot>
              Cryptographic Proof
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Every skill claim is backed by proctored tests, faculty-evaluated projects, and verified
            repositories.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsAddSkillModalOpen(true)}
          >
            Add Skill
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<FolderGit2 className="w-3.5 h-3.5" />}
            onClick={() => setIsSubmitEvidenceModalOpen(true)}
          >
            Submit Evidence
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Verified Skills
              </span>
              <div className="text-2xl font-extrabold text-white mt-1">
                {verifiedSkillsCount} <span className="text-xs text-slate-500 font-normal">/ {allSkills.length} total</span>
              </div>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3" /> Fully eligible for recruiter ranking
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Under Officer Review
              </span>
              <div className="text-2xl font-extrabold text-amber-400 mt-1">
                {underReviewCount} Skills
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                In evaluation pipeline with pending sign-off
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Self-Reported Only
              </span>
              <div className="text-2xl font-extrabold text-slate-300 mt-1">
                {selfReportedCount} Skills
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Zero weight in match score until evidence attached
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0b1329] border border-slate-800 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Skills ({allSkills.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'verified'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Verified ({verifiedSkillsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('under_review')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'under_review'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Under Review ({underReviewCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('self_reported')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'self_reported'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Self-Reported ({selfReportedCount})
          </button>
        </div>

        {/* Search */}
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search skills by name or category..."
            leftIcon={<Search className="w-3.5 h-3.5" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <EmptyState
          icon={<Award className="w-8 h-8 text-slate-500" />}
          title="No skills found"
          description={
            searchQuery
              ? `No skills matching "${searchQuery}".`
              : 'You have not added any skills in this category yet. Click "Add Skill" to record one.'
          }
          action={{
            label: 'Add New Skill',
            onClick: () => setIsAddSkillModalOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSkills.map((item) => {
            const skill = item.skill;
            const evidenceCount = item.evidence?.length || 0;

            const statusConfig = {
              verified: {
                badge: <Badge variant="success" size="sm" dot>Verified</Badge>,
                color: 'text-emerald-400',
                border: 'border-emerald-500/20',
                bg: 'bg-emerald-950/10',
              },
              under_review: {
                badge: <Badge variant="warning" size="sm" dot>Under Review</Badge>,
                color: 'text-amber-400',
                border: 'border-amber-500/20',
                bg: 'bg-amber-950/10',
              },
              submitted: {
                badge: <Badge variant="electric" size="sm" dot>Submitted</Badge>,
                color: 'text-blue-400',
                border: 'border-blue-500/20',
                bg: 'bg-blue-950/10',
              },
              self_reported: {
                badge: <Badge variant="neutral" size="sm" dot>Self-Reported</Badge>,
                color: 'text-slate-400',
                border: 'border-slate-800',
                bg: 'bg-[#070d18]',
              },
              rejected: {
                badge: <Badge variant="danger" size="sm" dot>Rejected</Badge>,
                color: 'text-rose-400',
                border: 'border-rose-500/20',
                bg: 'bg-rose-950/10',
              },
              needs_additional_evidence: {
                badge: <Badge variant="warning" size="sm" dot>Needs Evidence</Badge>,
                color: 'text-amber-400',
                border: 'border-amber-500/20',
                bg: 'bg-amber-950/10',
              },
            }[item.status] || {
              badge: <Badge variant="neutral" size="sm">Active</Badge>,
              color: 'text-slate-400',
              border: 'border-slate-800',
              bg: 'bg-[#070d18]',
            };

            return (
              <Card
                key={item._id}
                className={`border bg-[#0b1329] transition-all hover:border-slate-700 ${statusConfig.border}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {skill?.name || 'Skill'}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {skill?.category || 'General'}
                        </span>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-xs text-slate-400 capitalize">
                          {item.proficiency}
                        </span>
                      </div>
                    </div>
                    {statusConfig.badge}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Confidence Score Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400">Match Confidence Value:</span>
                      <span className={`font-mono font-semibold ${statusConfig.color}`}>
                        {item.confidenceScore}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.isVerified ? 'bg-emerald-400' : 'bg-blue-500'
                        }`}
                        style={{ width: `${item.confidenceScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Linked Evidence Count */}
                  <div className="p-3 rounded-xl bg-[#070d18] border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <FileCheck className="w-4 h-4 text-blue-400" />
                      <span>{evidenceCount} Evidence Deliverable{evidenceCount !== 1 ? 's' : ''}</span>
                    </div>

                    {evidenceCount > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const ev = allEvidence.find((e) =>
                            e.skills?.some((s) => s._id === skill?._id || s.slug === skill?.slug)
                          );
                          if (ev) setInspectEvidenceItem(ev);
                        }}
                      >
                        Inspect Proof
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300"
                        onClick={() => {
                          setEvidenceSkill(skill?.name || '');
                          setIsSubmitEvidenceModalOpen(true);
                        }}
                      >
                        + Attach Proof
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Skill Dialog */}
      <Dialog
        isOpen={isAddSkillModalOpen}
        onClose={() => setIsAddSkillModalOpen(false)}
        title="Record New Skill"
        description="Add a skill to your portfolio. It will be mapped to the canonical dictionary via alias normalization."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsAddSkillModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={addSkillMutation.isPending}
              disabled={!newSkillName.trim()}
              onClick={() => {
                addSkillMutation.mutate({
                  name: newSkillName.trim(),
                  proficiency: newSkillProficiency,
                });
              }}
            >
              Add to Portfolio
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/30 text-xs text-blue-300 leading-relaxed">
            <span className="font-semibold text-white">Integrity Principle:</span> Adding a skill records
            it as <em>Self-Reported</em>. To have it count toward recruiter fit scoring, you must submit
            verifiable evidence.
          </div>

          <Input
            label="Skill Name or Common Alias"
            placeholder="e.g. ReactJS, TypeScript, Docker, MongoDB"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            required
            helperText="Aliases like 'React.js', 'JS', 'NodeJS' are automatically normalized."
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Self-Assessed Proficiency</label>
            <select
              value={newSkillProficiency}
              onChange={(e: any) => setNewSkillProficiency(e.target.value)}
              className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
            >
              <option value="beginner">Beginner - Basic syntax and concepts</option>
              <option value="intermediate">Intermediate - Built practical projects</option>
              <option value="advanced">Advanced - Production architecture &amp; optimization</option>
              <option value="expert">Expert - Deep internals, performance &amp; tooling</option>
            </select>
          </div>
        </div>
      </Dialog>

      {/* Submit Evidence Dialog */}
      <Dialog
        isOpen={isSubmitEvidenceModalOpen}
        onClose={() => setIsSubmitEvidenceModalOpen(false)}
        title="Submit Evidence Artifact"
        description="Submit verifiable code, evaluations, or credentials to certify your demonstrated proficiency."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsSubmitEvidenceModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={submitEvidenceMutation.isPending}
              disabled={!evidenceTitle.trim() || !evidenceSkill.trim()}
              onClick={() => {
                submitEvidenceMutation.mutate({
                  type: evidenceType,
                  title: evidenceTitle.trim(),
                  description: evidenceDescription.trim(),
                  url: evidenceUrl.trim() || undefined,
                  skills: [evidenceSkill.trim()],
                });
              }}
            >
              Submit for Verification
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Evidence Category</label>
            <select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value)}
              className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
            >
              <option value="evaluated_project">Evaluated Course / Capstone Project</option>
              <option value="coding_assessment">Proctored Coding Assessment</option>
              <option value="technical_quiz">Technical Quiz / Evaluation</option>
              <option value="github_repo">GitHub Repository / Open Source Commit</option>
              <option value="verified_certification">Verified Professional Certification</option>
              <option value="other_reviewed_evidence">Other Reviewed Faculty Proof</option>
            </select>
          </div>

          <Input
            label="Linked Skill"
            placeholder="e.g. React, TypeScript, Python"
            value={evidenceSkill}
            onChange={(e) => setEvidenceSkill(e.target.value)}
            required
            helperText="The canonical skill validated by this artifact"
          />

          <Input
            label="Evidence Title"
            placeholder="e.g. High-throughput Distributed Queue Engine"
            value={evidenceTitle}
            onChange={(e) => setEvidenceTitle(e.target.value)}
            required
          />

          <Input
            label="Repository or Credential URL"
            placeholder="https://github.com/org/repo or verification link"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Description &amp; Implementation Details</label>
            <textarea
              rows={3}
              placeholder="Outline what you built, architecture decisions, and technologies used..."
              value={evidenceDescription}
              onChange={(e) => setEvidenceDescription(e.target.value)}
              className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </Dialog>

      {/* Inspect Evidence Modal */}
      {inspectEvidenceItem && (
        <Dialog
          isOpen={!!inspectEvidenceItem}
          onClose={() => setInspectEvidenceItem(null)}
          title={inspectEvidenceItem.title}
          description={`Category: ${inspectEvidenceItem.type.replace(/_/g, ' ')}`}
          footer={
            <Button variant="outline" size="sm" onClick={() => setInspectEvidenceItem(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#070d18] border border-slate-800">
              <span className="text-xs text-slate-400">Current Status:</span>
              <Badge
                variant={inspectEvidenceItem.isVerified ? 'success' : 'warning'}
                size="sm"
                dot
              >
                {inspectEvidenceItem.status}
              </Badge>
            </div>

            {inspectEvidenceItem.description && (
              <div>
                <span className="text-xs font-semibold text-slate-300">Deliverable Notes:</span>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {inspectEvidenceItem.description}
                </p>
              </div>
            )}

            {inspectEvidenceItem.evaluatorNotes && (
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Evaluator Verification Notes:
                </span>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {inspectEvidenceItem.evaluatorNotes}
                </p>
              </div>
            )}

            {inspectEvidenceItem.url && (
              <div className="pt-2">
                <a
                  href={inspectEvidenceItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View External Proof Deliverable
                </a>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
};
