import React from 'react';
import {
  FileCheck2,
  Sparkles,
  Users,
  Briefcase,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
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

export const OfficerDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Officer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Placement Officer Command Center
            </h1>
            <Badge variant="electric" size="sm" dot>
              {user?.email || 'Authorized Evaluator'}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Institutional placement operations, evidence auditing, and explainable cohort ranking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" icon={<UploadCloud className="w-4 h-4" />}>
            Import Job CSV
          </Button>
          <Button variant="primary" size="sm" icon={<Sparkles className="w-4 h-4" />}>
            Run Batch Ranking
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Evidence In Queue
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <FileCheck2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">14 Pending</div>
            <p className="text-[11px] text-blue-400/80 mt-1">Requires faculty review</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Requisitions
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">9 Active Jobs</div>
            <p className="text-[11px] text-teal-400/80 mt-1">From partner companies</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Registered Cohort
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">142 Students</div>
            <p className="text-[11px] text-purple-400/80 mt-1">Graduating batches 2025–2027</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Audit Integrity
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">100% Verified</div>
            <p className="text-[11px] text-emerald-400/80 mt-1">Zero unreviewed approvals</p>
          </CardContent>
        </Card>
      </div>

      {/* Primary Workspaces Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Evidence Verification Queue</CardTitle>
              <Badge variant="warning" size="sm">
                Action Required
              </Badge>
            </div>
            <CardDescription>
              Evaluate submitted student artifacts, assign demonstrated proficiency, and log audit
              notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Rahul Patel (CS2024001)</span>
                  <Badge variant="electric" size="sm">
                    TypeScript
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Type: Evaluated Project &bull; &quot;High-throughput Event Broker&quot;
                </p>
              </div>
              <Button variant="outline" size="sm">
                Review Proof
              </Button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#070d18] border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Priya Sharma (CS2024042)</span>
                  <Badge variant="teal" size="sm">
                    Docker
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Type: Verified Certification &bull; Docker Certified Associate
                </p>
              </div>
              <Button variant="outline" size="sm">
                Review Proof
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Deterministic Match Engine Hub</CardTitle>
              <Badge variant="electric" size="sm">
                Formula v1.0
              </Badge>
            </div>
            <CardDescription>
              Rank entire batches against published company job requisitions with mathematical
              explanation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 space-y-2 text-xs">
              <div className="text-slate-300 font-medium">Scoring Policy:</div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Required Skills Weight:</span>
                <span className="font-semibold text-blue-400">3x</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Preferred Skills Weight:</span>
                <span className="font-semibold text-teal-400">1x</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Eligibility Criteria:</span>
                <span className="font-semibold text-emerald-400">Isolated Pre-Check</span>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Open Batch Ranking Console
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
