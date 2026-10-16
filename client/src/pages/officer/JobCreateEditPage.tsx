import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  Save,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';

export const JobCreateEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  // Raw JD parser state
  const [rawJdText, setRawJdText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);

  // Form Fields
  const [title, setTitle] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [requisitionId, setRequisitionId] = useState<string>('');
  const [sourceType, setSourceType] = useState<string>('placement_office');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [location, setLocation] = useState<string>('Bengaluru, India');
  const [workplaceType, setWorkplaceType] = useState<string>('hybrid');
  const [jobType, setJobType] = useState<string>('full_time');
  const [minCgpa, setMinCgpa] = useState<string>('7.0');
  const [eligibleDepartments, setEligibleDepartments] = useState<string>(
    'Computer Science & Engineering, Information Technology'
  );
  const [eligibleGraduationYears, setEligibleGraduationYears] = useState<string>('2025, 2026');
  const [salaryMin, setSalaryMin] = useState<string>('800000');
  const [salaryMax, setSalaryMax] = useState<string>('1400000');
  const [salaryCurrency, setSalaryCurrency] = useState<string>('INR');
  const [deadline, setDeadline] = useState<string>('');
  const [requiredSkills, setRequiredSkills] = useState<string>('React, Node.js, TypeScript');
  const [preferredSkills, setPreferredSkills] = useState<string>('Docker, PostgreSQL, AWS');
  const [description, setDescription] = useState<string>('');
  const [responsibilities, setResponsibilities] = useState<string>('');
  const [status, setStatus] = useState<string>('open');

  // Load existing job if in edit mode
  const { data: existingJobData, isLoading: isLoadingJob } = useQuery<{ job: any }>({
    queryKey: ['officer-job-edit', id],
    queryFn: () => api.get<{ job: any }>(`/jobs/${id}`),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existingJobData?.job) {
      const j = existingJobData.job;
      setTitle(j.title || '');
      setCompany(typeof j.company === 'object' ? j.company?.name : j.company || '');
      setRequisitionId(j.requisitionId || '');
      setSourceType(j.sourceType || 'placement_office');
      setSourceUrl(j.sourceUrl || '');
      setLocation(j.location || '');
      setWorkplaceType(j.workplaceType || 'hybrid');
      setJobType(j.jobType || 'full_time');
      setMinCgpa(j.minCgpa !== undefined ? j.minCgpa.toString() : '');
      setEligibleDepartments(
        Array.isArray(j.eligibleDepartments) ? j.eligibleDepartments.join(', ') : ''
      );
      setEligibleGraduationYears(
        Array.isArray(j.eligibleGraduationYears) ? j.eligibleGraduationYears.join(', ') : ''
      );
      if (j.salaryRange) {
        setSalaryMin(j.salaryRange.min ? j.salaryRange.min.toString() : '');
        setSalaryMax(j.salaryRange.max ? j.salaryRange.max.toString() : '');
        setSalaryCurrency(j.salaryRange.currency || 'INR');
      }
      if (j.deadline) {
        setDeadline(new Date(j.deadline).toISOString().split('T')[0]);
      }
      setRequiredSkills(
        Array.isArray(j.requiredSkills) ? j.requiredSkills.map((s: any) => s.name || s).join(', ') : ''
      );
      setPreferredSkills(
        Array.isArray(j.preferredSkills)
          ? j.preferredSkills.map((s: any) => s.name || s).join(', ')
          : ''
      );
      setDescription(j.description || '');
      setResponsibilities(
        Array.isArray(j.responsibilities) ? j.responsibilities.join('\n') : j.responsibilities || ''
      );
      setStatus(j.status || 'open');
    }
  }, [existingJobData]);

  // AI & Deterministic Parser Mutation
  const handleParseJobDescription = async () => {
    if (!rawJdText.trim()) return;
    setIsParsing(true);
    try {
      const res = await api.post<{ parsed: any }>('/jobs/parse', { text: rawJdText, useLlm: true });
      const p = res?.parsed;
      if (p) {
        if (p.title) setTitle(p.title);
        if (p.workplaceType) setWorkplaceType(p.workplaceType);
        if (p.jobType) setJobType(p.jobType);
        if (p.location) setLocation(p.location);
        if (p.requiredSkills && p.requiredSkills.length > 0) {
          setRequiredSkills(p.requiredSkills.join(', '));
        }
        if (p.preferredSkills && p.preferredSkills.length > 0) {
          setPreferredSkills(p.preferredSkills.join(', '));
        }
        if (p.responsibilities && p.responsibilities.length > 0) {
          setResponsibilities(p.responsibilities.join('\n'));
        }
        if (p.eligibleDepartments && p.eligibleDepartments.length > 0) {
          setEligibleDepartments(p.eligibleDepartments.join(', '));
        }
        if (p.minCgpa) setMinCgpa(p.minCgpa.toString());
        if (!description) setDescription(rawJdText.substring(0, 500));
        success('Parsed Successfully', 'Extracted structured fields from job text.');
      }
    } catch (err: any) {
      toastError('Parser Error', err?.message || 'Could not parse job description.');
    } finally {
      setIsParsing(false);
    }
  };

  // Submit Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        company: company.trim(),
        description: description.trim() || `${title} opening at ${company}`,
        responsibilities: responsibilities
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean),
        location: location.trim(),
        workplaceType,
        jobType,
        status,
        sourceType,
      };

      if (requisitionId.trim()) payload.requisitionId = requisitionId.trim();
      if (sourceUrl.trim()) payload.sourceUrl = sourceUrl.trim();
      if (minCgpa.trim()) payload.minCgpa = parseFloat(minCgpa);

      if (eligibleDepartments.trim()) {
        payload.eligibleDepartments = eligibleDepartments
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean);
      }

      if (eligibleGraduationYears.trim()) {
        payload.eligibleGraduationYears = eligibleGraduationYears
          .split(',')
          .map((y) => parseInt(y.trim(), 10))
          .filter((y) => !isNaN(y));
      }

      if (salaryMin.trim() || salaryMax.trim()) {
        payload.salaryRange = {
          min: salaryMin ? parseFloat(salaryMin) : undefined,
          max: salaryMax ? parseFloat(salaryMax) : undefined,
          currency: salaryCurrency,
        };
      }

      if (deadline) {
        payload.deadline = new Date(deadline).toISOString();
      }

      if (requiredSkills.trim()) {
        payload.requiredSkills = requiredSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      if (preferredSkills.trim()) {
        payload.preferredSkills = preferredSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      if (isEditMode) {
        return api.put(`/jobs/${id}`, payload);
      } else {
        return api.post('/jobs', payload);
      }
    },
    onSuccess: () => {
      success(
        isEditMode ? 'Job Updated' : 'Job Published',
        `Requisition "${title}" has been saved successfully.`
      );
      queryClient.invalidateQueries({ queryKey: ['officer-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['officer-dashboard-stats'] });
      navigate('/officer/jobs');
    },
    onError: (err: any) => {
      toastError(
        'Save Failed',
        err?.message || 'Could not save requisition. Please verify duplicate requisition IDs.'
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !company.trim()) {
      toastError('Validation Error', 'Job Title and Company are required.');
      return;
    }
    saveMutation.mutate();
  };

  if (isEditMode && isLoadingJob) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Top Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/officer/jobs')}
          className="text-slate-400 hover:text-white mb-3"
        >
          Back to Requisitions Catalog
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isEditMode ? 'Edit Job Requisition' : 'Create Job Opening'}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Configure placement opening details, source provenance, canonical skill requirements, and academic eligibility criteria.
            </p>
          </div>
        </div>
      </div>

      {/* Parser Helper Card */}
      {!isEditMode && (
        <Card className="border-blue-500/30 bg-blue-500/5 p-5">
          <CardHeader className="p-0 pb-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Job Description Auto-Extractor</span>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Paste a raw job description or email draft below to automatically extract title, responsibilities, work mode, and canonical skills.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <textarea
              rows={3}
              placeholder="Paste raw JD text here (e.g., 'We are hiring a Fullstack Engineer in Bengaluru with React & Node.js skills, min 7.5 CGPA...')"
              value={rawJdText}
              onChange={(e) => setRawJdText(e.target.value)}
              className="w-full bg-[#070d18] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                icon={<Sparkles className="w-3.5 h-3.5 text-blue-400" />}
                isLoading={isParsing}
                disabled={!rawJdText.trim()}
                onClick={handleParseJobDescription}
              >
                Auto-Extract Fields
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Requisition Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Position Info */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-base text-white">Position & Company Identification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Job Role Title *
                </label>
                <Input
                  placeholder="e.g. Associate Software Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Hiring Company *
                </label>
                <Input
                  placeholder="e.g. Google India, Microsoft, Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Requisition ID (For Exact Deduplication)
                </label>
                <Input
                  placeholder="e.g. REQ-2026-ENG-088"
                  value={requisitionId}
                  onChange={(e) => setRequisitionId(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Source Provenance
                </label>
                <select
                  className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                >
                  <option value="placement_office">Placement Office Verified</option>
                  <option value="recruiter_portal">Recruiter Direct Portal</option>
                  <option value="csv_import">CSV Ingestion</option>
                  <option value="ats_feed">ATS Integration Feed</option>
                  <option value="scraped">Web Scraped Source</option>
                  <option value="manual_entry">Manual Officer Entry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Original Source URL
                </label>
                <Input
                  placeholder="https://company.com/careers/job/..."
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Work Mode & Logistics */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-base text-white">Workplace & Employment Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Workplace Mode
                </label>
                <select
                  className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  value={workplaceType}
                  onChange={(e) => setWorkplaceType(e.target.value)}
                >
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                  <option value="on_site">On-Site</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Job Type
                </label>
                <select
                  className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value)}
                >
                  <option value="full_time">Full-Time</option>
                  <option value="internship">Internship</option>
                  <option value="contract">Contract</option>
                  <option value="part_time">Part-Time</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Location (City / Region)
                </label>
                <Input
                  placeholder="e.g. Bengaluru, India"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Salary Min
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 800000"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Salary Max
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 1500000"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Currency
                </label>
                <Input
                  placeholder="INR, USD"
                  value={salaryCurrency}
                  onChange={(e) => setSalaryCurrency(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Application Deadline
                </label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Eligibility & Skills */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-base text-white">Academic Criteria & Skills Normalization</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Skills are automatically mapped to Evidra&apos;s canonical dictionary. Java and JavaScript strictly remain distinct.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Minimum CGPA Cutoff
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={10}
                  placeholder="e.g. 7.5"
                  value={minCgpa}
                  onChange={(e) => setMinCgpa(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Eligible Graduation Years (Batches)
                </label>
                <Input
                  placeholder="e.g. 2025, 2026"
                  value={eligibleGraduationYears}
                  onChange={(e) => setEligibleGraduationYears(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Eligible Departments (Comma Separated)
              </label>
              <Input
                placeholder="e.g. Computer Science & Engineering, Information Technology, Electronics"
                value={eligibleDepartments}
                onChange={(e) => setEligibleDepartments(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Required Skills (High Weight in Match Engine) *
              </label>
              <Input
                placeholder="e.g. React, Node.js, TypeScript, Python, SQL"
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Preferred / Nice-to-Have Skills
              </label>
              <Input
                placeholder="e.g. Docker, Kubernetes, AWS, Redis, GraphQL"
                value={preferredSkills}
                onChange={(e) => setPreferredSkills(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Description & Status */}
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <CardTitle className="text-base text-white">Description & Publication Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Job Overview / Description
              </label>
              <textarea
                rows={4}
                className="w-full bg-[#070d18] border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Describe role scope, company culture, and team objectives..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Key Responsibilities (One per line)
              </label>
              <textarea
                rows={3}
                className="w-full bg-[#070d18] border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none font-mono text-xs"
                placeholder="Architect scalable microservices&#10;Write comprehensive unit & integration tests&#10;Collaborate with cross-functional product leads"
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Publication Status
              </label>
              <select
                className="w-full sm:w-64 bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="open">Open (Published to Students)</option>
                <option value="draft">Draft (Private to Office)</option>
                <option value="closed">Closed (No New Applications)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Form Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => navigate('/officer/jobs')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={<Save className="w-4 h-4" />}
            isLoading={saveMutation.isPending}
          >
            {isEditMode ? 'Update Requisition' : 'Save & Publish Opening'}
          </Button>
        </div>
      </form>
    </div>
  );
};
