import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Database,
  FileCheck2,
  Cpu,
  Lock,
  GitBranch,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';

export const LandingPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'student':
        return '/student/dashboard';
      case 'placement_officer':
        return '/officer/dashboard';
      case 'recruiter':
        return '/recruiter/dashboard';
      case 'admin':
        return '/officer/dashboard';
      default:
        return '/student/dashboard';
    }
  };

  return (
    <div className="relative overflow-hidden bg-[#070d18] text-slate-100">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-gradient-to-b from-blue-600/15 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-2/3 left-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-20 md:pt-32 md:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
              Every skill. Proven. &bull; Deterministic Placement AI
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1] mb-6">
            Replace Resume Hype With{' '}
            <span className="bg-gradient-to-r from-blue-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
              Verified Evidence.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed mb-10">
            Evidra is the intelligence platform for campus recruitment. We evaluate actual code,
            reviewed assessments, and audited project deliverables—giving universities and
            recruiters explainable, zero-hallucination match scores.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            {isAuthenticated && user ? (
              <Link to={getDashboardPath()} className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="w-full sm:w-auto px-8"
                >
                  Enter Your Workspace
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/register" className="w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="lg"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    className="w-full sm:w-auto px-7"
                  >
                    Register as Student
                  </Button>
                </Link>
                <Link to="/login" className="w-full sm:w-auto">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto px-7">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Trust Metrics Pill Grid */}
          <div className="mt-16 pt-10 border-t border-slate-800/80 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-4 rounded-xl bg-[#0b1329]/50 border border-slate-800/60">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">100%</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Deterministic Fit Score</div>
            </div>
            <div className="p-4 rounded-xl bg-[#0b1329]/50 border border-slate-800/60">
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-400">Zero</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Unchecked Self-Claims</div>
            </div>
            <div className="p-4 rounded-xl bg-[#0b1329]/50 border border-slate-800/60">
              <div className="text-2xl sm:text-3xl font-extrabold text-teal-400">6 Formats</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Verified Evidence Vault</div>
            </div>
            <div className="p-4 rounded-xl bg-[#0b1329]/50 border border-slate-800/60">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-200">ISO-Audit</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">Immutable Decision Logs</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Platform Pillars */}
      <section id="features" className="py-20 bg-[#070d18] border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="teal" size="sm" className="mb-3">
              Engine Architecture
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Why Evidra Outperforms Traditional Placement Portals
            </h2>
            <p className="text-slate-400 text-base mt-3">
              Traditional applicant tracking relies on resume keywords that can be hallucinated or
              faked. Evidra requires cryptographic or officer-audited proof before assigning skill
              weight.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card hoverEffect className="border-slate-800 bg-[#0b1329]/80">
              <CardHeader>
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                  <Database className="w-6 h-6" />
                </div>
                <CardTitle>Canonical Skill Dictionary</CardTitle>
                <CardDescription>
                  Normalizes hundreds of aliased technologies (e.g. React.js, ReactJS, React) to
                  stable canonical nodes while strictly keeping Java and JavaScript distinct.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Case-insensitive alias resolution</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Category taxonomies (Frontend, Backend, Cloud)</span>
                </div>
              </CardContent>
            </Card>

            <Card hoverEffect className="border-slate-800 bg-[#0b1329]/80">
              <CardHeader>
                <div className="w-12 h-12 rounded-2xl bg-teal-600/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-4">
                  <Cpu className="w-6 h-6" />
                </div>
                <CardTitle>Deterministic Match Formula</CardTitle>
                <CardDescription>
                  Transparent mathematical fit scoring based on reviewed evidence weights. Zero
                  black box scoring, full mathematical formula disclosure per candidate.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Configurable weights (Required: 3x, Preferred: 1x)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Distinct eligibility criteria separation (CGPA/Year)</span>
                </div>
              </CardContent>
            </Card>

            <Card hoverEffect className="border-slate-800 bg-[#0b1329]/80">
              <CardHeader>
                <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <CardTitle>Role-Governed Integrity</CardTitle>
                <CardDescription>
                  Students submit proof; only authorized placement officers approve verification
                  status. Evaluator IDs and timestamps are permanently logged.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Tamper-proof audit logs for every decision</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Zero privilege escalation via HTTP-only JWT</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Evidence Engine Deep Dive */}
      <section id="evidence" className="py-20 bg-[#0b1329]/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="electric" size="sm" className="mb-3">
                Evidence Vault
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                Repositories Are Not Automatically Skills.
              </h2>
              <p className="text-slate-400 text-base leading-relaxed mb-6">
                Anyone can fork a GitHub repository or copy an assessment answer. Evidra
                distinguishes mere artifact availability from reviewed, evaluated proficiency.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#0b1329] border border-slate-800/80 flex items-start gap-3.5">
                  <FileCheck2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Evaluated Assessments &amp; Quizzes
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Proctored coding rounds and official university assessments map directly to
                      confidence values.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0b1329] border border-slate-800/80 flex items-start gap-3.5">
                  <GitBranch className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">Project Deliverable Audits</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Faculty evaluation notes, commits, and verified live URLs authenticate project
                      ownership.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0b1329] border border-slate-800/80 flex items-start gap-3.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">Verified Certifications</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Credential verification links checked against issuing providers before
                      affecting ranking.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Engine Simulation Card */}
            <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs font-mono text-slate-400">matching_engine_v1.0.ts</span>
              </div>

              <div className="font-mono text-xs text-slate-300 space-y-3">
                <div className="text-slate-500">// Deterministic Formula Output</div>
                <div className="p-3 rounded-xl bg-[#070d18] border border-slate-800/80 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Candidate:</span>
                    <span className="text-blue-400 font-semibold">CS2024001 (B.Tech CSE)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Eligibility Status:</span>
                    <span className="text-emerald-400 font-semibold">
                      MET (CGPA 8.85 &gt;= 7.50)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Required Skills Weight:</span>
                    <span className="text-slate-200">TypeScript (3x), React (3x)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Calculated Fit Score:</span>
                    <span className="text-teal-400 font-bold text-sm">94.2 / 100</span>
                  </div>
                </div>

                <div className="text-slate-400 text-[11px] leading-relaxed">
                  &gt; Explainable Reason: Candidate demonstrated 100% evaluated proficiency on
                  TypeScript via proctored assessment (#EV-8821) and verified project repo.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Workflow */}
      <section id="how-it-works" className="py-20 border-t border-slate-800/80 bg-[#070d18]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="electric" size="sm" className="mb-3">
              Lifecycle
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              From Claim to Cryptographic Verification
            </h2>
            <p className="text-slate-400 text-base mt-3">
              A 4-step chain of custody ensuring no unverified assertion impacts a candidate's
              ranking.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-[#0b1329] border border-slate-800 relative">
              <span className="text-3xl font-extrabold text-blue-500/20 absolute top-4 right-4">
                01
              </span>
              <h3 className="text-base font-bold text-white mb-2">Student Submission</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Student inputs claims backed by GitHub links, proctored test IDs, or project URLs.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0b1329] border border-slate-800 relative">
              <span className="text-3xl font-extrabold text-teal-500/20 absolute top-4 right-4">
                02
              </span>
              <h3 className="text-base font-bold text-white mb-2">Officer Evaluation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Authorized placement officers review evidence, grade proficiency, and sign the audit
                trail.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0b1329] border border-slate-800 relative">
              <span className="text-3xl font-extrabold text-blue-500/20 absolute top-4 right-4">
                03
              </span>
              <h3 className="text-base font-bold text-white mb-2">Skill Normalization</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Incoming job postings and student claims map to immutable canonical skill dictionary
                nodes.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0b1329] border border-slate-800 relative">
              <span className="text-3xl font-extrabold text-teal-500/20 absolute top-4 right-4">
                04
              </span>
              <h3 className="text-base font-bold text-white mb-2">Explainable Ranking</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Deterministic matching returns 0–100 scores, skill gap reports, and auditable
                rationale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="py-20 border-t border-slate-800/80 bg-gradient-to-b from-[#0b1329] to-[#070d18]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Ready to upgrade your placement intelligence?
          </h2>
          <p className="text-slate-400 text-base max-w-2xl mx-auto mb-8">
            Join forward-looking universities and hiring partners who trust verified evidence over
            unsubstantiated claims.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Create Student Account
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg">
                Access Demo Accounts
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
