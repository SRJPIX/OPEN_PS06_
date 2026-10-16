import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Application } from '../models/Application';
import { ApplicationStatusHistory } from '../models/ApplicationStatusHistory';
import { StudentProfile } from '../models/StudentProfile';
import { Job } from '../models/Job';
import { Resume } from '../models/Resume';
import { AuditLog } from '../models/AuditLog';
import { ApiError } from '../utils/apiError';
import { sendSuccess } from '../utils/apiResponse';

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
