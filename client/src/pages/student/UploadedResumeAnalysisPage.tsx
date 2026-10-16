import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle2,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import type { ResumeClaimItem, ResumeItem } from '../../types/student';

interface AnalysisResponse {
  resume: ResumeItem;
  claims: ResumeClaimItem[];
  stats: {
    totalClaims: number;
    verifiedClaims: number;
    unverifiedClaims: number;
    verificationRate: number;
  };
}

const SAMPLE_RESUME_TEXT = `Fullstack Engineer with experience building responsive React applications and Node.js microservices.
Proficient in TypeScript, JavaScript, MongoDB, Docker, and Python.
Engineered an event-driven message broker with Redis caching and deployed on AWS.
Demonstrated strong background in Java and SQL databases.`;

export const UploadedResumeAnalysisPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [resumeTitle, setResumeTitle] = useState('External Resume Audit');
  const [resumeText, setResumeText] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: (payload: { text: string; title: string }) =>
      api.post<AnalysisResponse>('/resumes/analyze-upload', payload),
    onSuccess: (data) => {
      success('Analysis Completed', 'Resume parsed and audited against your verified evidence vault.');
      setAnalysisResult(data);
    },
    onError: (err: any) => {
      toastError('Analysis Failed', err.message || 'Could not parse resume text.');
    },
  });

  const handleAnalyze = () => {
    if (!resumeText.trim()) return;
    analyzeMutation.mutate({
      text: resumeText.trim(),
      title: resumeTitle.trim() || 'Uploaded Resume Audit',
    });
  };

  const handleUseSample = () => {
    setResumeText(SAMPLE_RESUME_TEXT);
    setResumeTitle('Sample Technical Resume');
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setResumeText('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Uploaded Resume Audit &amp; Verification
            </h1>
            <Badge variant="electric" size="sm" dot>
              Anti-Hallucination Engine
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Paste or upload your existing resume text to cross-reference every claim against your
            audited evidence records.
          </p>
        </div>

        {analysisResult && (
          <Button
            variant="outline"
            size="sm"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={handleReset}
          >
            Audit Another Resume
          </Button>
        )}
      </div>

      {!analysisResult ? (
        /* Input & Upload Panel */
        <Card className="border-slate-800 bg-[#0b1329]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Resume Content Input</CardTitle>
                <CardDescription>
                  Paste your resume text below. The engine will extract technology claims and check
                  for verified faculty sign-offs.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleUseSample} className="text-xs">
                Fill Sample Resume
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <Input
              label="Audit Document Title"
              placeholder="e.g. My Current Resume v2"
              value={resumeTitle}
              onChange={(e) => setResumeTitle(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Resume Text Content <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={10}
                placeholder="Paste the plain text or markdown of your resume here..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-4 text-sm text-slate-100 placeholder:text-slate-500 font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-500">
                Supports plain text, markdown, or copied PDF text. Minimum 20 characters.
              </span>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              icon={<Sparkles className="w-4 h-4" />}
              isLoading={analyzeMutation.isPending}
              disabled={!resumeText.trim()}
              onClick={handleAnalyze}
            >
              Analyze &amp; Audit Claims
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Analysis Results Dashboard */
        <div className="space-y-8 animate-in fade-in">
          {/* Metrics Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Extracted Claims
                </span>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {analysisResult.stats.totalClaims}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Matched to Canonical Dictionary</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Verified Claims
                </span>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                  {analysisResult.stats.verifiedClaims}
                </div>
                <p className="text-[11px] text-emerald-400/80 mt-1">Audited proof in vault</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                  Flagged / Unsubstantiated
                </span>
                <div className="text-3xl font-extrabold text-rose-400 mt-1">
                  {analysisResult.stats.unverifiedClaims}
                </div>
                <p className="text-[11px] text-rose-400/80 mt-1">Zero evidence found</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Verification Rate
                </span>
                <div className="text-3xl font-extrabold text-blue-400 mt-1 font-mono">
                  {analysisResult.stats.verificationRate}%
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Credibility index</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Claims Audit Table */}
          <Card className="border-slate-800 bg-[#0b1329]">
            <CardHeader>
              <CardTitle>Claim-by-Claim Verification Ledger</CardTitle>
              <CardDescription>
                Detailed breakdown of what is substantiated by evidence versus what will be flagged
                during campus recruiter evaluations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Extracted Claim</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Verification Status</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisResult.claims.map((claim) => (
                    <TableRow key={claim._id}>
                      <TableCell className="font-semibold text-white">
                        {claim.text}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" size="sm">
                          {claim.claimType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {claim.isVerified ? (
                          <Badge variant="success" size="sm" dot>
                            Verified Proof Attached
                          </Badge>
                        ) : (
                          <Badge variant="danger" size="sm" dot>
                            Flagged: Unsubstantiated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {claim.isVerified ? (
                          <span className="text-emerald-400">{claim.confidenceScore}%</span>
                        ) : (
                          <span className="text-rose-400">{claim.confidenceScore}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {claim.isVerified ? (
                          <Link to="/student/skills">
                            <Button variant="ghost" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}>
                              View in Vault
                            </Button>
                          </Link>
                        ) : (
                          <Link to="/student/skills">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-amber-400 border-amber-500/30 hover:bg-amber-950/20"
                            >
                              + Attach Proof
                            </Button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
