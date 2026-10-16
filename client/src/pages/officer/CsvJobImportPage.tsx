import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  Copy,
  Download,
  ArrowLeft,
  ArrowRight,
  Layers,
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

const SAMPLE_CSV = `title,company,requisitionId,location,workplaceType,jobType,minCgpa,eligibleDepartments,eligibleGraduationYears,requiredSkills,preferredSkills,sourceUrl
Fullstack Software Engineer,Google India,REQ-GOOG-2026-01,Bengaluru,hybrid,full_time,8.0,"Computer Science & Engineering, Information Technology",2026,"React, Node.js, TypeScript","Docker, Kubernetes, AWS",https://careers.google.com/jobs/01
Frontend Developer Intern,Microsoft,REQ-MSFT-2026-02,Hyderabad,remote,internship,7.5,"Computer Science & Engineering",2026,"React, JavaScript, CSS3","TypeScript, Redux",https://careers.microsoft.com/jobs/02
Backend Systems Engineer,Evidra Partner Labs,REQ-EVD-2026-03,Bengaluru,on_site,full_time,7.0,"Computer Science & Engineering, Electronics",2025,"Java, Python, MongoDB","Docker, Redis",https://evidra.dev/careers/03`;

export const CsvJobImportPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [csvContent, setCsvContent] = useState<string>(SAMPLE_CSV);
  const [importResults, setImportResults] = useState<{
    totalRows: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; error: string; rawRow?: string }>;
  } | null>(null);

  const importMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post<{ summary: any }>('/jobs/import/csv', {
        csvContent: content,
      });
      return res.summary;
    },
    onSuccess: (summary) => {
      setImportResults(summary);
      success(
        'CSV Import Processed',
        `Successfully processed ${summary.totalRows} rows: ${summary.inserted} inserted, ${summary.updated} updated.`
      );
      queryClient.invalidateQueries({ queryKey: ['officer-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['officer-dashboard-stats'] });
    },
    onError: (err: any) => {
      toastError('Import Failed', err?.message || 'Could not parse or ingest CSV file.');
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvContent(text);
      }
    };
    reader.readAsText(file);
  };

  const handleCopySample = () => {
    navigator.clipboard.writeText(SAMPLE_CSV);
    success('Copied to Clipboard', 'Sample CSV structure copied.');
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'evidra-job-import-sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
              CSV Bulk Job Ingestion
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Upload spreadsheets or ATS exports to batch ingest job requisitions with row-level canonical skill mapping and duplicate prevention.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              icon={<Copy className="w-3.5 h-3.5" />}
              onClick={handleCopySample}
            >
              Copy Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleDownloadSample}
            >
              Download Sample
            </Button>
          </div>
        </div>
      </div>

      {/* CSV Input Panel */}
      <Card className="border-slate-800 bg-[#0b1329]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Input CSV Content</span>
            </CardTitle>
            <label className="cursor-pointer">
              <span className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload .CSV File</span>
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <CardDescription className="text-xs text-slate-400">
            Paste RFC 4180 conforming CSV records or upload a file. The first row must be the column header.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            rows={10}
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-y leading-relaxed"
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            placeholder="title,company,requisitionId,location,workplaceType,jobType,minCgpa,eligibleDepartments,eligibleGraduationYears,requiredSkills,preferredSkills,sourceUrl..."
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              {csvContent.trim() ? `${csvContent.trim().split('\n').length - 1} records ready` : '0 records'}
            </span>
            <Button
              variant="primary"
              size="md"
              icon={<UploadCloud className="w-4 h-4" />}
              isLoading={importMutation.isPending}
              disabled={!csvContent.trim()}
              onClick={() => importMutation.mutate(csvContent)}
            >
              Execute Ingestion
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ingestion Results Diagnostic Section */}
      {importResults && (
        <Card className="border-slate-800 bg-[#0b1329] animate-in fade-in duration-300">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Ingestion Diagnostics & Summary</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => navigate('/officer/jobs')}
              >
                Go to Requisitions
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Metric Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800 text-center">
                <div className="text-2xl font-bold text-white">{importResults.totalRows}</div>
                <div className="text-xs text-slate-400 mt-1">Total Rows</div>
              </div>

              <div className="p-4 rounded-xl bg-[#070d18] border border-emerald-500/30 text-center">
                <div className="text-2xl font-bold text-emerald-400">{importResults.inserted}</div>
                <div className="text-xs text-emerald-400 mt-1">Inserted</div>
              </div>

              <div className="p-4 rounded-xl bg-[#070d18] border border-blue-500/30 text-center">
                <div className="text-2xl font-bold text-blue-400">{importResults.updated}</div>
                <div className="text-xs text-blue-400 mt-1">Updated</div>
              </div>

              <div className="p-4 rounded-xl bg-[#070d18] border border-amber-500/30 text-center">
                <div className="text-2xl font-bold text-amber-400">{importResults.skipped}</div>
                <div className="text-xs text-amber-400 mt-1">Skipped / Errors</div>
              </div>
            </div>

            {/* Row-Level Errors & Rejections Table */}
            {importResults.errors && importResults.errors.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Row-Level Diagnostics & Rejections ({importResults.errors.length})</span>
                </div>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#070d18]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-2.5 w-20">Row</th>
                        <th className="px-4 py-2.5">Diagnostic / Validation Error</th>
                        <th className="px-4 py-2.5">Raw Data Excerpt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {importResults.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 text-amber-400 font-bold">#{err.row}</td>
                          <td className="px-4 py-2.5 text-rose-300 font-sans">{err.error}</td>
                          <td className="px-4 py-2.5 text-slate-500 truncate max-w-xs">
                            {err.rawRow || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
