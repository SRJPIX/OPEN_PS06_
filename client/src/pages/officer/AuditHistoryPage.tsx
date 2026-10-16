import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  User,
  Globe,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  FileText,
  Clock,
  Laptop,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { AuditLogItem } from '../../types/officer';

export const AuditHistoryPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Selected Log Modal for JSON deep inspection
  const [inspectLog, setInspectLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (search.trim()) params.set('search', search.trim());
      if (selectedAction) params.set('action', selectedAction);
      if (selectedEntityType) params.set('entityType', selectedEntityType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await api.getWithMeta<AuditLogItem[]>(
        `/officer/audit-logs?${params.toString()}`
      );

      setLogs(response.data || []);
      if (response.meta) {
        setTotal(Number(response.meta.total) || 0);
        setTotalPages(Number(response.meta.totalPages) || 1);
      }
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
      setError(err?.message || 'Failed to load audit history.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedAction, selectedEntityType, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedAction('');
    setSelectedEntityType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadge = (action: string) => {
    if (action.includes('CREATE') || action.includes('APPROVED') || action.includes('OFFERED')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('UPDATE') || action.includes('MERGE') || action.includes('VERIFIED')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (action.includes('REJECT') || action.includes('ARCHIVE') || action.includes('DELETE')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit History &amp; Compliance</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Authoritative Trail
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Chronological, immutable audit records capturing institutional status transitions, approvals, settings updates, and job management events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Text Search */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search actions, entities, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Action Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">All Actions</option>
              <option value="JOB_CREATED">JOB_CREATED</option>
              <option value="JOB_UPDATED">JOB_UPDATED</option>
              <option value="JOB_ARCHIVED">JOB_ARCHIVED</option>
              <option value="JOB_DUPLICATE_MERGED">JOB_DUPLICATE_MERGED</option>
              <option value="APPLICATION_STATUS_UPDATED">APPLICATION_STATUS_UPDATED</option>
              <option value="RESUME_CLAIM_VERIFIED">RESUME_CLAIM_VERIFIED</option>
              <option value="EVIDENCE_REVIEWED">EVIDENCE_REVIEWED</option>
              <option value="PLACEMENT_SETTINGS_UPDATED">PLACEMENT_SETTINGS_UPDATED</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedEntityType}
              onChange={(e) => {
                setSelectedEntityType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">All Entities</option>
              <option value="Job">Job</option>
              <option value="Application">Application</option>
              <option value="ResumeClaim">Resume Claim</option>
              <option value="Evidence">Evidence</option>
              <option value="PlacementSetting">Placement Setting</option>
              <option value="StudentProfile">Student Profile</option>
              <option value="User">User</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="md:col-span-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          {/* End Date */}
          <div className="md:col-span-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>
        </form>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Showing filtered audit records across system operations</span>
          </div>
          {(search || selectedAction || selectedEntityType || startDate || endDate) && (
            <button
              onClick={handleClearFilters}
              className="text-primary-600 hover:text-primary-800 font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Origin &amp; Host</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="py-4 px-4"><div className="h-5 bg-slate-200 rounded-full w-36"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 bg-slate-200 rounded w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-base font-medium text-slate-600">No audit records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting your search criteria or date filters.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/60 transition">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(log.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] text-slate-400 pl-5">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Actor */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                          <User className="w-3 h-3" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-800">
                            {log.user?.email || 'System Operation'}
                          </div>
                          {log.user?.role && (
                            <div className="text-[10px] text-slate-400 capitalize">
                              {log.user.role.replace('_', ' ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Entity */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-800">{log.entityType}</div>
                      {log.entityId && (
                        <div className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]" title={log.entityId}>
                          ID: {log.entityId.slice(-8)}
                        </div>
                      )}
                    </td>

                    {/* Origin & Host */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-slate-400" />
                        <span className="font-mono text-[11px]">{log.ipAddress || '127.0.0.1'}</span>
                      </div>
                      {log.userAgent && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate max-w-[160px]" title={log.userAgent}>
                          <Laptop className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{log.userAgent}</span>
                        </div>
                      )}
                    </td>

                    {/* Inspection Button */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setInspectLog(log)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-700">{logs.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
              <strong className="text-slate-700">{Math.min(page * limit, total)}</strong> of{' '}
              <strong className="text-slate-700">{total}</strong> records
            </span>
            <span className="text-slate-300">|</span>
            <label className="flex items-center gap-1">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-600 font-medium px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Audit Log Modal */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/75">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-700" />
                <h3 className="font-semibold text-slate-900 text-sm">Audit Record Detail</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${getActionBadge(
                    inspectLog.action
                  )}`}
                >
                  {inspectLog.action}
                </span>
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Audit Record ID</span>
                  <span className="font-mono text-slate-800 break-all">{inspectLog._id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Timestamp (UTC / Local)</span>
                  <span className="text-slate-800 font-medium">
                    {new Date(inspectLog.timestamp).toISOString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Actor</span>
                  <span className="text-slate-800">
                    {inspectLog.user?.email || 'System'} ({inspectLog.user?.role || 'N/A'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Entity Reference</span>
                  <span className="text-slate-800">
                    {inspectLog.entityType} ({inspectLog.entityId || 'Global'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Remote IP</span>
                  <span className="font-mono text-slate-800">{inspectLog.ipAddress || '127.0.0.1'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Client User Agent</span>
                  <span className="text-slate-700 truncate block" title={inspectLog.userAgent}>
                    {inspectLog.userAgent || 'Internal API Client'}
                  </span>
                </div>
              </div>

              {/* Payload Details */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-semibold uppercase text-slate-600 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Event Payload &amp; State Diffs
                  </h4>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-lg text-xs font-mono overflow-x-auto max-h-64 leading-relaxed">
                  {inspectLog.details && Object.keys(inspectLog.details).length > 0
                    ? JSON.stringify(inspectLog.details, null, 2)
                    : '// No additional payload metadata provided for this action.'}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setInspectLog(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 shadow-xs"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AuditHistoryPage;
