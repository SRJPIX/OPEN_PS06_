import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Upload,
  Sparkles,
  RotateCcw,
  Edit2,
  Link as LinkIcon,
  Trash2,
  Info,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import type { ResumeClaimItem, ResumeItem, EvidenceItem } from '../../types/student';

interface AnalysisResponse {
  resume: ResumeItem;
  claims: ResumeClaimItem[];
  stats: {
    totalClaims: number;
    supportedClaims: number;
    needsReviewClaims: number;
    unsupportedClaims: number;
    contradictedClaims: number;
    verificationRate: number;
  };
  originalFile?: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  };
}

const SAMPLE_RESUME_TEXT = `Fullstack Engineer with experience building responsive React applications and Node.js microservices.
Proficient in TypeScript, JavaScript, MongoDB, Docker, and Python.
Engineered an event-driven message broker with Redis caching and deployed on AWS.
Graduated with B.Tech Computer Science with 9.8 CGPA.`;

export const UploadedResumeAnalysisPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [resumeTitle, setResumeTitle] = useState('External Resume Audit');
  const [resumeText, setResumeText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);

  // Claim edit modal state
  const [editingClaim, setEditingClaim] = useState<ResumeClaimItem | null>(null);
  const [claimEditText, setClaimEditText] = useState('');

  // Link evidence modal state
  const [linkingClaim, setLinkingClaim] = useState<ResumeClaimItem | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');

  // Fetch student vault evidence for linking
  const { data: myEvidence = [] } = useQuery<EvidenceItem[]>({
    queryKey: ['my-evidence-for-linking'],
    queryFn: () => api.get<EvidenceItem[]>('/evidence'),
    enabled: !!linkingClaim,
  });

  // Upload and analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (inputMode === 'upload' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (resumeTitle) formData.append('title', resumeTitle);

        return api.upload<AnalysisResponse>('/resumes/upload-and-analyze', formData);
      } else {
        return api.post<AnalysisResponse>('/resumes/upload-and-analyze', {
          text: resumeText.trim(),
          title: resumeTitle.trim() || 'Uploaded Resume Audit',
        });
      }
    },
    onSuccess: (data) => {
      success('Analysis Completed', 'Resume parsed and audited against your verified evidence vault.');
      setAnalysisResult(data);
    },
    onError: (err: any) => {
      toastError('Analysis Failed', err.message || 'Could not parse resume text.');
    },
  });

  // Edit claim mutation
  const editClaimMutation = useMutation({
    mutationFn: ({ id, correctedText }: { id: string; correctedText: string }) =>
      api.patch<ResumeClaimItem>(`/resumes/claims/${id}`, { correctedText }),
    onSuccess: (updatedClaim) => {
      success('Claim Corrected', 'Updated claim stored.');
      if (analysisResult) {
        setAnalysisResult({
          ...analysisResult,
          claims: analysisResult.claims.map((c) =>
            c._id === updatedClaim._id ? updatedClaim : c
          ),
        });
      }
      setEditingClaim(null);
    },
    onError: (err: any) => {
      toastError('Update Failed', err.message || 'Could not update claim.');
    },
  });

  // Link evidence mutation
  const linkEvidenceMutation = useMutation({
    mutationFn: ({ claimId, evidenceId }: { claimId: string; evidenceId: string }) =>
      api.post<ResumeClaimItem>(`/resumes/claims/${claimId}/link-evidence`, { evidenceId }),
    onSuccess: (updatedClaim) => {
      success('Evidence Linked', 'Claim status updated with supporting proof.');
      if (analysisResult) {
        setAnalysisResult({
          ...analysisResult,
          claims: analysisResult.claims.map((c) =>
            c._id === updatedClaim._id ? updatedClaim : c
          ),
        });
      }
      setLinkingClaim(null);
    },
    onError: (err: any) => {
      toastError('Link Failed', err.message || 'Could not link evidence.');
    },
  });

  // Delete claim mutation
  const deleteClaimMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/resumes/claims/${id}`),
    onSuccess: (_, id) => {
      success('Claim Removed', 'Claim eliminated from audit records.');
      if (analysisResult) {
        setAnalysisResult({
          ...analysisResult,
          claims: analysisResult.claims.filter((c) => c._id !== id),
        });
      }
    },
    onError: (err: any) => {
      toastError('Removal Failed', err.message || 'Could not remove claim.');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toastError('Invalid Format', 'Only PDF files are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toastError('File Too Large', 'Maximum file size is 5MB.');
      return;
    }

    setSelectedFile(file);
    setResumeTitle(file.name.replace(/\.pdf$/i, ''));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toastError('Invalid Format', 'Only PDF files are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toastError('File Too Large', 'Maximum file size is 5MB.');
      return;
    }

    setSelectedFile(file);
    setResumeTitle(file.name.replace(/\.pdf$/i, ''));
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setResumeText('');
    setSelectedFile(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Uploaded Resume Audit &amp; Claim Cross-Check
            </h1>
            <Badge variant="electric" size="sm" dot>
              Anti-Hallucination Engine
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Upload your existing PDF resume to cross-reference every claim against your audited
            university vault. Unsubstantiated claims are flagged; missing evidence does not imply
            falsity.
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
                <CardTitle>Resume Ingestion</CardTitle>
                <CardDescription>
                  Upload your native PDF (max 5MB) or paste plain text. Original documents are
                  stored immutably without modification.
                </CardDescription>
              </div>

              {/* Mode switch */}
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#070d18] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    inputMode === 'upload'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PDF Upload
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                    inputMode === 'paste'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Paste Text
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <Input
              label="Document Title"
              placeholder="e.g. My External Tech Resume"
              value={resumeTitle}
              onChange={(e) => setResumeTitle(e.target.value)}
            />

            {inputMode === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition ${
                  isDragging
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 bg-[#070d18]/50 hover:border-slate-600'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,application/pdf"
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-3.5 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {selectedFile ? selectedFile.name : 'Choose a PDF resume or drag & drop here'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedFile
                        ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for audit`
                        : 'PDF up to 5MB with selectable text • In-memory security parsing'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {selectedFile ? 'Change File' : 'Browse Files'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Resume Text Content <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResumeText(SAMPLE_RESUME_TEXT);
                      setResumeTitle('Sample Technical Resume');
                    }}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Load Sample
                  </button>
                </div>
                <textarea
                  rows={8}
                  placeholder="Paste the plain text or markdown of your resume here..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-4 text-sm text-slate-100 placeholder:text-slate-500 font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              icon={<Sparkles className="w-4 h-4" />}
              isLoading={analyzeMutation.isPending}
              disabled={inputMode === 'upload' ? !selectedFile : !resumeText.trim()}
              onClick={() => analyzeMutation.mutate()}
            >
              Analyze &amp; Cross-Reference Claims
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Analysis Results Dashboard */
        <div className="space-y-8 animate-in fade-in">
          {/* Informational Policy Banner */}
          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-300/90 leading-relaxed">
              <span className="font-semibold text-blue-200">Anti-Prejudice Rule: </span>
              Missing evidence is classified as <span className="font-semibold">UNSUPPORTED</span>,
              never assumed false. Contradictions occur only when claims directly dispute verified
              institutional records (e.g. CGPA, degree program).
            </div>
          </div>

          {/* Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Claims
                </span>
                <div className="text-2xl font-extrabold text-white mt-1">
                  {analysisResult.stats.totalClaims}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Extracted</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Supported
                </span>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                  {analysisResult.stats.supportedClaims}
                </div>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">Vault-verified</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Needs Review
                </span>
                <div className="text-2xl font-extrabold text-amber-400 mt-1">
                  {analysisResult.stats.needsReviewClaims || 0}
                </div>
                <p className="text-[11px] text-amber-400/80 mt-0.5">Partial / pending</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Unsupported
                </span>
                <div className="text-2xl font-extrabold text-slate-300 mt-1">
                  {analysisResult.stats.unsupportedClaims}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">No evidence yet</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0b1329]">
              <CardContent className="p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                  Contradicted
                </span>
                <div className="text-2xl font-extrabold text-rose-400 mt-1">
                  {analysisResult.stats.contradictedClaims || 0}
                </div>
                <p className="text-[11px] text-rose-400/80 mt-0.5">Record conflict</p>
              </CardContent>
            </Card>
          </div>

          {/* Claims Ledger Table */}
          <Card className="border-slate-800 bg-[#0b1329]">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle>Claim-by-Claim Verification Ledger</CardTitle>
                  <CardDescription>
                    Review extracted statements. You can correct wording, link evidence from your
                    vault, or remove inaccurate claims.
                  </CardDescription>
                </div>
                <Badge variant="electric" size="sm">
                  {analysisResult.stats.verificationRate}% Verifiable
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim Statement</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisResult.claims.map((claim) => (
                    <TableRow key={claim._id}>
                      <TableCell className="max-w-[320px]">
                        <p className="font-semibold text-white text-sm">{claim.text}</p>
                        {claim.correctedText && claim.correctedText !== claim.text && (
                          <p className="text-xs text-blue-400 mt-0.5 italic">
                            Corrected: {claim.correctedText}
                          </p>
                        )}
                        {claim.explanation && (
                          <p className="text-[11px] text-slate-400 mt-1">{claim.explanation}</p>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="neutral" size="sm" className="uppercase text-[10px]">
                          {claim.claimType}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {claim.validationStatus === 'SUPPORTED' ? (
                          <Badge variant="success" size="sm" dot>
                            SUPPORTED
                          </Badge>
                        ) : claim.validationStatus === 'NEEDS_REVIEW' ? (
                          <Badge variant="warning" size="sm" dot>
                            NEEDS REVIEW
                          </Badge>
                        ) : claim.validationStatus === 'CONTRADICTED' ? (
                          <Badge variant="danger" size="sm" dot>
                            CONTRADICTED
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm" dot>
                            UNSUPPORTED
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="font-mono text-xs font-semibold">
                        <span
                          className={
                            claim.validationStatus === 'SUPPORTED'
                              ? 'text-emerald-400'
                              : claim.validationStatus === 'CONTRADICTED'
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }
                        >
                          {claim.confidenceScore}%
                        </span>
                      </TableCell>

                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setEditingClaim(claim);
                            setClaimEditText(claim.correctedText || claim.text);
                          }}
                          title="Correct Claim Text"
                        />

                        {claim.validationStatus !== 'SUPPORTED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-400 hover:text-amber-300"
                            icon={<LinkIcon className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setLinkingClaim(claim);
                              setSelectedEvidenceId('');
                            }}
                            title="Link Vault Evidence"
                          />
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-500 hover:text-rose-400"
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => {
                            if (confirm('Remove this claim from the audit record?')) {
                              deleteClaimMutation.mutate(claim._id);
                            }
                          }}
                          title="Remove Claim"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Claim Dialog */}
      <Dialog
        isOpen={!!editingClaim}
        onClose={() => setEditingClaim(null)}
        title="Correct Extracted Claim"
        description="Provide a clarified or corrected statement for this claim."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditingClaim(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={editClaimMutation.isPending}
              onClick={() => {
                if (editingClaim && claimEditText.trim()) {
                  editClaimMutation.mutate({
                    id: editingClaim._id,
                    correctedText: claimEditText.trim(),
                  });
                }
              }}
            >
              Save Correction
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Original Claim: </span>
            {editingClaim?.extractedText || editingClaim?.text}
          </div>
          <Input
            label="Corrected Statement"
            placeholder="e.g. Developed scalable backend APIs using TypeScript and Express"
            value={claimEditText}
            onChange={(e) => setClaimEditText(e.target.value)}
            required
          />
        </div>
      </Dialog>

      {/* Link Evidence Dialog */}
      <Dialog
        isOpen={!!linkingClaim}
        onClose={() => setLinkingClaim(null)}
        title="Link Evidence Artifact"
        description="Select an approved or pending verification artifact from your evidence vault to substantiate this claim."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setLinkingClaim(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={linkEvidenceMutation.isPending}
              disabled={!selectedEvidenceId}
              onClick={() => {
                if (linkingClaim && selectedEvidenceId) {
                  linkEvidenceMutation.mutate({
                    claimId: linkingClaim._id,
                    evidenceId: selectedEvidenceId,
                  });
                }
              }}
            >
              Link Evidence
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="text-xs text-slate-300 bg-[#070d18] p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400">Target Claim: </span>
            {linkingClaim?.text}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Select Proof from Evidence Vault
            </label>
            {myEvidence.length === 0 ? (
              <div className="text-xs text-slate-400 p-3 bg-slate-900 rounded-xl">
                No evidence items found in your vault.{' '}
                <Link to="/student/evidence" className="text-blue-400 underline">
                  Upload an artifact first
                </Link>
                .
              </div>
            ) : (
              <select
                value={selectedEvidenceId}
                onChange={(e) => setSelectedEvidenceId(e.target.value)}
                className="w-full rounded-xl bg-[#070d18] border border-slate-800 p-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              >
                <option value="">-- Choose an evidence artifact --</option>
                {myEvidence.map((ev) => (
                  <option key={ev._id} value={ev._id}>
                    {ev.title} ({ev.type} &bull; {ev.status})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};
