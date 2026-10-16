import React, { useState } from 'react';
import { Award, Briefcase, Plus, ExternalLink, ShieldCheck, Clock, Sparkles } from 'lucide-react';
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/Table';
import { Dialog } from '../../components/ui/Dialog';
import { Tooltip } from '../../components/ui/Tooltip';

export const StudentDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome & Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Student Placement Hub
            </h1>
            <Badge variant="electric" size="sm" dot>
              {profile?.rollNumber || user?.email || 'Active'}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            {profile?.department || 'Engineering Student'} &bull; Class of{' '}
            {profile?.graduationYear || 2026} &bull; CGPA:{' '}
            <span className="text-blue-400 font-semibold">{profile?.cgpa || '8.85'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsSubmitModalOpen(true)}
          >
            Submit Skill Evidence
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Verified Skills
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">4 Skills</div>
            <p className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% verified by faculty/officer
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Pending Reviews
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">2 Records</div>
            <p className="text-[11px] text-amber-400/80 mt-1">In officer evaluation queue</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Matched Requisitions
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">8 Jobs</div>
            <p className="text-[11px] text-blue-400/80 mt-1">Passing eligibility &amp; criteria</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0b1329]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Average Match Score
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">91.4%</div>
            <p className="text-[11px] text-teal-400/80 mt-1">Top tier cohort alignment</p>
          </CardContent>
        </Card>
      </div>

      {/* Verified Evidence Records Showcase */}
      <Card className="border-slate-800 bg-[#0b1329]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Evidence Vault &amp; Verified Claims</CardTitle>
            <CardDescription>
              Evidence submitted with institutional verification stamps and deterministic weights.
            </CardDescription>
          </div>
          <Tooltip content="All records are immutable once verified by an officer" position="left">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 cursor-help">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Audited Records
            </span>
          </Tooltip>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skill Name</TableHead>
                <TableHead>Evidence Type</TableHead>
                <TableHead>Demonstrated Match Value</TableHead>
                <TableHead>Verification Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold text-white flex items-center gap-2">
                  <span>TypeScript</span>
                  <Badge variant="electric" size="sm">
                    Canonical
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-300">
                  <div className="text-xs font-medium">Evaluated Project</div>
                  <div className="text-[11px] text-slate-500">Distributed Engine Core</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-500 h-2 rounded-full w-[95%]" />
                    </div>
                    <span className="text-xs font-mono font-medium text-blue-400">0.95 / 1.0</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="success" size="sm" dot>
                    Verified
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                    View Proof
                  </Button>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell className="font-semibold text-white flex items-center gap-2">
                  <span>React</span>
                  <Badge variant="electric" size="sm">
                    Canonical
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-300">
                  <div className="text-xs font-medium">Proctored Assessment</div>
                  <div className="text-[11px] text-slate-500">Campus Tech Round 2026</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-teal-500 h-2 rounded-full w-[90%]" />
                    </div>
                    <span className="text-xs font-mono font-medium text-teal-400">0.90 / 1.0</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="success" size="sm" dot>
                    Verified
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                    View Proof
                  </Button>
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell className="font-semibold text-white flex items-center gap-2">
                  <span>MongoDB</span>
                  <Badge variant="electric" size="sm">
                    Canonical
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-300">
                  <div className="text-xs font-medium">Verified Certification</div>
                  <div className="text-[11px] text-slate-500">MongoDB Associate Developer</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-amber-500 h-2 rounded-full w-[80%]" />
                    </div>
                    <span className="text-xs font-mono font-medium text-amber-400">0.80 / 1.0</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="warning" size="sm" dot>
                    Under Review
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                    View Proof
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Submit Evidence Dialog Modal */}
      <Dialog
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Submit Skill Evidence Record"
        description="Attach verified proof to support your claimed proficiency. Only faculty and placement officers can certify records."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsSubmitModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsSubmitModalOpen(false);
              }}
            >
              Submit for Review
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="p-3.5 rounded-xl bg-[#070d18] border border-blue-500/20 text-xs text-blue-300 leading-relaxed">
            Note: Supplying a GitHub repository or certificate link registers your submission as
            &quot;Under Review&quot;. An authorized evaluator will audit the deliverable before
            assigning verified status.
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Target Skill</label>
            <input
              type="text"
              placeholder="e.g. Node.js, Python, Docker"
              className="w-full rounded-xl bg-[#070d18] border border-slate-800 py-2 px-3 text-sm text-slate-200 outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Evidence URL / Proof Link
            </label>
            <input
              type="text"
              placeholder="https://github.com/org/repo or certification credential URL"
              className="w-full rounded-xl bg-[#070d18] border border-slate-800 py-2 px-3 text-sm text-slate-200 outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};
