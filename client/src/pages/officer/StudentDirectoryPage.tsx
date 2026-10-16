import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { StudentDirectoryItem } from '../../types/officer';

export const StudentDirectoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [graduationYear, setGraduationYear] = useState<string>('');
  const [minCgpa, setMinCgpa] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('cgpa');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
    sortOrder,
  });
  if (search.trim()) queryParams.set('search', search.trim());
  if (department) queryParams.set('department', department);
  if (graduationYear) queryParams.set('graduationYear', graduationYear);
  if (minCgpa) queryParams.set('minCgpa', minCgpa);

  const { data, isLoading, isError, error, refetch } = useQuery<{
    data: StudentDirectoryItem[];
    meta?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: [
      'officer-students',
      page,
      limit,
      search,
      department,
      graduationYear,
      minCgpa,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const res = await api.getWithMeta<StudentDirectoryItem[]>(`/students?${queryParams.toString()}`);
      return {
        data: res.data || [],
        meta: res.meta as { page: number; limit: number; total: number; totalPages: number },
      };
    },
  });

  const students = data?.data || [];
  const meta = data?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };

  const resetFilters = () => {
    setSearch('');
    setDepartment('');
    setGraduationYear('');
    setMinCgpa('');
    setSortBy('cgpa');
    setSortOrder('desc');
    setPage(1);
  };

  const hasActiveFilters = search || department || graduationYear || minCgpa || sortBy !== 'cgpa';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Student Directory
            </h1>
            <Badge variant="electric" size="sm">
              {meta.total} Registered
            </Badge>
          </div>
          <p className="text-sm text-slate-400">
            Browse candidate profiles, inspect verified skill competencies, and review student evidence trails.
          </p>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={resetFilters}
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-800 bg-[#0b1329] p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-3.5">
          <Input
            placeholder="Search roll number, email..."
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Departments</option>
            <option value="Computer Science">Computer Science & Eng.</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Electronics">Electronics & Communication</option>
            <option value="Electrical">Electrical Engineering</option>
            <option value="Mechanical">Mechanical Engineering</option>
          </select>

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={graduationYear}
            onChange={(e) => {
              setGraduationYear(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Graduating Batches</option>
            <option value="2024">Batch 2024</option>
            <option value="2025">Batch 2025</option>
            <option value="2026">Batch 2026</option>
            <option value="2027">Batch 2027</option>
          </select>

          <select
            className="w-full bg-[#070d18] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={minCgpa}
            onChange={(e) => {
              setMinCgpa(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any CGPA</option>
            <option value="8.5">CGPA ≥ 8.5</option>
            <option value="8.0">CGPA ≥ 8.0</option>
            <option value="7.5">CGPA ≥ 7.5</option>
            <option value="7.0">CGPA ≥ 7.0</option>
            <option value="6.0">CGPA ≥ 6.0</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Sort by:</span>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                sortBy === 'cgpa' ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30' : 'hover:text-slate-200'
              }`}
              onClick={() => {
                setSortBy('cgpa');
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              }}
            >
              CGPA ({sortBy === 'cgpa' ? sortOrder.toUpperCase() : 'DESC'})
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                sortBy === 'graduationYear' ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30' : 'hover:text-slate-200'
              }`}
              onClick={() => {
                setSortBy('graduationYear');
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              }}
            >
              Graduation Year
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                sortBy === 'rollNumber' ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30' : 'hover:text-slate-200'
              }`}
              onClick={() => {
                setSortBy('rollNumber');
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              }}
            >
              Roll Number
            </button>
          </div>

          <div>
            Showing <span className="text-white font-semibold">{students.length}</span> of{' '}
            <span className="text-white font-semibold">{meta.total}</span> candidates
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <ErrorState
          title="Could not retrieve student directory"
          message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !isError && students.length === 0 && (
        <EmptyState
          icon={<Users className="w-8 h-8 text-slate-500" />}
          title="No students match the criteria"
          description="Try broadening your department, CGPA, or batch filters to discover students."
          action={{
            label: 'Clear All Filters',
            onClick: resetFilters,
          }}
        />
      )}

      {/* Student List */}
      {!isLoading && !isError && students.length > 0 && (
        <div className="space-y-3">
          {students.map((student) => {
            return (
              <Card
                key={student._id}
                className="border-slate-800 bg-[#0b1329] hover:border-slate-700 transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-base shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-base font-bold text-white tracking-tight">
                        {student.rollNumber}
                      </span>
                      <span className="text-xs text-slate-400">&bull; {student.user?.email}</span>
                      <Badge variant="teal" size="sm">
                        Class of {student.graduationYear}
                      </Badge>
                      <Badge variant="electric" size="sm">
                        CGPA: {student.cgpa?.toFixed(2) || 'N/A'}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-300 mt-1">
                      {student.degree} &bull; {student.department}
                    </p>

                    {/* Skill Pills preview */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {student.verifiedSkillsCount} verified
                      </span>
                      <span className="text-slate-600 text-[10px]">&bull;</span>
                      <span className="text-[11px] text-slate-400">
                        {student.totalSkillsCount} total skills
                      </span>
                      {student.skills?.slice(0, 4).map((sk) => (
                        <span
                          key={sk._id}
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            sk.isVerified
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-medium'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {sk.skill?.name || 'Skill'}
                        </span>
                      ))}
                      {student.skills?.length > 4 && (
                        <span className="text-[10px] text-slate-500">
                          +{student.skills.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                    onClick={() => navigate(`/officer/students/${student._id}`)}
                  >
                    View Dossier
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && !isError && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">
            Page {meta.page} of {meta.totalPages} ({meta.total} total students)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
