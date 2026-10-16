import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Application, ApplicationStatus } from '../models/Application';
import { ApplicationStatusHistory } from '../models/ApplicationStatusHistory';
import { StudentProfile } from '../models/StudentProfile';
import { Job } from '../models/Job';
import { Resume } from '../models/Resume';
import { Company, ICompany } from '../models/Company';
import { AuditLog } from '../models/AuditLog';
import { ApiError } from '../utils/apiError';
import { sendSuccess } from '../utils/apiResponse';
import {
  canTransitionStatus,
  checkDuplicateApplication,
  calculateStudentDashboardMetrics,
  calculatePlacementDashboardMetrics,
} from '../utils/applicationWorkflow';
import { exportApplicationsToCsv } from '../utils/applicationCsvExporter';
import {
  submitApplicationSchema,
  updateApplicationStatusSchema,
  updateInterviewDetailsSchema,
  updateOfferDetailsSchema,
  withdrawApplicationSchema,
  queryApplicationsSchema,
} from '../validators/application.validator';

/**
 * Checks whether a user has permission to manage applications for a given company.
 */
export const isAuthorizedForCompany = (userId: string, userRole: string, company: any): boolean => {
  if (userRole === 'admin' || userRole === 'placement_officer') {
    return true;
  }
  if (userRole === 'recruiter') {
    const creatorId = company.createdBy?._id
      ? company.createdBy._id.toString()
      : company.createdBy?.toString();
    if (creatorId === userId) return true;

    if (
      company.authorizedRecruiters?.some((id: any) => {
        const strId = id?._id ? id._id.toString() : id.toString();
        return strId === userId;
      })
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Helper to fetch all job IDs authorized for a recruiter.
 */
const getAuthorizedJobIdsForRecruiter = async (userId: string): Promise<Types.ObjectId[]> => {
  const companies = await Company.find({
    $or: [{ createdBy: userId }, { authorizedRecruiters: userId }],
  }).select('_id');
  const companyIds = companies.map((c) => c._id);
  const jobs = await Job.find({ company: { $in: companyIds } }).select('_id');
  return jobs.map((j) => j._id as Types.ObjectId);
};

/**
 * POST /api/applications
 * Apply to an open/published job using an approved/generated resume version.
 * Prevents duplicate applications to the same canonical job.
 * Stores the exact submitted resume version and snapshot.
 */
export const submitApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const validated = submitApplicationSchema.parse(req.body);
    const { jobId, resumeId, coverLetter } = validated;

    // 1. Verify Job is Published & Open
    const job = await Job.findById(jobId).populate('company', 'name');
    if (!job) throw ApiError.notFound('Target job listing not found.');

    if (job.status !== 'open') {
      throw ApiError.badRequest(
        `This job listing is not accepting applications (current job status: '${job.status}'). Only published, open jobs can receive applications.`
      );
    }

    // 2. Prevent duplicate applications to the same canonical job
    const dupCheck = await checkDuplicateApplication(profile._id as Types.ObjectId, job);
    if (dupCheck.isDuplicate) {
      throw ApiError.conflict(dupCheck.message || 'You have already applied for this position.');
    }

    // 3. Verify Resume belongs to student and follows approved-resume workflow
    const resume = await Resume.findById(resumeId);
    if (!resume || !resume.student.equals(profile._id as Types.ObjectId)) {
      throw ApiError.badRequest('Specified resume does not exist or does not belong to you.');
    }

    if (resume.status !== 'generated' && resume.status !== 'verified') {
      throw ApiError.badRequest(
        `Applications can only be submitted using an approved/generated resume version (current resume status: '${resume.status}'). Draft or archived resumes cannot be submitted.`
      );
    }

    // 4. Store exact submitted resume version & immutable snapshot
    const resumeSnapshot = {
      resumeId: resume._id as Types.ObjectId,
      version: resume.version,
      title: resume.title,
      summary: resume.summary,
      targetRole: resume.targetRole,
      fileUrl: resume.fileUrl,
      submittedAt: new Date(),
    };

    // 5. Create Application record
    const application = await Application.create({
      student: profile._id,
      job: job._id,
      resume: resume._id,
      resumeVersion: resume.version,
      resumeSnapshot,
      currentStatus: 'APPLIED',
      appliedAt: new Date(),
      coverLetter: coverLetter?.trim(),
    });

    // 6. Record Initial Status History
    const initialHistory = await ApplicationStatusHistory.create({
      application: application._id,
      toStatus: 'APPLIED',
      changedBy: req.user._id,
      changedByRole: req.user.role,
      notes: `Applied with approved resume: "${resume.title}" (Version ${resume.version})`,
      changedAt: new Date(),
    });

    // 7. Audit Log
    AuditLog.create({
      user: req.user._id,
      action: 'JOB_APPLICATION_SUBMITTED',
      entityType: 'Application',
      entityId: application._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch((err) => console.error('[AuditLog] Failed to log application submission:', err));

    await application.populate({
      path: 'job',
      select: 'title workplaceType jobType location status deadline duplicateOf',
      populate: { path: 'company', select: 'name logoUrl industry' },
    });
    await application.populate('resume', 'title version status');

    sendSuccess(
      res,
      { application, history: [initialHistory] },
      'Application submitted successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/applications/me
 * List all job applications submitted by the authenticated student.
 * Preserves applications even if a job is archived.
 */
export const getMyApplications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { student: profile._id };
    if (req.query.status) {
      filter.currentStatus = (req.query.status as string).trim().toUpperCase();
    }

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate({
          path: 'job',
          select:
            'title workplaceType jobType location salaryRange status deadline requisitionId duplicateOf',
          populate: { path: 'company', select: 'name logoUrl industry' },
        })
        .populate('resume', 'title version status isPrimary')
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(filter),
    ]);

    sendSuccess(
      res,
      {
        applications,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'My applications retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/applications/:id
 * Retrieve a specific application with populated details and chronological status history.
 */
export const getApplicationById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid application ID format.');
    }

    const application = await Application.findById(id)
      .populate({
        path: 'job',
        populate: { path: 'company' },
      })
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'email role' },
      })
      .populate('resume');

    if (!application) throw ApiError.notFound('Application not found.');

    const job = application.job as any;
    const company = job?.company as ICompany;

    // Role-based Access Control
    if (req.user.role === 'student') {
      const profile = await StudentProfile.findOne({ user: req.user.userId });
      if (!profile || !application.student.equals(profile._id as Types.ObjectId)) {
        throw ApiError.forbidden('You are not authorized to view this application.');
      }
    } else if (req.user.role === 'recruiter') {
      if (!company || !isAuthorizedForCompany(req.user.userId, req.user.role, company)) {
        throw ApiError.forbidden(
          'You are not authorized to view applications for jobs outside your assigned company.'
        );
      }
    }

    // Fetch chronological status history
    const history = await ApplicationStatusHistory.find({ application: application._id })
      .populate('changedBy', 'email role')
      .sort({ changedAt: 1 });

    sendSuccess(res, { application, history }, 'Application details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/applications
 * List applications with filtering, search, and pagination.
 * Scoped to authorized companies for recruiters; campus-wide for placement officers and admins.
 */
export const listApplications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const validated = queryApplicationsSchema.parse(req.query);
    const {
      jobId,
      companyId,
      status,
      studentId,
      search,
      fromDate,
      toDate,
      page,
      limit,
      sortBy,
      sortOrder,
    } = validated;

    const filter: Record<string, unknown> = {};

    // 1. Recruiter Access Scoping
    if (req.user.role === 'recruiter') {
      const authorizedJobIds = await getAuthorizedJobIdsForRecruiter(req.user.userId);
      if (jobId) {
        if (!authorizedJobIds.some((id) => id.toString() === jobId)) {
          sendSuccess(res, {
            applications: [],
            pagination: { total: 0, page, limit, totalPages: 0 },
          });
          return;
        }
        filter.job = new Types.ObjectId(jobId);
      } else {
        filter.job = { $in: authorizedJobIds };
      }
    } else if (jobId) {
      filter.job = new Types.ObjectId(jobId);
    }

    // 2. Company Filter
    if (companyId) {
      const jobsUnderCompany = await Job.find({ company: companyId }).select('_id');
      const companyJobIds = jobsUnderCompany.map((j) => j._id);
      if (filter.job && (filter.job as any).$in) {
        const existing = (filter.job as any).$in as Types.ObjectId[];
        filter.job = {
          $in: existing.filter((id) => companyJobIds.some((cid) => cid.equals(id))),
        };
      } else {
        filter.job = { $in: companyJobIds };
      }
    }

    // 3. Status Filter (supports comma-separated list or single status)
    if (status) {
      const statuses = status
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (statuses.length === 1) {
        filter.currentStatus = statuses[0];
      } else if (statuses.length > 1) {
        filter.currentStatus = { $in: statuses };
      }
    }

    // 4. Student Filter
    if (studentId) {
      filter.student = new Types.ObjectId(studentId);
    }

    // 5. Date Range Filter on appliedAt
    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {};
      if (fromDate) dateFilter.$gte = new Date(fromDate);
      if (toDate) dateFilter.$lte = new Date(toDate);
      filter.appliedAt = dateFilter;
    }

    // 6. Search Filter
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      const matchingProfiles = await StudentProfile.find({
        $or: [{ rollNumber: regex }, { department: regex }],
      }).select('_id');
      const matchingProfileIds = matchingProfiles.map((p) => p._id);

      const matchingJobs = await Job.find({ title: regex }).select('_id');
      const matchingJobIds = matchingJobs.map((j) => j._id);

      filter.$or = [{ student: { $in: matchingProfileIds } }, { job: { $in: matchingJobIds } }];
    }

    const skip = (page - 1) * limit;
    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate({
          path: 'job',
          select:
            'title workplaceType jobType location salaryRange status deadline requisitionId duplicateOf',
          populate: { path: 'company', select: 'name logoUrl industry' },
        })
        .populate({
          path: 'student',
          select: 'rollNumber department degree graduationYear cgpa phone links',
          populate: { path: 'user', select: 'email role' },
        })
        .populate('resume', 'title version status isPrimary')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      Application.countDocuments(filter),
    ]);

    sendSuccess(
      res,
      {
        applications,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Applications retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/applications/:id/status
 * Move an application through valid workflow transitions.
 * Enforces role authorization and records who changed what and when.
 */
export const updateApplicationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid application ID format.');
    }

    const application = await Application.findById(id).populate({
      path: 'job',
      populate: { path: 'company' },
    });
    if (!application) throw ApiError.notFound('Application not found.');

    const job = application.job as any;
    const company = job?.company as ICompany;

    // 1. Role Permission & Company Scope Check
    if (req.user.role === 'student') {
      throw ApiError.forbidden(
        'Students are strictly forbidden from changing application status to INTERVIEW, OFFER, or advancing status. Only application withdrawal is permitted.'
      );
    }

    if (req.user.role === 'recruiter') {
      if (!company || !isAuthorizedForCompany(req.user.userId, req.user.role, company)) {
        throw ApiError.forbidden(
          'Recruiters are only authorized to update applications for jobs belonging to their own company.'
        );
      }
    }

    const validated = updateApplicationStatusSchema.parse(req.body);
    const { status: targetStatus, notes, interviewDetails, offerDetails } = validated;

    // 2. Validate Workflow Transition
    const transitionCheck = canTransitionStatus(
      application.currentStatus,
      targetStatus as ApplicationStatus,
      req.user.role
    );
    if (!transitionCheck.valid) {
      throw ApiError.badRequest(transitionCheck.message || 'Invalid status transition.');
    }

    // 3. Update Application state
    const previousStatus = application.currentStatus;
    application.currentStatus = targetStatus as ApplicationStatus;

    if (interviewDetails) {
      const existing =
        (application.interviewDetails as any)?.toObject?.() || application.interviewDetails || {};
      application.interviewDetails = {
        ...existing,
        ...interviewDetails,
        scheduledAt: interviewDetails.scheduledAt
          ? new Date(interviewDetails.scheduledAt)
          : application.interviewDetails?.scheduledAt,
      };
    }

    if (offerDetails) {
      const existing =
        (application.offerDetails as any)?.toObject?.() || application.offerDetails || {};
      application.offerDetails = {
        ...existing,
        ...offerDetails,
        joiningDate: offerDetails.joiningDate
          ? new Date(offerDetails.joiningDate)
          : application.offerDetails?.joiningDate,
        deadline: offerDetails.deadline
          ? new Date(offerDetails.deadline)
          : application.offerDetails?.deadline,
      };
    }

    if (notes) {
      application.notes = notes;
    }

    await application.save();

    // 4. Record Status History with Who and When
    const historyRecord = await ApplicationStatusHistory.create({
      application: application._id,
      fromStatus: previousStatus,
      toStatus: targetStatus,
      changedBy: req.user._id,
      changedByRole: req.user.role,
      notes: notes || `Application moved from ${previousStatus} to ${targetStatus}`,
      interviewDetails: application.interviewDetails,
      offerDetails: application.offerDetails,
      changedAt: new Date(),
    });

    // 5. Audit Log
    AuditLog.create({
      user: req.user._id,
      action: 'APPLICATION_STATUS_UPDATE',
      entityType: 'Application',
      entityId: application._id.toString(),
      metadata: {
        fromStatus: previousStatus,
        toStatus: targetStatus,
        role: req.user.role,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch((err) => console.error('[AuditLog] Failed to log status change:', err));

    sendSuccess(
      res,
      { application, history: historyRecord },
      `Application status updated to ${targetStatus} successfully`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/applications/:id/interview
 * Update or schedule interview details for an application.
 * Can transition application to INTERVIEW if in UNDER_REVIEW.
 */
export const updateInterviewDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid application ID format.');

    const application = await Application.findById(id).populate({
      path: 'job',
      populate: { path: 'company' },
    });
    if (!application) throw ApiError.notFound('Application not found.');

    const job = application.job as any;
    const company = job?.company as ICompany;

    if (req.user.role === 'student') {
      throw ApiError.forbidden(
        'Students are not permitted to update interview schedules or details.'
      );
    }

    if (req.user.role === 'recruiter') {
      if (!company || !isAuthorizedForCompany(req.user.userId, req.user.role, company)) {
        throw ApiError.forbidden('You are not authorized to update interviews for this job.');
      }
    }

    const validated = updateInterviewDetailsSchema.parse(req.body);

    const previousStatus = application.currentStatus;
    let targetStatus = previousStatus;

    if (previousStatus === 'UNDER_REVIEW') {
      targetStatus = 'INTERVIEW';
      application.currentStatus = 'INTERVIEW';
    } else if (previousStatus !== 'INTERVIEW' && previousStatus !== 'OFFER') {
      throw ApiError.badRequest(
        `Cannot record interview details for an application in status '${previousStatus}'. Application must be in UNDER_REVIEW or INTERVIEW.`
      );
    }

    const existing =
      (application.interviewDetails as any)?.toObject?.() || application.interviewDetails || {};
    application.interviewDetails = {
      ...existing,
      ...validated,
      scheduledAt: validated.scheduledAt
        ? new Date(validated.scheduledAt)
        : application.interviewDetails?.scheduledAt,
    };

    await application.save();

    const historyRecord = await ApplicationStatusHistory.create({
      application: application._id,
      fromStatus: previousStatus,
      toStatus: targetStatus,
      changedBy: req.user._id,
      changedByRole: req.user.role,
      notes:
        validated.notes || `Interview details updated (Round: ${validated.round || 'Initial'})`,
      interviewDetails: application.interviewDetails,
      changedAt: new Date(),
    });

    sendSuccess(
      res,
      { application, history: historyRecord },
      'Interview details saved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/applications/:id/offer
 * Record or update offer details for an application.
 * Can transition application to OFFER if in INTERVIEW.
 */
export const updateOfferDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid application ID format.');

    const application = await Application.findById(id).populate({
      path: 'job',
      populate: { path: 'company' },
    });
    if (!application) throw ApiError.notFound('Application not found.');

    const job = application.job as any;
    const company = job?.company as ICompany;

    if (req.user.role === 'student') {
      throw ApiError.forbidden('Students are not permitted to grant or update job offer details.');
    }

    if (req.user.role === 'recruiter') {
      if (!company || !isAuthorizedForCompany(req.user.userId, req.user.role, company)) {
        throw ApiError.forbidden('You are not authorized to issue offers for this job.');
      }
    }

    const validated = updateOfferDetailsSchema.parse(req.body);

    const previousStatus = application.currentStatus;
    let targetStatus = previousStatus;

    if (previousStatus === 'INTERVIEW') {
      targetStatus = 'OFFER';
      application.currentStatus = 'OFFER';
    } else if (previousStatus !== 'OFFER') {
      throw ApiError.badRequest(
        `Cannot record offer details for an application in status '${previousStatus}'. Candidate must be in INTERVIEW status prior to receiving an offer.`
      );
    }

    const existing =
      (application.offerDetails as any)?.toObject?.() || application.offerDetails || {};
    application.offerDetails = {
      ...existing,
      ...validated,
      joiningDate: validated.joiningDate
        ? new Date(validated.joiningDate)
        : application.offerDetails?.joiningDate,
      deadline: validated.deadline
        ? new Date(validated.deadline)
        : application.offerDetails?.deadline,
    };

    await application.save();

    const historyRecord = await ApplicationStatusHistory.create({
      application: application._id,
      fromStatus: previousStatus,
      toStatus: targetStatus,
      changedBy: req.user._id,
      changedByRole: req.user.role,
      notes:
        validated.notes ||
        `Offer recorded: CTC ${validated.offeredCtc ? `${validated.offeredCtc} ${validated.currency || 'INR'}` : 'Negotiable'}`,
      offerDetails: application.offerDetails,
      changedAt: new Date(),
    });

    sendSuccess(
      res,
      { application, history: historyRecord },
      'Offer details recorded successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/applications/:id/withdraw
 * Allows a student to withdraw their active application.
 */
export const withdrawApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid application ID format.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const application = await Application.findById(id);
    if (!application || !application.student.equals(profile._id as Types.ObjectId)) {
      throw ApiError.notFound('Application not found or unauthorized.');
    }

    if (application.currentStatus === 'WITHDRAWN') {
      throw ApiError.badRequest('Application has already been withdrawn.');
    }

    if (application.currentStatus === 'REJECTED') {
      throw ApiError.badRequest('Cannot withdraw an application that has already been rejected.');
    }

    const previousStatus = application.currentStatus;
    application.currentStatus = 'WITHDRAWN';
    const validated = withdrawApplicationSchema.parse(req.body || {});
    if (validated.notes) {
      application.notes = validated.notes;
    }
    await application.save();

    const historyRecord = await ApplicationStatusHistory.create({
      application: application._id,
      fromStatus: previousStatus,
      toStatus: 'WITHDRAWN',
      changedBy: req.user._id,
      changedByRole: 'student',
      notes: validated.notes || 'Application withdrawn by candidate.',
      changedAt: new Date(),
    });

    AuditLog.create({
      user: req.user._id,
      action: 'APPLICATION_WITHDRAWN',
      entityType: 'Application',
      entityId: application._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch((err) => console.error('[AuditLog] Failed to log withdrawal:', err));

    sendSuccess(res, { application, history: historyRecord }, 'Application withdrawn successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/applications/export/csv
 * Export applications to RFC 4180 compliant CSV.
 */
export const exportApplicationsCsv = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const validated = queryApplicationsSchema.parse(req.query);
    const { jobId, companyId, status, studentId, fromDate, toDate } = validated;

    const filter: Record<string, unknown> = {};

    if (req.user.role === 'recruiter') {
      const authorizedJobIds = await getAuthorizedJobIdsForRecruiter(req.user.userId);
      if (jobId) {
        if (!authorizedJobIds.some((id) => id.toString() === jobId)) {
          const emptyCsv = exportApplicationsToCsv([]);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename="evidra-applications-export.csv"'
          );
          res.status(200).send(emptyCsv);
          return;
        }
        filter.job = new Types.ObjectId(jobId);
      } else {
        filter.job = { $in: authorizedJobIds };
      }
    } else if (jobId) {
      filter.job = new Types.ObjectId(jobId);
    }

    if (companyId) {
      const jobsUnderCompany = await Job.find({ company: companyId }).select('_id');
      const companyJobIds = jobsUnderCompany.map((j) => j._id);
      filter.job = { $in: companyJobIds };
    }

    if (status) {
      const statuses = status
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (statuses.length === 1) filter.currentStatus = statuses[0];
      else if (statuses.length > 1) filter.currentStatus = { $in: statuses };
    }

    if (studentId) {
      filter.student = new Types.ObjectId(studentId);
    }

    if (fromDate || toDate) {
      const dateFilter: Record<string, unknown> = {};
      if (fromDate) dateFilter.$gte = new Date(fromDate);
      if (toDate) dateFilter.$lte = new Date(toDate);
      filter.appliedAt = dateFilter;
    }

    const applications = await Application.find(filter)
      .populate({
        path: 'job',
        select: 'title workplaceType jobType location salaryRange status requisitionId',
        populate: { path: 'company', select: 'name logoUrl industry' },
      })
      .populate({
        path: 'student',
        select: 'rollNumber department degree graduationYear cgpa',
        populate: { path: 'user', select: 'email role' },
      })
      .populate('resume', 'title version status')
      .sort({ appliedAt: -1 })
      .limit(5000);

    const csvData = exportApplicationsToCsv(applications);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="evidra-applications-export.csv"');
    res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/applications/stats/student
 * Calculate student application pipeline statistics from actual database records.
 */
export const getStudentApplicationStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const applications = await Application.find({ student: profile._id })
      .populate({
        path: 'job',
        select: 'title workplaceType jobType location status deadline',
        populate: { path: 'company', select: 'name logoUrl' },
      })
      .sort({ appliedAt: -1 });

    const metrics = calculateStudentDashboardMetrics(applications);

    const recentApplications = applications.slice(0, 5);

    sendSuccess(
      res,
      {
        metrics,
        recentApplications,
      },
      'Student application statistics calculated successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/applications/stats/placement
 * Calculate aggregate placement pipeline statistics from actual database records.
 */
export const getPlacementApplicationStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const filter: Record<string, unknown> = {};

    if (req.user.role === 'recruiter') {
      const authorizedJobIds = await getAuthorizedJobIdsForRecruiter(req.user.userId);
      filter.job = { $in: authorizedJobIds };
    }

    const applications = await Application.find(filter)
      .populate({
        path: 'student',
        select: 'rollNumber department degree graduationYear cgpa',
      })
      .populate({
        path: 'job',
        select: 'title company',
      });

    const metrics = calculatePlacementDashboardMetrics(applications);

    // Fetch recent 10 status transitions across campus
    const recentTransitions = await ApplicationStatusHistory.find()
      .populate({
        path: 'application',
        select: 'job student',
        populate: [
          { path: 'job', select: 'title' },
          { path: 'student', select: 'rollNumber department' },
        ],
      })
      .populate('changedBy', 'email role')
      .sort({ changedAt: -1 })
      .limit(10);

    sendSuccess(
      res,
      {
        metrics,
        recentTransitions,
      },
      'Placement pipeline statistics calculated successfully'
    );
  } catch (error) {
    next(error);
  }
};
