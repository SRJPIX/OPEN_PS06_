import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Job, WorkplaceType, JobType, JobStatus } from '../models/Job';
import { JobSourceType } from '../models/JobSource';
import { Company, ICompany } from '../models/Company';
import { resolveSkillDocument } from '../utils/skillNormalizer';
import {
  checkExactDuplicate,
  calculateDuplicateSuggestions,
  mergeJobs,
} from '../utils/jobDeduplicator';
import { parseJobDescription } from '../utils/jobParser';
import { importJobsFromCsv } from '../utils/csvJobImporter';
import {
  createJobSchema,
  updateJobSchema,
  queryJobsSchema,
  mergeJobsSchema,
  parseJobSchema,
} from '../validators/job.validator';
import { sendSuccess, sendError } from '../utils/apiResponse';

/**
 * Checks whether a user has permission to manage jobs for a given company.
 */
export const isAuthorizedForCompany = (
  userId: string,
  userRole: string,
  company: ICompany
): boolean => {
  if (userRole === 'admin' || userRole === 'placement_officer') {
    return true;
  }
  if (userRole === 'recruiter') {
    if (company.createdBy.toString() === userId) return true;
    if (company.authorizedRecruiters?.some((id) => id.toString() === userId)) return true;
  }
  return false;
};

/**
 * Resolves company reference by ObjectId or by exact name lookup.
 */
