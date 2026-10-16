import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Application, ApplicationStatus, APPLICATION_STATUSES } from '../models/Application';
import { ApplicationStatusHistory } from '../models/ApplicationStatusHistory';
import { StudentProfile } from '../models/StudentProfile';
import { Job } from '../models/Job';
import { Resume } from '../models/Resume';
import { Company, ICompany } from '../models/Company';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { ApiError } from '../utils/apiError';
import { sendSuccess } from '../utils/apiResponse';
import { isAuthorizedForCompany } from './job.controller';

/**
 * GET /api/applications/me
 * List all job applications submitted by the authenticated student.
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

    const applications = await Application.find({ student: profile._id })
      .populate({
        path: 'job',
        select: 'title workplaceType jobType location salaryMin salaryMax salaryCurrency status deadline',
        populate: { path: 'company', select: 'name logoUrl industry' },
      })
      .populate('resume', 'title version status isPrimary')
      .sort({ appliedAt: -1 });

    sendSuccess(res, applications, 'Applications retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/applications/:id
 * Retrieve a specific application with its persisted status history timeline.
 */
export const getApplicationById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid application ID format.');

    const application = await Application.findById(id)
      .populate({
        path: 'job',
        populate: { path: 'company' },
      })
      .populate('resume');

    if (!application) throw ApiError.notFound('Application not found.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile && req.user.role === 'student') {
      throw ApiError.notFound('Student profile not found.');
    }

    // Role check: student can only view own application
    if (req.user.role === 'student' && !application.student.equals(profile!._id as Types.ObjectId)) {
      throw ApiError.forbidden('You are not authorized to view this application.');
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
 * POST /api/applications
 * Apply to an open job using an approved/generated resume.
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

    const { jobId, resumeId, coverLetter } = req.body as {
      jobId: string;
      resumeId: string;
      coverLetter?: string;
    };

    if (!jobId || !Types.ObjectId.isValid(jobId)) {
      throw ApiError.badRequest('A valid jobId is required.');
    }

    if (!resumeId || !Types.ObjectId.isValid(resumeId)) {
      throw ApiError.badRequest('A valid resumeId is required.');
    }

    // 1. Verify Job is Open
    const job = await Job.findById(jobId).populate('company', 'name');
    if (!job) throw ApiError.notFound('Target job listing not found.');

    if (job.status !== 'open') {
      throw ApiError.badRequest('This job listing is no longer accepting applications.');
    }

    // 2. Verify Resume belongs to student and follows the approved-resume workflow
    const resume = await Resume.findById(resumeId);
    if (!resume || !resume.student.equals(profile._id as Types.ObjectId)) {
      throw ApiError.badRequest('Specified resume does not exist or does not belong to you.');
    }

    if (resume.status !== 'generated' && resume.status !== 'verified') {
      throw ApiError.badRequest(
        'Applications can only be submitted using an approved/generated evidence-backed resume. Please generate a tailored resume first.'
      );
    }

    // 3. Prevent duplicate applications
    const existingApp = await Application.findOne({
      student: profile._id,
      job: job._id,
    });
    if (existingApp) {
      throw ApiError.conflict('You have already applied for this position.');
    }

    // 4. Create Application record
    const application = await Application.create({
      student: profile._id,
      job: job._id,
      resume: resume._id,
      currentStatus: 'applied',
      appliedAt: new Date(),
      coverLetter: coverLetter?.trim(),
    });

    // 5. Create Initial Status History Record
    const initialHistory = await ApplicationStatusHistory.create({
      application: application._id,
      toStatus: 'applied',
      changedBy: req.user._id,
      notes: `Applied with tailored resume: "${resume.title}" (v${resume.version})`,
      changedAt: new Date(),
    });

    // 6. Audit Log
    AuditLog.create({
      user: req.user._id,
      action: 'JOB_APPLICATION_SUBMITTED',
      entityType: 'Application',
      entityId: application._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch((err) => console.error('[AuditLog] Failed to log application:', err));

    await application.populate({
      path: 'job',
      select: 'title workplaceType jobType location',
      populate: { path: 'company', select: 'name logoUrl' },
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

    if (application.currentStatus === 'withdrawn') {
      throw ApiError.badRequest('Application has already been withdrawn.');
    }

    const previousStatus = application.currentStatus;
    application.currentStatus = 'withdrawn';
    await application.save();

    await ApplicationStatusHistory.create({
      application: application._id,
      fromStatus: previousStatus,
      toStatus: 'withdrawn',
      changedBy: req.user._id,
      notes: 'Application withdrawn by candidate.',
      changedAt: new Date(),
    });

    sendSuccess(res, application, 'Application withdrawn successfully');
  } catch (error) {
    next(error);
  }
};

const ALLOWED_FORWARD_TRANSITIONS: Record<string, string[]> = {
  applied: ['screening', 'rejected', 'withdrawn'],
  screening: ['shortlisted', 'rejected', 'withdrawn'],
  shortlisted: ['assessment', 'interview', 'rejected', 'withdrawn'],
  assessment: ['interview', 'rejected', 'withdrawn'],
  interview: ['offered', 'rejected', 'withdrawn'],
  offered: ['rejected', 'withdrawn'],
  rejected: ['applied', 'screening', 'shortlisted'],
  withdrawn: [],
};

/**
 * GET /api/applications
 * Placement officer & recruiter: list applications with filters, pagination, and search.
 */
export const listApplications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const status = req.query.status as string;
    const jobId = req.query.jobId as string;
    const studentId = req.query.studentId as string;
    const department = req.query.department as string;
    const search = req.query.search as string;

    const query: Record<string, unknown> = {};

    if (status && status !== 'all') {
      query.currentStatus = status;
    }
    if (jobId && Types.ObjectId.isValid(jobId)) {
      query.job = new Types.ObjectId(jobId);
    }
    if (studentId && Types.ObjectId.isValid(studentId)) {
      query.student = new Types.ObjectId(studentId);
    }

    // If recruiter, filter by authorized companies
    if (req.user.role === 'recruiter') {
      const authorizedCompanies = await Company.find({
        $or: [
          { createdBy: req.user.userId },
          { authorizedRecruiters: req.user.userId },
        ],
      }).select('_id');
      const companyIds = authorizedCompanies.map((c) => c._id);
      const authorizedJobs = await Job.find({ company: { $in: companyIds } }).select('_id');
      const jobIds = authorizedJobs.map((j) => j._id);
      query.job = { $in: jobIds };
    }

    if (department) {
      const studentProfiles = await StudentProfile.find({
        department: { $regex: department.trim(), $options: 'i' },
      }).select('_id');
      query.student = { $in: studentProfiles.map((p) => p._id) };
    }

    if (search && search.trim()) {
      const trimmed = search.trim();
      const [matchingUsers, matchingJobs] = await Promise.all([
        User.find({ email: { $regex: trimmed, $options: 'i' } }).select('_id'),
        Job.find({ title: { $regex: trimmed, $options: 'i' } }).select('_id'),
      ]);
      const userIds = matchingUsers.map((u) => u._id);
      const matchingProfiles = await StudentProfile.find({
        $or: [
          { rollNumber: { $regex: trimmed, $options: 'i' } },
          { user: { $in: userIds } },
        ],
      }).select('_id');

      query.$or = [
        { student: { $in: matchingProfiles.map((p) => p._id) } },
        { job: { $in: matchingJobs.map((j) => j._id) } },
      ];
    }

    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate({
          path: 'job',
          select: 'title workplaceType jobType location status',
          populate: { path: 'company', select: 'name logoUrl industry' },
        })
        .populate({
          path: 'student',
          select: 'rollNumber department degree graduationYear cgpa',
          populate: { path: 'user', select: 'email' },
        })
        .populate('resume', 'title version status isPrimary')
        .sort({ appliedAt: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    sendSuccess(res, applications, 'Applications retrieved successfully', 200, {
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/applications/:id/status
 * Transition an application to a new status with validation, history logging, and audit tracking.
 */
export const updateApplicationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = req.params.id as string;
    if (!id || !Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid application ID format.');
    }

    const { toStatus, notes } = req.body as { toStatus: ApplicationStatus; notes?: string };

    if (!toStatus || !APPLICATION_STATUSES.includes(toStatus)) {
      throw ApiError.badRequest(
        `Invalid application status: '${toStatus}'. Valid statuses are: ${APPLICATION_STATUSES.join(', ')}`
      );
    }

    const application = await Application.findById(id).populate({
      path: 'job',
      populate: { path: 'company' },
    });
    if (!application) throw ApiError.notFound('Application not found.');

    const job = application.job as unknown as { company: ICompany };
    if (req.user.role === 'recruiter') {
      if (!job || !isAuthorizedForCompany(req.user.userId, req.user.role, job.company)) {
        throw ApiError.forbidden(
          'Forbidden: You are not authorized to update applications for this job.'
        );
      }
    }

    const current = application.currentStatus;
    if (current === toStatus) {
      sendSuccess(res, application, 'Application is already at the target status');
      return;
    }

    // Backend authoritative transition check
    const allowed = ALLOWED_FORWARD_TRANSITIONS[current] || [];
    const isOfficerOrAdmin = req.user.role === 'placement_officer' || req.user.role === 'admin';

    if (!allowed.includes(toStatus) && !isOfficerOrAdmin) {
      throw ApiError.badRequest(
        `Invalid status transition from '${current}' to '${toStatus}'. Allowed transitions: ${allowed.join(', ')}`
      );
    }

    const previousStatus = application.currentStatus;
    application.currentStatus = toStatus;
    await application.save();

    const history = await ApplicationStatusHistory.create({
      application: application._id,
      fromStatus: previousStatus,
      toStatus,
      changedBy: req.user._id,
      notes: notes || `Status changed from ${previousStatus} to ${toStatus}`,
      changedAt: new Date(),
    });

    // Audit log
    AuditLog.create({
      user: req.user._id,
      action: 'APPLICATION_STATUS_UPDATED',
      entityType: 'Application',
      entityId: application._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { fromStatus: previousStatus, toStatus, notes },
    }).catch((err) => console.error('[AuditLog] Application status update log failed:', err));

    sendSuccess(res, { application, history }, `Application status transitioned to ${toStatus}`);
  } catch (error) {
    next(error);
  }
};
