import React from 'react';
import { Briefcase, Users, Plus, CheckCircle2, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const RecruiterDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Recruiter Talent Suite
            </h1>
            <Badge variant="teal" size="sm" dot>
              {user?.email || 'Verified Partner'}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Source candidates backed by verified academic deliverables and deterministically audited
            code skills.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            Post Requisition
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Requisitions
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">3 Postings</div>
            <p className="text-[11px] text-blue-400/80 mt-1">Fullstack &amp; Backend roles</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Ranked Candidates
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">28 Shortlisted</div>
            <p className="text-[11px] text-teal-400/80 mt-1">&gt;85% Fit Score threshold</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Proof Verification
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">100% Audited</div>
            <p className="text-[11px] text-emerald-400/80 mt-1">Zero unverified resume claims</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Job Requisitions Preview */}
      <Card className="border-slate-800 bg-[#0b1329]">
        <CardHeader>
          <CardTitle>Company Job Postings &amp; Real-Time Matching</CardTitle>
          <CardDescription>
            Requisitions currently live on campus with deterministic applicant ranking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-semibold text-white">Senior Fullstack Engineer</h4>
                <Badge variant="success" size="sm">
                  Active
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Required: TypeScript, React, Node.js &bull; Preferred: Docker, Redis &bull; Min
                CGPA: 7.5
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-bold text-teal-400">14 Verified Matches</div>
                <div className="text-[11px] text-slate-500">Top fit: 94.2%</div>
              </div>
              <Button variant="outline" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                View Cohort
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