const resolveCompany = async (
  companyInput: string,
  userId: string,
  userRole: string
): Promise<ICompany | null> => {
  if (/^[0-9a-fA-F]{24}$/.test(companyInput.trim())) {
    return Company.findById(companyInput.trim());
  }

  let company = await Company.findOne({
    name: new RegExp(`^${companyInput.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });

  if (!company && (userRole === 'admin' || userRole === 'placement_officer')) {
    // Auto-create company for placement officers / admins if not yet present
    company = await Company.create({
      name: companyInput.trim(),
      industry: 'Technology',
      isVerified: true,
      createdBy: new Types.ObjectId(userId),
    });
  }

  return company;
};

/**
 * POST /api/jobs
 * Creates a job with validation, exact duplicate rejection, and canonical skill mapping.
 */
export const createJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const validation = createJobSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(
        res,
        'VALIDATION_ERROR',
        'Validation failed',
        400,
        validation.error.flatten().fieldErrors
      );
      return;
    }

    const data = validation.data;
    let company: ICompany | null = null;
    if (data.company) {
      company = await resolveCompany(data.company, user._id.toString(), user.role);
    } else if (user.role === 'recruiter') {
      company = await Company.findOne({
        $or: [
          { createdBy: user._id },
          { authorizedRecruiters: user._id },
        ],
      });
    }

    if (!company) {
      sendError(res, 'NOT_FOUND', data.company ? `Company '${data.company}' not found` : 'Company not specified or not found for user', 404);
      return;
    }

    // Role-based company management authorization
    if (!isAuthorizedForCompany(user._id.toString(), user.role, company)) {
      sendError(
        res,
        'FORBIDDEN',
        'Forbidden: You are not authorized to post jobs for this company',
        403
      );
      return;
    }

    // Exact duplicate detection (requisition ID or source URL)
    const exactDupCheck = await checkExactDuplicate({
      companyId: company._id,
      requisitionId: data.requisitionId,
      sourceUrl: data.sourceUrl,
    });

    if (exactDupCheck.isDuplicate && data.sourceType !== 'partner_posting' && data.status !== 'draft') {
      sendError(
        res,
        'DUPLICATE_JOB',
        exactDupCheck.message ||
          'A duplicate job exists with identical requisition ID or source URL',
        409,
        {
          duplicateJobId: exactDupCheck.duplicateJob?._id,
          matchType: exactDupCheck.matchType,
        }
      );
      return;
    }

    // Resolve skills to canonical Skill document ObjectIds
    const requiredSkillIds: Types.ObjectId[] = [];
    for (const skillName of data.requiredSkills) {
      const doc = await resolveSkillDocument(skillName);
      if (doc && !requiredSkillIds.some((id) => id.equals(doc._id as Types.ObjectId))) {
        requiredSkillIds.push(doc._id as Types.ObjectId);
      }
    }

    const preferredSkillIds: Types.ObjectId[] = [];
    for (const skillName of data.preferredSkills) {
      const doc = await resolveSkillDocument(skillName);
      if (
        doc &&
        !requiredSkillIds.some((id) => id.equals(doc._id as Types.ObjectId)) &&
        !preferredSkillIds.some((id) => id.equals(doc._id as Types.ObjectId))
      ) {
        preferredSkillIds.push(doc._id as Types.ObjectId);
      }
    }

    // Similarity-based duplicate suggestions
    const potentialDups = await calculateDuplicateSuggestions({
      companyId: company._id,
      title: data.title,
      description: data.description,
      location: data.location,
      requisitionId: data.requisitionId,
    });

    const job = await Job.create({
      company: company._id,
      title: data.title,
      description: data.description,
      responsibilities: data.responsibilities,
      location: data.location,
      workplaceType: data.workplaceType as WorkplaceType,
      jobType: data.jobType as JobType,
      requiredSkills: requiredSkillIds,
      preferredSkills: preferredSkillIds,
      minCgpa: data.minCgpa,
      eligibleDepartments: data.eligibleDepartments,
      eligibleGraduationYears: data.eligibleGraduationYears,
      salaryRange: data.salaryRange,
      status: data.status as JobStatus,
      postedBy: user._id,
      source: data.source ? new Types.ObjectId(data.source) : undefined,
      sourceType: data.sourceType as JobSourceType,
      requisitionId: data.requisitionId || undefined,
      sourceUrl: data.sourceUrl || undefined,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      provenance: {
        sourceType: data.sourceType,
        sourceUrl: data.sourceUrl || undefined,
        requisitionId: data.requisitionId || undefined,
        partnerName: data.provenance?.partnerName,
        alumniReferrer: data.provenance?.alumniReferrer,
        apiSourceRef: data.provenance?.apiSourceRef,
        parserUsed: 'manual',
        ingestedAt: new Date(),
        ingestedBy: user._id,
      },
      potentialDuplicates: potentialDups.map((d) => ({
        jobId: d.jobId,
        similarityScore: d.similarityScore,
        matchReasons: d.matchReasons,
        status: 'pending_review',
        detectedAt: new Date(),
      })),
    });

    await job.populate('company', 'name industry logoUrl website');
    await job.populate('requiredSkills', 'name slug category');
    await job.populate('preferredSkills', 'name slug category');

    const jobObj = job.toObject();

    sendSuccess(
      res,
      {
        ...jobObj,
        job,
        duplicateSuggestions: potentialDups.length > 0 ? potentialDups : undefined,
      },
      'Job created successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/jobs
 * Lists jobs with role-based visibility and rich filtering (title, company, location, workMode, jobType).
 */
export const getJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    const queryValidation = queryJobsSchema.safeParse(req.query);
    if (!queryValidation.success) {
      sendError(
        res,
        'VALIDATION_ERROR',
        'Invalid query parameters',
        400,
        queryValidation.error.flatten().fieldErrors
      );
      return;
    }

    const {
      title,
      company: companyQuery,
      location,
      workplaceType,
      workMode,
      jobType,
      status,
      page,
      limit,
    } = queryValidation.data;

    const mongoFilter: Record<string, unknown> = {};

    // 1. Role-based scoping
    if (!user || user.role === 'student') {
      // Students and unauthenticated viewers can ONLY see published (open) jobs
      mongoFilter.status = 'open';
    } else if (user.role === 'recruiter') {
      // Recruiters only see jobs for companies they are authorized for
      const authorizedCompanies = await Company.find({
        $or: [{ createdBy: user._id }, { authorizedRecruiters: user._id }],
      }).select('_id');
      const companyIds = authorizedCompanies.map((c) => c._id);
      mongoFilter.company = { $in: companyIds };

      if (status) {
        mongoFilter.status = status;
      }
    } else if (user.role === 'placement_officer' || user.role === 'admin') {
      // Placement officers and admins can filter by status or view all jobs
      if (status) {
        mongoFilter.status = status;
      }
    }

    // 2. Query filters
    if (title) {
      mongoFilter.title = { $regex: title, $options: 'i' };
    }

    if (location) {
      mongoFilter.location = { $regex: location, $options: 'i' };
    }

    const effectiveWorkplace = (workplaceType || workMode) as WorkplaceType | undefined;
    if (effectiveWorkplace) {
      mongoFilter.workplaceType = effectiveWorkplace;
    }

    if (jobType) {
      mongoFilter.jobType = jobType;
    }

    if (companyQuery) {
      if (/^[0-9a-fA-F]{24}$/.test(companyQuery)) {
        mongoFilter.company = new Types.ObjectId(companyQuery);
      } else {
        const matchingCompanies = await Company.find({
          name: { $regex: companyQuery, $options: 'i' },
        }).select('_id');
        const compIds = matchingCompanies.map((c) => c._id);
        mongoFilter.company = { $in: compIds };
      }
    }

    const skip = (page - 1) * limit;
    const [jobs, total] = await Promise.all([
      Job.find(mongoFilter)
        .populate('company', 'name industry logoUrl website')
        .populate('requiredSkills', 'name slug category')
        .populate('preferredSkills', 'name slug category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Job.countDocuments(mongoFilter),
    ]);

    const totalPages = Math.ceil(total / limit);
    sendSuccess(res, jobs, 'Jobs retrieved successfully', 200, { page, limit, total, totalPages });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/jobs/:id
 * Retrieves job details with populated references and role access enforcement.
 */
export const getJobById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      sendError(res, 'INVALID_ID', 'Invalid job ID format', 400);
      return;
    }

    const job = await Job.findById(id)
      .populate('company')
      .populate('requiredSkills', 'name slug category aliases')
      .populate('preferredSkills', 'name slug category aliases')
      .populate('source')
      .populate('postedBy', 'email role');

    if (!job) {
      sendError(res, 'NOT_FOUND', 'Job not found', 404);
      return;
    }

    const user = req.user;
    // Access control: students cannot view non-published jobs
    if (user?.role === 'student' && job.status !== 'open') {
      sendError(res, 'NOT_FOUND', 'Job not found or not published', 404);
      return;
    }

    // Recruiters cannot view jobs outside their authorized companies
    if (user?.role === 'recruiter') {
      const company = job.company as unknown as ICompany;
      if (!isAuthorizedForCompany(user._id.toString(), user.role, company)) {
        sendError(
          res,
          'FORBIDDEN',
          'Forbidden: You are not authorized to view this company job',
          403
        );
        return;
      }
    }

    sendSuccess(res, { job }, 'Job retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/jobs/:id
 * Updates an existing job record with authorization checks and skill re-resolution.
 */
export const updateJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      sendError(res, 'INVALID_ID', 'Invalid job ID format', 400);
      return;
    }

    const job = await Job.findById(id).populate('company');
    if (!job) {
      sendError(res, 'NOT_FOUND', 'Job not found', 404);
      return;
    }

    // Role-based authorization
    const company = job.company as unknown as ICompany;
    if (!isAuthorizedForCompany(user._id.toString(), user.role, company)) {
      sendError(res, 'FORBIDDEN', 'Forbidden: You are not authorized to update this job', 403);
      return;
    }

    const validation = updateJobSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(
        res,
        'VALIDATION_ERROR',
        'Validation failed',
        400,
        validation.error.flatten().fieldErrors
      );
      return;
    }

    const data = validation.data;

    // Check duplicate if requisition ID or source URL changed
    if (data.requisitionId || data.sourceUrl) {
      const dupCheck = await checkExactDuplicate({
        companyId: company._id,
        requisitionId: data.requisitionId || job.requisitionId,
        sourceUrl: data.sourceUrl || job.sourceUrl,
        excludeJobId: job._id,
      });
      if (dupCheck.isDuplicate) {
        sendError(res, 'DUPLICATE_JOB', dupCheck.message || 'Duplicate job conflict', 409);
        return;
      }
    }

    // Update simple fields
    if (data.title) job.title = data.title;
    if (data.description) job.description = data.description;
    if (data.responsibilities) job.responsibilities = data.responsibilities;
    if (data.location) job.location = data.location;
    if (data.workplaceType) job.workplaceType = data.workplaceType as WorkplaceType;
    if (data.jobType) job.jobType = data.jobType as JobType;
    if (data.minCgpa !== undefined) job.minCgpa = data.minCgpa;
    if (data.eligibleDepartments) job.eligibleDepartments = data.eligibleDepartments;
    if (data.eligibleGraduationYears) job.eligibleGraduationYears = data.eligibleGraduationYears;
    if (data.salaryRange) job.salaryRange = data.salaryRange;
    if (data.status) job.status = data.status as JobStatus;
    if (data.requisitionId !== undefined) job.requisitionId = data.requisitionId;
    if (data.sourceUrl !== undefined) job.sourceUrl = data.sourceUrl;
    if (data.sourceType) job.sourceType = data.sourceType as JobSourceType;
    if (data.deadline) job.deadline = new Date(data.deadline);

    // Resolve skills if supplied
    if (data.requiredSkills) {
      const skillIds: Types.ObjectId[] = [];
      for (const skillName of data.requiredSkills) {
        const doc = await resolveSkillDocument(skillName);
        if (doc && !skillIds.some((s) => s.equals(doc._id as Types.ObjectId))) {
          skillIds.push(doc._id as Types.ObjectId);
        }
      }
      job.requiredSkills = skillIds;
    }

    if (data.preferredSkills) {
      const skillIds: Types.ObjectId[] = [];
      for (const skillName of data.preferredSkills) {
        const doc = await resolveSkillDocument(skillName);
        if (doc && !skillIds.some((s) => s.equals(doc._id as Types.ObjectId))) {
          skillIds.push(doc._id as Types.ObjectId);
        }
      }
      job.preferredSkills = skillIds;
    }

    await job.save();
    await job.populate('company', 'name industry logoUrl website');
    await job.populate('requiredSkills', 'name slug category');
    await job.populate('preferredSkills', 'name slug category');

    sendSuccess(res, { job }, 'Job updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/jobs/:id/archive
 * Archives a job with appropriate authorization checks.
 */
export const archiveJob = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      sendError(res, 'INVALID_ID', 'Invalid job ID format', 400);
      return;
    }

    const job = await Job.findById(id).populate('company');
    if (!job) {
      sendError(res, 'NOT_FOUND', 'Job not found', 404);
      return;
    }

    const company = job.company as unknown as ICompany;
    if (!isAuthorizedForCompany(user._id.toString(), user.role, company)) {
      sendError(res, 'FORBIDDEN', 'Forbidden: You are not authorized to archive this job', 403);
      return;
    }

    job.status = 'archived';
    await job.save();

    sendSuccess(res, { job }, 'Job archived successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/jobs/parse
 * Parses a raw job description into structured fields using deterministic rules and canonical skills.
 */
export const parseJobDescriptionEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validation = parseJobSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(
        res,
        'VALIDATION_ERROR',
        'Validation failed',
        400,
        validation.error.flatten().fieldErrors
      );
      return;
    }

    const { text, useLlm } = validation.data;
    const parsedData = await parseJobDescription(text, { useLlm });

    sendSuccess(res, { parsed: parsedData }, 'Job description parsed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/jobs/import/csv
 * Imports jobs from CSV with row-level validation and detailed rejection logs.
 */
export const importJobsCsvEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    let csvContent = '';

    if (typeof req.body === 'string') {
      csvContent = req.body;
    } else if (req.body && typeof req.body.csvContent === 'string') {
      csvContent = req.body.csvContent;
    } else if (req.body && typeof req.body.csv === 'string') {
      csvContent = req.body.csv;
    }

    if (!csvContent || !csvContent.trim()) {
      sendError(
        res,
        'BAD_REQUEST',
        'CSV content is required in request body or csvContent field',
        400
      );
      return;
    }

    const summary = await importJobsFromCsv({
      csvContent,
      userId: user._id.toString(),
      userRole: user.role,
    });

    sendSuccess(res, { summary }, 'CSV job import completed');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/jobs/:id/duplicates
 * Lists potential similarity-based duplicates for a specific job.
 */
export const getJobDuplicatesEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = req.user!;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      sendError(res, 'INVALID_ID', 'Invalid job ID format', 400);
      return;
    }

    const job = await Job.findById(id).populate('company');
    if (!job) {
      sendError(res, 'NOT_FOUND', 'Job not found', 404);
      return;
    }

    const company = job.company as unknown as ICompany;
    if (!isAuthorizedForCompany(user._id.toString(), user.role, company)) {
      sendError(
        res,
        'FORBIDDEN',
        'Forbidden: You are not authorized to view duplicates for this job',
        403
      );
      return;
    }

    const suggestions = await calculateDuplicateSuggestions({
      companyId: company._id,
      title: job.title,
      description: job.description,
      location: job.location,
      requisitionId: job.requisitionId,
      excludeJobId: job._id,
    });

    sendSuccess(res, { suggestions }, 'Duplicate suggestions retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/jobs/duplicates/all
 * Lists all jobs that currently have suspected duplicate candidates in the catalog.
 */
export const getAllDuplicateCandidatesEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobs = await Job.find({ status: { $ne: 'archived' } })
      .populate('company', 'name industry logoUrl website')
      .sort({ createdAt: -1 })
      .limit(60);

    const results: Array<{
      job: unknown;
      duplicates: unknown[];
    }> = [];

    for (const job of jobs) {
      if (!job.company) continue;
      const suggestions = await calculateDuplicateSuggestions({
        companyId: (job.company as any)._id,
        title: job.title,
        description: job.description,
        location: job.location,
        requisitionId: job.requisitionId,
        excludeJobId: job._id,
      });

      if (suggestions && suggestions.length > 0) {
        results.push({
          job,
          duplicates: suggestions,
        });
      }
    }

    sendSuccess(
      res,
      { candidates: results, total: results.length },
      'Duplicate candidates retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/jobs/merge
 * Merges a duplicate job into a primary job, preserving source provenance.
 * Enforces rule: Never merge distinct requisitions solely because their titles match.
 */
export const mergeJobsEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const validation = mergeJobsSchema.safeParse(req.body);
    if (!validation.success) {
      sendError(
        res,
        'VALIDATION_ERROR',
        'Validation failed',
        400,
        validation.error.flatten().fieldErrors
      );
      return;
    }

    const { primaryJobId, duplicateJobId, notes } = validation.data;

    // Check authorization on primary job
    const primaryJob = await Job.findById(primaryJobId).populate('company');
    if (!primaryJob) {
      sendError(res, 'NOT_FOUND', 'Primary job not found', 404);
      return;
    }

    const primaryCompany = primaryJob.company as unknown as ICompany;
    if (!isAuthorizedForCompany(user._id.toString(), user.role, primaryCompany)) {
      sendError(
        res,
        'FORBIDDEN',
        'Forbidden: You are not authorized to manage the primary job',
        403
      );
      return;
    }

    const updatedJob = await mergeJobs({
      primaryJobId,
      duplicateJobId,
      mergedByUserId: user._id,
      notes,
    });

    sendSuccess(res, { job: updatedJob }, 'Jobs successfully merged');
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Cannot merge distinct requisitions')) {
      sendError(res, 'DISTINCT_REQUISITIONS', error.message, 400);
      return;
    }
    next(error);
  }
};
