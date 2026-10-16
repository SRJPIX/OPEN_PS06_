import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building,
  GraduationCap,
  ExternalLink,
  Send,
  Plus,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';

interface AlumniItem {
  _id: string;
  fullName: string;
  email: string;
  graduationYear: number;
  degree: string;
  department: string;
  companyName: string;
  designation: string;
  experienceYears: number;
  location?: string;
  linkedinUrl?: string;
  referralAvailable: boolean;
  maxReferralsPerMonth: number;
  activeReferralsCount: number;
  preferredSkills?: string[];
  referralGuidelines?: string;
  isVerified: boolean;
}

export const AlumniDirectoryPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [company, setCompany] = useState('');
  const [referralOnly, setReferralOnly] = useState(false);

  // Referral Modal
  const [referralAlumni, setReferralAlumni] = useState<AlumniItem | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [referralNote, setReferralNote] = useState('');

  // Register Profile Modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [gradYear, setGradYear] = useState('2023');
  const [dept, setDept] = useState('Computer Science');
  const [regCompany, setRegCompany] = useState('');
  const [designation, setDesignation] = useState('');
  const [experienceYears, setExperienceYears] = useState('2');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [referralAvailable, setReferralAvailable] = useState(true);
  const [guidelines, setGuidelines] = useState('');

  const queryParams = new URLSearchParams();
  if (search.trim()) queryParams.set('search', search.trim());
  if (department) queryParams.set('department', department);
  if (company.trim()) queryParams.set('company', company.trim());
  if (referralOnly) queryParams.set('referralOnly', 'true');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{ alumni: AlumniItem[]; meta?: { total: number } }>({
    queryKey: ['alumni-directory', search, department, company, referralOnly],
    queryFn: async () => {
      const res = await api.get<{ alumni: AlumniItem[]; meta?: { total: number } }>(
        `/alumni?${queryParams.toString()}`
      );
      return res;
    },
  });

  const requestReferralMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      return api.post(`/alumni/${id}/request-referral`, payload);
    },
    onSuccess: (res: any) => {
      success(res?.message || 'Referral request submitted successfully!');
      setReferralAlumni(null);
      setTargetRole('');
      setReferralNote('');
      queryClient.invalidateQueries({ queryKey: ['alumni-directory'] });
    },
    onError: (err: any) => {
      toastError(err.message || 'Failed to submit referral request');
    },
  });

  const registerAlumniMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/alumni', payload);
    },
    onSuccess: () => {
      success('Alumni profile published successfully.');
      setIsRegisterOpen(false);
      queryClient.invalidateQueries({ queryKey: ['alumni-directory'] });
    },
    onError: (err: any) => {
      toastError(err.message || 'Failed to publish alumni profile');
    },
  });

  const alumniList = data?.alumni || [];
  const openReferralsCount = alumniList.filter((a) => a.referralAvailable).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Alumni Referral Network
            </h1>
            <Badge variant="teal" size="sm" dot>
              {openReferralsCount} Open for Referrals
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Connect with verified campus alumni across top tech companies for guidance and consent-based job referrals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRegisterOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Join as Alumni
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#0b1329] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search by name, company, skill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs py-1.5"
            />
          </div>

          <div className="w-full sm:w-44">
            <Input
              placeholder="Filter by company..."
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="text-xs py-1.5"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 outline-none"
            >
              <option value="">All Departments</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Electronics">Electronics</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={referralOnly}
              onChange={(e) => setReferralOnly(e.target.checked)}
              className="rounded border-slate-700 text-teal-500 focus:ring-0 bg-slate-900"
            />
            Accepting Referrals Only
          </label>
        </div>
      </div>

      {/* Alumni Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Alumni Directory"
          message={(error as any)?.message || 'Could not fetch alumni profiles'}
          onRetry={() => refetch()}
        />
      ) : alumniList.length === 0 ? (
        <EmptyState
          title="No Alumni Found"
          description="Try broadening your search query or department filters to see more verified alumni."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {alumniList.map((alumni) => (
            <Card
              key={alumni._id}
              className="border-slate-800 bg-[#0b1329] hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <CardContent className="p-5 space-y-4">
                {/* Header Profile */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                      {alumni.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white leading-tight">
                        {alumni.fullName}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">{alumni.designation}</p>
                    </div>
                  </div>
                  {alumni.referralAvailable ? (
                    <Badge variant="teal" size="sm">
                      Referral Open
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      Inactive
                    </Badge>
                  )}
                </div>

                {/* Company & Education details */}
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-white">{alumni.companyName}</span>
                    <span className="text-[11px] text-slate-500">
                      ({alumni.experienceYears}y exp)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Class of {alumni.graduationYear} &bull; {alumni.department}
                    </span>
                  </div>
                </div>

                {/* Preferred skills tags */}
                {alumni.preferredSkills && alumni.preferredSkills.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {alumni.preferredSkills.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/50"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Referral guidelines quote */}
                {alumni.referralGuidelines && (
                  <p className="text-[11px] text-slate-400 italic line-clamp-2 bg-[#070d18] p-2 rounded-lg border border-slate-800">
                    &ldquo;{alumni.referralGuidelines}&rdquo;
                  </p>
                )}

                {/* Card footer with actions */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  {alumni.linkedinUrl ? (
                    <a
                      href={alumni.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      LinkedIn
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-500">Verified Campus Alumni</span>
                  )}

                  <Button
                    variant={alumni.referralAvailable ? 'primary' : 'outline'}
                    size="sm"
                    disabled={!alumni.referralAvailable}
                    onClick={() => setReferralAlumni(alumni)}
                    icon={<Send className="w-3.5 h-3.5" />}
                  >
                    Request Referral
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL 1: REQUEST REFERRAL */}
      <Dialog
        isOpen={Boolean(referralAlumni)}
        onClose={() => setReferralAlumni(null)}
        title={`Request Referral: ${referralAlumni?.fullName} (${referralAlumni?.companyName})`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (referralAlumni) {
              requestReferralMutation.mutate({
                id: referralAlumni._id,
                payload: {
                  targetRole,
                  note: referralNote,
                },
              });
            }
          }}
          className="space-y-4"
        >
          <p className="text-xs text-slate-400">
            Submit a respectful referral request. Your verified profile, academic CGPA, and audited project deliverables will be linked with your submission.
          </p>

          {referralAlumni?.referralGuidelines && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
              <span className="font-semibold block mb-0.5">Alumni Guidelines:</span>
              {referralAlumni.referralGuidelines}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Target Job Role or Requisition ID *
            </label>
            <Input
              required
              placeholder="e.g. Associate Software Engineer (Req #10492)"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Message to Alumni *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Introduce yourself, mention relevant course projects or verified skills, and explain why you're a good fit..."
              value={referralNote}
              onChange={(e) => setReferralNote(e.target.value)}
              className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReferralAlumni(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={requestReferralMutation.isPending}
            >
              Submit Referral Request
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL 2: JOIN AS ALUMNI */}
      <Dialog
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register as Campus Alumni"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            registerAlumniMutation.mutate({
              fullName,
              email,
              graduationYear: Number(gradYear),
              degree: 'B.Tech',
              department: dept,
              companyName: regCompany,
              designation,
              experienceYears: Number(experienceYears),
              linkedinUrl,
              referralAvailable,
              referralGuidelines: guidelines,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name *</label>
              <Input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Priya Sharma"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Email *</label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Company *</label>
              <Input
                required
                value={regCompany}
                onChange={(e) => setRegCompany(e.target.value)}
                placeholder="e.g. Google, Stripe"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Designation *</label>
              <Input
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Software Engineer II"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Graduation Year</label>
              <Input
                type="number"
                value={gradYear}
                onChange={(e) => setGradYear(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Department</label>
              <Input
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Exp (Years)</label>
              <Input
                type="number"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">LinkedIn Profile</label>
            <Input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/username"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="refAvail"
              checked={referralAvailable}
              onChange={(e) => setReferralAvailable(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-teal-500"
            />
            <label htmlFor="refAvail" className="text-xs text-slate-300 select-none cursor-pointer">
              I am open to receiving referral requests from qualified students
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Referral Guidelines (Optional)
            </label>
            <textarea
              rows={2}
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              placeholder="e.g. Open to referring students with strong backend skills and live demo links."
              className="w-full bg-[#070d18] border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRegisterOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={registerAlumniMutation.isPending}
            >
              Publish Profile
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

