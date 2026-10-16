import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Evidence } from '../models/Evidence';
import { Job } from '../models/Job';
import { StudentProfile } from '../models/StudentProfile';
import { ResumeClaim } from '../models/ResumeClaim';
import { Application } from '../models/Application';
import { AuditLog } from '../models/AuditLog';
import { StudentSkill } from '../models/StudentSkill';
import { Skill } from '../models/Skill';
import { PlacementSetting } from '../models/PlacementSetting';
import { sendSuccess, sendError } from '../utils/apiResponse';

/**
 * GET /api/officer/dashboard/stats
 * Real database-backed statistics for the Placement Officer dashboard.
 */
export const getOfficerDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [
      pendingEvidenceCount,
      activeJobsCount,
      totalJobsCount,
      totalStudentsCount,
      unverifiedClaimsCount,
      activeApplicationsCount,
      placedStudentsCount,
      recentAuditLogs,
      recentPendingEvidence,
      recentApplications,
    ] = await Promise.all([
      Evidence.countDocuments({
        status: { $in: ['submitted', 'under_review', 'needs_additional_evidence'] },
      }),
      Job.countDocuments({ status: 'open' }),
      Job.countDocuments(),
      StudentProfile.countDocuments(),
      ResumeClaim.countDocuments({ isVerified: false }),
      Application.countDocuments({ currentStatus: { $nin: ['withdrawn', 'rejected'] } }),
      Application.countDocuments({ currentStatus: 'offered' }),
      AuditLog.find()
        .populate('user', 'email role')
        .sort({ timestamp: -1 })
        .limit(8),
      Evidence.find({
        status: { $in: ['submitted', 'under_review', 'needs_additional_evidence'] },
      })
        .populate('skills', 'name slug category')
        .populate({
          path: 'student',
          select: 'rollNumber department degree graduationYear cgpa',
          populate: { path: 'user', select: 'email' },
        })
        .sort({ createdAt: -1 })
        .limit(5),
      Application.find()
        .populate({
          path: 'job',
          select: 'title workplaceType jobType location',
          populate: { path: 'company', select: 'name logoUrl' },
        })
        .populate({
          path: 'student',
          select: 'rollNumber department degree graduationYear',
          populate: { path: 'user', select: 'email' },
        })
        .sort({ appliedAt: -1 })
        .limit(5),
    ]);

    const placementRate =
      totalStudentsCount > 0 ? Math.round((placedStudentsCount / totalStudentsCount) * 100) : 0;

    sendSuccess(
      res,
      {
        metrics: {
          pendingEvidenceCount,
          activeJobsCount,
          totalJobsCount,
          totalStudentsCount,
          unverifiedClaimsCount,
          activeApplicationsCount,
          placedStudentsCount,
          placementRate,
        },
        recentAuditLogs,
        recentPendingEvidence,
        recentApplications,
      },
      'Placement officer dashboard statistics retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/officer/analytics
 * Comprehensive aggregated placement metrics and cohort intelligence.
 */
export const getOfficerAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Funnel breakdown
    const statusCounts = await Application.aggregate([
      { $group: { _id: '$currentStatus', count: { $sum: 1 } } },
    ]);
    const funnelMap: Record<string, number> = {
      applied: 0,
      screening: 0,
      shortlisted: 0,
      assessment: 0,
      interview: 0,
      offered: 0,
      rejected: 0,
      withdrawn: 0,
    };
    statusCounts.forEach((item) => {
      if (item._id && funnelMap[item._id] !== undefined) {
        funnelMap[item._id] = item.count;
      }
    });

    // 2. Department-wise breakdown
    const departmentStats = await StudentProfile.aggregate([
      {
        $group: {
          _id: '$department',
          totalStudents: { $sum: 1 },
          avgCgpa: { $avg: '$cgpa' },
        },
      },
      { $sort: { totalStudents: -1 } },
    ]);

    // 3. Batch / Graduation Year breakdown
    const batchStats = await StudentProfile.aggregate([
      {
        $group: {
          _id: '$graduationYear',
          studentCount: { $sum: 1 },
          avgCgpa: { $avg: '$cgpa' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 4. Most Demanded Skills across active jobs
    const demandedSkillsAgg = await Job.aggregate([
      { $match: { status: 'open' } },
      { $unwind: '$requiredSkills' },
      { $group: { _id: '$requiredSkills', jobCount: { $sum: 1 } } },
      { $sort: { jobCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'skills',
          localField: '_id',
          foreignField: '_id',
          as: 'skillInfo',
        },
      },
      { $unwind: '$skillInfo' },
      {
        $project: {
          _id: 1,
          jobCount: 1,
          name: '$skillInfo.name',
          category: '$skillInfo.category',
        },
      },
    ]);

    // 5. Verified Skills across students
    const verifiedSkillsAgg = await StudentSkill.aggregate([
      { $match: { isVerified: true } },
      { $group: { _id: '$skill', verifiedCount: { $sum: 1 } } },
      { $sort: { verifiedCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'skills',
          localField: '_id',
          foreignField: '_id',
          as: 'skillInfo',
        },
      },
      { $unwind: '$skillInfo' },
      {
        $project: {
          _id: 1,
          verifiedCount: 1,
          name: '$skillInfo.name',
          category: '$skillInfo.category',
        },
      },
    ]);

    sendSuccess(
      res,
      {
        funnel: funnelMap,
        departments: departmentStats.map((d) => ({
          department: d._id || 'Unassigned',
          totalStudents: d.totalStudents,
          avgCgpa: d.avgCgpa ? Math.round(d.avgCgpa * 100) / 100 : 0,
        })),
        batches: batchStats.map((b) => ({
          year: b._id || 2026,
          studentCount: b.studentCount,
          avgCgpa: b.avgCgpa ? Math.round(b.avgCgpa * 100) / 100 : 0,
        })),
        demandedSkills: demandedSkillsAgg,
        verifiedSkills: verifiedSkillsAgg,
      },
      'Placement analytics retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/officer/audit-logs
 * Paginated historical audit events.
 */
export const getOfficerAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const action = req.query.action as string;
    const entityType = req.query.entityType as string;
    const search = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const filter: Record<string, unknown> = {};

    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (search) {
      filter.$or = [
        { action: { $regex: search.trim(), $options: 'i' } },
        { entityType: { $regex: search.trim(), $options: 'i' } },
        { ipAddress: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) (filter.timestamp as Record<string, unknown>).$gte = new Date(startDate);
      if (endDate) (filter.timestamp as Record<string, unknown>).$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('user', 'email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    sendSuccess(res, logs, 'Audit logs retrieved successfully', 200, {
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
 * GET /api/officer/settings
 * Retrieve institutional placement configuration.
 */
export const getPlacementSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let settings = await PlacementSetting.findOne().populate('updatedBy', 'email role');
    if (!settings) {
      settings = await PlacementSetting.create({
        institutionName: 'Apex Institute of Technology - Placement Cell',
        defaultGraduationYear: 2026,
        minCgpaThreshold: 6.0,
      });
    }

    sendSuccess(res, settings, 'Placement settings retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/officer/settings
 * Update institutional placement configuration.
 */
export const updatePlacementSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let settings = await PlacementSetting.findOne();
    if (!settings) {
      settings = new PlacementSetting();
    }

    const {
      institutionName,
      defaultGraduationYear,
      minCgpaThreshold,
      scoringWeights,
      autoArchivePastDeadlines,
      strictDuplicateRejection,
      emailAlertsEnabled,
      evidenceReviewSlaDays,
    } = req.body;

    if (institutionName !== undefined) settings.institutionName = institutionName;
    if (defaultGraduationYear !== undefined) settings.defaultGraduationYear = defaultGraduationYear;
    if (minCgpaThreshold !== undefined) settings.minCgpaThreshold = minCgpaThreshold;
    if (scoringWeights) {
      settings.scoringWeights = {
        ...settings.scoringWeights,
        ...scoringWeights,
      };
    }
    if (autoArchivePastDeadlines !== undefined)
      settings.autoArchivePastDeadlines = autoArchivePastDeadlines;
    if (strictDuplicateRejection !== undefined)
      settings.strictDuplicateRejection = strictDuplicateRejection;
    if (emailAlertsEnabled !== undefined) settings.emailAlertsEnabled = emailAlertsEnabled;
    if (evidenceReviewSlaDays !== undefined) settings.evidenceReviewSlaDays = evidenceReviewSlaDays;

    if (req.user) {
      settings.updatedBy = new Types.ObjectId(req.user.userId);
    }

    await settings.save();

    // Log to AuditLog
    AuditLog.create({
      user: req.user?.userId,
      action: 'PLACEMENT_SETTINGS_UPDATED',
      entityType: 'PlacementSetting',
      entityId: settings._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        institutionName: settings.institutionName,
        defaultGraduationYear: settings.defaultGraduationYear,
        minCgpaThreshold: settings.minCgpaThreshold,
      },
    }).catch((err) => console.error('[AuditLog] Settings update log failed:', err));

    sendSuccess(res, settings, 'Placement settings updated successfully');
  } catch (error) {
    next(error);
  }
};

