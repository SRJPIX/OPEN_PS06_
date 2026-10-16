import { Types } from 'mongoose';
import { Job, IJob, WORKPLACE_TYPES, JOB_TYPES, WorkplaceType, JobType } from '../models/Job';
import { Company, ICompany } from '../models/Company';
import { resolveSkillDocument } from './skillNormalizer';
import { checkExactDuplicate } from './jobDeduplicator';
import { parseJobDescriptionDeterministic } from './jobParser';
import { JOB_SOURCE_TYPES, JobSourceType } from '../models/JobSource';

export interface CsvRowError {
  row: number;
  title?: string;
  errors: string[];
}

export interface CsvImportSummary {
  totalRows: number;
  successful: number;
  rejected: number;
  errors: CsvRowError[];
  createdJobs: Array<{
    id: string;
    title: string;
    company: string;
    requisitionId?: string;
    status: string;
  }>;
}

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * RFC 4180-compliant CSV text parser.
 * Handles quoted cells with commas, newlines, and escaped quotes ("").
 */
export const parseCsvText = (csvContent: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped double quote inside quotes
        currentCell += '"';
        i++; // skip next quote
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n in CRLF
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  // Push final trailing cell/row if any
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
};

/**
 * Normalizes header keys to standard property names.
 */
const normalizeHeader = (header: string): string => {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Processes CSV job imports with row-level validation, deduplication, and skill resolution.
 */
export const importJobsFromCsv = async (params: {
  csvContent: string;
  userId: string;
  userRole: string;
  defaultStatus?: 'open' | 'draft';
}): Promise<CsvImportSummary> => {
  const { csvContent, userId, userRole, defaultStatus = 'open' } = params;

  const rawRows = parseCsvText(csvContent);
  if (rawRows.length < 2) {
    return {
      totalRows: 0,
      successful: 0,
      rejected: 0,
      errors: [{ row: 0, errors: ['CSV must contain a header row and at least one data row.'] }],
      createdJobs: [],
    };
  }

  const rawHeaders = rawRows[0];
  const headers = rawHeaders.map(normalizeHeader);

  const getColIndex = (...aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = headers.indexOf(normalizeHeader(alias));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const titleIdx = getColIndex('title', 'job_title', 'position', 'role');
  const companyIdx = getColIndex('company', 'company_name', 'organization');
  const descIdx = getColIndex('description', 'job_description', 'details');
  const locationIdx = getColIndex('location', 'city', 'work_location');
  const workplaceIdx = getColIndex('workplaceType', 'workplace_type', 'work_mode', 'workmode');
  const jobTypeIdx = getColIndex('jobType', 'job_type', 'type');
  const reqIdIdx = getColIndex('requisitionId', 'requisition_id', 'req_id', 'reqid');
  const sourceUrlIdx = getColIndex('sourceUrl', 'source_url', 'url', 'link');
  const sourceTypeIdx = getColIndex('sourceType', 'source_type', 'source');
  const reqSkillsIdx = getColIndex('requiredSkills', 'required_skills', 'skills');
  const prefSkillsIdx = getColIndex('preferredSkills', 'preferred_skills');
  const cgpaIdx = getColIndex('minCgpa', 'min_cgpa', 'cgpa');
  const deptsIdx = getColIndex(
    'eligibleDepartments',
    'eligible_departments',
    'departments',
    'branches'
  );
  const gradYearsIdx = getColIndex(
    'eligibleGraduationYears',
    'eligible_graduation_years',
    'graduation_years',
    'years'
  );
  const salaryMinIdx = getColIndex('salaryMin', 'salary_min', 'min_salary');
  const salaryMaxIdx = getColIndex('salaryMax', 'salary_max', 'max_salary');
  const salaryCurrIdx = getColIndex('salaryCurrency', 'salary_currency', 'currency');
  const deadlineIdx = getColIndex('deadline', 'apply_by', 'last_date');

  const summary: CsvImportSummary = {
    totalRows: rawRows.length - 1,
    successful: 0,
    rejected: 0,
    errors: [],
    createdJobs: [],
  };

  // Track requisition IDs and source URLs seen within this single CSV to prevent intra-batch duplicates
  const batchReqIds = new Set<string>();
  const batchSourceUrls = new Set<string>();

  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
    const row = rawRows[rowIndex];
    const rowNum = rowIndex + 1; // 1-indexed spreadsheet row
    const rowErrors: string[] = [];

    const getVal = (idx: number): string => (idx !== -1 && row[idx] ? row[idx].trim() : '');

    const title = getVal(titleIdx);
    const companyInput = getVal(companyIdx);
    const description = getVal(descIdx);
    const location = getVal(locationIdx) || 'Remote';
    const workplaceRaw = getVal(workplaceIdx).toLowerCase();
    const jobTypeRaw = getVal(jobTypeIdx).toLowerCase();
    const requisitionId = getVal(reqIdIdx);
    const sourceUrl = getVal(sourceUrlIdx);
    const sourceTypeRaw = getVal(sourceTypeIdx).toLowerCase();
    const reqSkillsRaw = getVal(reqSkillsIdx);
    const prefSkillsRaw = getVal(prefSkillsIdx);
    const cgpaRaw = getVal(cgpaIdx);
    const deptsRaw = getVal(deptsIdx);
    const gradYearsRaw = getVal(gradYearsIdx);
    const salaryMinRaw = getVal(salaryMinIdx);
    const salaryMaxRaw = getVal(salaryMaxIdx);
    const salaryCurrRaw = getVal(salaryCurrIdx) || 'INR';
    const deadlineRaw = getVal(deadlineIdx);

    // 1. Required field checks
    if (!title) {
      rowErrors.push('Missing required field: title');
    }
    if (!companyInput) {
      rowErrors.push('Missing required field: company');
    }
    if (!description) {
      rowErrors.push('Missing required field: description');
    }

    if (rowErrors.length > 0) {
      summary.rejected++;
      summary.errors.push({ row: rowNum, title, errors: rowErrors });
      continue;
    }

    // 2. Company Resolution & Access Verification
    let targetCompany: ICompany | null = null;
    if (/^[0-9a-fA-F]{24}$/.test(companyInput)) {
      targetCompany = await Company.findById(companyInput);
    } else {
      targetCompany = await Company.findOne({
        name: new RegExp(`^${escapeRegex(companyInput)}$`, 'i'),
      });
    }

    if (!targetCompany) {
      if (userRole === 'recruiter') {
        rowErrors.push(
          `Company '${companyInput}' does not exist or you are not authorized to post for it.`
        );
      } else {
        // Auto-create company for placement officers & admins
        targetCompany = await Company.create({
          name: companyInput,
          industry: 'Technology',
          isVerified: true,
          createdBy: new Types.ObjectId(userId),
        });
      }
    } else if (userRole === 'recruiter') {
      // Recruiter must be authorized for this company
      const isCreator = targetCompany.createdBy.toString() === userId;
      const isAuthRecruiter = targetCompany.authorizedRecruiters?.some(
        (id) => id.toString() === userId
      );
      if (!isCreator && !isAuthRecruiter) {
        rowErrors.push(
          `Unauthorized: You are not authorized to manage jobs for company '${targetCompany.name}'.`
        );
      }
    }

    if (!targetCompany || rowErrors.length > 0) {
      summary.rejected++;
      summary.errors.push({ row: rowNum, title, errors: rowErrors });
      continue;
    }

    // 3. Intra-batch duplicate checks
    if (requisitionId) {
      const key = `${targetCompany._id.toString()}:${requisitionId.toLowerCase()}`;
      if (batchReqIds.has(key)) {
        rowErrors.push(
          `Duplicate requisition ID '${requisitionId}' repeated within this CSV file.`
        );
      } else {
        batchReqIds.add(key);
      }
    }
    if (sourceUrl) {
      const cleanUrl = sourceUrl.toLowerCase();
      if (batchSourceUrls.has(cleanUrl)) {
        rowErrors.push(`Duplicate source URL '${sourceUrl}' repeated within this CSV file.`);
      } else {
        batchSourceUrls.add(cleanUrl);
      }
    }

    // 4. Exact duplicate check against database
    const exactDupCheck = await checkExactDuplicate({
      companyId: targetCompany._id,
      requisitionId,
      sourceUrl,
    });
    if (exactDupCheck.isDuplicate) {
      rowErrors.push(exactDupCheck.message || 'Exact duplicate detected with existing job.');
    }

    // 5. Enums & Validations
    let workplaceType: WorkplaceType = 'on_site';
    if (WORKPLACE_TYPES.includes(workplaceRaw as WorkplaceType)) {
      workplaceType = workplaceRaw as WorkplaceType;
    } else if (workplaceRaw.includes('remote') || workplaceRaw.includes('wfh')) {
      workplaceType = 'remote';
    } else if (workplaceRaw.includes('hybrid')) {
      workplaceType = 'hybrid';
    }

    let jobType: JobType = 'full_time';
    if (JOB_TYPES.includes(jobTypeRaw as JobType)) {
      jobType = jobTypeRaw as JobType;
    } else if (jobTypeRaw.includes('intern')) {
      jobType = 'internship';
    } else if (jobTypeRaw.includes('contract')) {
      jobType = 'contract';
    } else if (jobTypeRaw.includes('part')) {
      jobType = 'part_time';
    }

    let minCgpa = 0;
    if (cgpaRaw) {
      const num = parseFloat(cgpaRaw);
      if (!isNaN(num) && num >= 0 && num <= 10) {
        minCgpa = num;
      } else {
        rowErrors.push(`Invalid CGPA '${cgpaRaw}'. Must be a number between 0 and 10.`);
      }
    }

    let deadline: Date | undefined;
    if (deadlineRaw) {
      const d = new Date(deadlineRaw);
      if (!isNaN(d.getTime())) {
        deadline = d;
      } else {
        rowErrors.push(`Invalid deadline format '${deadlineRaw}'. Use YYYY-MM-DD.`);
      }
    }

    let sourceType: JobSourceType = 'manual_submission';
    if (JOB_SOURCE_TYPES.includes(sourceTypeRaw as JobSourceType)) {
      sourceType = sourceTypeRaw as JobSourceType;
    } else if (sourceTypeRaw.includes('partner')) {
      sourceType = 'partner_posting';
    } else if (sourceTypeRaw.includes('referral') || sourceTypeRaw.includes('alumni')) {
      sourceType = 'alumni_referral';
    } else if (sourceTypeRaw.includes('api')) {
      sourceType = 'api_source';
    }

    // If there were any validation errors, abort this row
    if (rowErrors.length > 0) {
      summary.rejected++;
      summary.errors.push({ row: rowNum, title, errors: rowErrors });
      continue;
    }

    // 6. Canonical Skill Resolution
    const reqSkillIds: Types.ObjectId[] = [];
    const prefSkillIds: Types.ObjectId[] = [];

    if (reqSkillsRaw) {
      const skillTokens = reqSkillsRaw
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const token of skillTokens) {
        const doc = await resolveSkillDocument(token);
        if (doc && !reqSkillIds.some((id) => id.equals(doc._id as Types.ObjectId))) {
          reqSkillIds.push(doc._id as Types.ObjectId);
        }
      }
    }

    if (prefSkillsRaw) {
      const skillTokens = prefSkillsRaw
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const token of skillTokens) {
        const doc = await resolveSkillDocument(token);
        if (
          doc &&
          !reqSkillIds.some((id) => id.equals(doc._id as Types.ObjectId)) &&
          !prefSkillIds.some((id) => id.equals(doc._id as Types.ObjectId))
        ) {
          prefSkillIds.push(doc._id as Types.ObjectId);
        }
      }
    }

    // Fallback: If no skills supplied, extract automatically using deterministic parser
    if (reqSkillIds.length === 0 && prefSkillIds.length === 0) {
      const parsed = parseJobDescriptionDeterministic(description);
      for (const skillName of parsed.requiredSkillNames) {
        const doc = await resolveSkillDocument(skillName);
        if (doc && !reqSkillIds.some((id) => id.equals(doc._id as Types.ObjectId))) {
          reqSkillIds.push(doc._id as Types.ObjectId);
        }
      }
      for (const skillName of parsed.preferredSkillNames) {
        const doc = await resolveSkillDocument(skillName);
        if (
          doc &&
          !reqSkillIds.some((id) => id.equals(doc._id as Types.ObjectId)) &&
          !prefSkillIds.some((id) => id.equals(doc._id as Types.ObjectId))
        ) {
          prefSkillIds.push(doc._id as Types.ObjectId);
        }
      }
    }

    // 7. Departments and Graduation Years
    const eligibleDepartments = deptsRaw
      ? deptsRaw
          .split(/[,;|]/)
          .map((d) => d.trim())
          .filter(Boolean)
      : [];

    const eligibleGraduationYears = gradYearsRaw
      ? gradYearsRaw
          .split(/[,;|]/)
          .map((y) => parseInt(y.trim(), 10))
          .filter((y) => !isNaN(y))
      : [];

    // 8. Compensation
    let salaryRange: { min?: number; max?: number; currency: string } | undefined;
    if (salaryMinRaw || salaryMaxRaw) {
      salaryRange = {
        min: salaryMinRaw ? parseFloat(salaryMinRaw) : undefined,
        max: salaryMaxRaw ? parseFloat(salaryMaxRaw) : undefined,
        currency: salaryCurrRaw,
      };
    }

    // 9. Create the Job Record
    const newJob: IJob = await Job.create({
      company: targetCompany._id,
      title,
      description,
      location,
      workplaceType,
      jobType,
      requiredSkills: reqSkillIds,
      preferredSkills: prefSkillIds,
      minCgpa,
      eligibleDepartments,
      eligibleGraduationYears,
      salaryRange,
      deadline,
      status: defaultStatus,
      postedBy: new Types.ObjectId(userId),
      sourceType,
      requisitionId: requisitionId || undefined,
      sourceUrl: sourceUrl || undefined,
      provenance: {
        sourceType,
        sourceUrl: sourceUrl || undefined,
        requisitionId: requisitionId || undefined,
        parserUsed: 'csv_import',
        ingestedAt: new Date(),
        ingestedBy: new Types.ObjectId(userId),
      },
    });

    summary.successful++;
    summary.createdJobs.push({
      id: newJob._id.toString(),
      title: newJob.title,
      company: targetCompany.name,
      requisitionId: newJob.requisitionId,
      status: newJob.status,
    });
  }

  return summary;
};
