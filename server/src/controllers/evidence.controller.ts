import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Evidence, EvidenceStatus } from '../models/Evidence';
import { StudentProfile } from '../models/StudentProfile';
import { StudentSkill } from '../models/StudentSkill';
import { AuditLog } from '../models/AuditLog';
import { ApiError } from '../utils/apiError';
import { sendSuccess } from '../utils/apiResponse';
import { resolveSkillDocument } from '../utils/skillNormalizer';
import { SubmitEvidenceInput, ReviewEvidenceInput } from '../validators/student.validator';

/**
 * Submit a new evidence record supporting one or more skills.
 * A repository URL alone does not verify a skill; it enters the 'submitted' queue.
 */
export const submitEvidence = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const {
      type,
      title,
      description,
      url,
      skills: rawSkills,
      metadata,
    } = req.body as SubmitEvidenceInput;

    // Resolve all input skills to canonical skill records
    const resolvedSkillIds: Types.ObjectId[] = [];
    for (const rawSkill of rawSkills) {
      const skillDoc = await resolveSkillDocument(rawSkill);
      if (skillDoc && !resolvedSkillIds.some((id) => id.equals(skillDoc._id as Types.ObjectId))) {
        resolvedSkillIds.push(skillDoc._id as Types.ObjectId);
      }
    }

    if (resolvedSkillIds.length === 0) {
      throw ApiError.badRequest(
        'None of the specified skills could be resolved to canonical skills in the dictionary.'
      );
    }

    // Create Evidence record - strictly initialized as 'submitted' and unverified
    const evidence = await Evidence.create({
      student: profile._id,
      skills: resolvedSkillIds,
      type,
      title,
      description,
      url,
      status: 'submitted',
      isVerified: false,
      metadata,
      auditHistory: [],
    });

    // Link evidence to StudentSkill records
    for (const skillId of resolvedSkillIds) {
      let studentSkill = await StudentSkill.findOne({
        student: profile._id,
        skill: skillId,
      });

      if (!studentSkill) {
        studentSkill = await StudentSkill.create({
          student: profile._id,
          skill: skillId,
          proficiency: 'intermediate',
          status: 'submitted',
          isVerified: false,
          confidenceScore: 30, // Initial confidence boost on submitting evidence
          evidence: [evidence._id as Types.ObjectId],
        });
      } else {
        if (!studentSkill.evidence.some((id) => id.equals(evidence._id as Types.ObjectId))) {
          studentSkill.evidence.push(evidence._id as Types.ObjectId);
        }
        if (studentSkill.status === 'self_reported') {
          studentSkill.status = 'submitted';
        }
        await studentSkill.save();
      }
    }

    // Audit log
    AuditLog.create({
      user: req.user.userId,
      action: 'EVIDENCE_SUBMIT',
      entityType: 'Evidence',
      entityId: evidence._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { title, type, skillsCount: resolvedSkillIds.length },
    }).catch((err) => console.error('[AuditLog] Evidence submit log failed:', err));

    const populated = await evidence.populate([{ path: 'skills', select: 'name slug category' }]);

    sendSuccess(res, populated, 'Evidence submitted successfully for faculty review', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * List all evidence records submitted by the authenticated student.
 */
export const getMyEvidence = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const { status, type } = req.query;

    const query: Record<string, unknown> = { student: profile._id };
    if (status) query.status = status;
    if (type) query.type = type;

    const evidenceList = await Evidence.find(query)
      .populate('skills', 'name slug category')
      .populate('reviewedBy', 'email role')
      .sort({ createdAt: -1 });

    sendSuccess(res, evidenceList, 'Evidence records retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed view of a single evidence record.
 * Enforces ownership: students can only view their own evidence.
 */
export const getEvidenceById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const { id } = req.params;
    const evidence = await Evidence.findById(id)
      .populate('skills', 'name slug category')
      .populate('reviewedBy', 'email role')
      .populate({
        path: 'student',
        select: 'rollNumber department degree graduationYear',
        populate: { path: 'user', select: 'email' },
      });

    if (!evidence) {
      throw ApiError.notFound('Evidence record not found.');
    }

    // Ownership check: students cannot access other students' evidence
    if (req.user.role === 'student') {
      const profile = await StudentProfile.findOne({ user: req.user.userId });
      if (!profile || !evidence.student._id.equals(profile._id as Types.ObjectId)) {
        throw ApiError.forbidden('You do not have permission to view this evidence record.');
      }
    }

    sendSuccess(res, evidence, 'Evidence details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Placement officer endpoint: list evidence awaiting evaluation.
 */
export const listPendingEvaluations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.query;
    const filterStatus = status || {
      $in: ['submitted', 'under_review', 'needs_additional_evidence'],
    };

    const pending = await Evidence.find({ status: filterStatus })
      .populate('skills', 'name slug category')
      .populate({
        path: 'student',
        select: 'rollNumber department degree graduationYear cgpa',
        populate: { path: 'user', select: 'email' },
      })
      .sort({ createdAt: 1 });

    sendSuccess(res, pending, 'Pending evidence evaluations retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Placement officer endpoint: review, approve, or reject evidence.
 * Prevents students from approving evidence or mutating scores.
 */
export const reviewEvidence = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    // Defense-in-depth: explicitly block students
    if (req.user.role === 'student') {
      throw ApiError.forbidden('Students are not authorized to evaluate evidence.');
    }

    const { id } = req.params;
    const { action, notes, score, confidenceScore } = req.body as ReviewEvidenceInput;

    const evidence = await Evidence.findById(id);
    if (!evidence) {
      throw ApiError.notFound('Evidence record not found.');
    }

    let targetStatus: EvidenceStatus;
    let isVerified = false;

    switch (action) {
      case 'approve':
        targetStatus = 'verified';
        isVerified = true;
        break;
      case 'reject':
        targetStatus = 'rejected';
        isVerified = false;
        break;
      case 'request_evidence':
        targetStatus = 'needs_additional_evidence';
        isVerified = false;
        break;
      case 'under_review':
        targetStatus = 'under_review';
        isVerified = false;
        break;
      default:
        throw ApiError.badRequest('Invalid review action specified.');
    }

    const reviewerId = new Types.ObjectId(req.user.userId);
    const now = new Date();

    // Append to audit trail
    evidence.auditHistory.push({
      fromStatus: evidence.status,
      toStatus: targetStatus,
      reviewedBy: reviewerId,
      notes,
      reviewedAt: now,
    });

    // Update evidence record
    evidence.status = targetStatus;
    evidence.isVerified = isVerified;
    evidence.reviewedBy = reviewerId;
    evidence.reviewedAt = now;
    evidence.reviewNotes = notes;
    if (score !== undefined) evidence.score = score;

    await evidence.save();

    // Update associated StudentSkill records
    for (const skillId of evidence.skills) {
      const studentSkill = await StudentSkill.findOne({
        student: evidence.student,
        skill: skillId,
      });

      if (studentSkill) {
        if (targetStatus === 'verified') {
          studentSkill.status = 'verified';
          studentSkill.isVerified = true;
          studentSkill.verifiedAt = now;
          studentSkill.confidenceScore = confidenceScore !== undefined ? confidenceScore : 85;
        } else if (targetStatus === 'rejected') {
          // If no other verified evidence exists, reflect rejected
          const otherVerified = await Evidence.exists({
            student: evidence.student,
            skills: skillId,
            status: 'verified',
            _id: { $ne: evidence._id },
          });
          if (!otherVerified) {
            studentSkill.status = 'rejected';
            studentSkill.isVerified = false;
          }
        } else if (targetStatus === 'needs_additional_evidence') {
          studentSkill.status = 'needs_additional_evidence';
        } else if (targetStatus === 'under_review') {
          studentSkill.status = 'under_review';
        }
        await studentSkill.save();
      }
    }

    // Audit log
    AuditLog.create({
      user: req.user.userId,
      action: 'EVIDENCE_REVIEW',
      entityType: 'Evidence',
      entityId: evidence._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { action, targetStatus, notes },
    }).catch((err) => console.error('[AuditLog] Review log failed:', err));

    const populated = await evidence.populate([
      { path: 'skills', select: 'name slug category' },
      { path: 'reviewedBy', select: 'email role' },
    ]);

    sendSuccess(res, populated, `Evidence review completed: status updated to '${targetStatus}'`);
  } catch (error) {
    next(error);
  }
};
