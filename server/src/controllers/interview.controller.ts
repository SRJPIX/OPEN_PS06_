import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { InterviewReport } from '../models/InterviewReport';
import { sendSuccess } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

/**
 * GET /api/interviews/experiences
 * List approved interview experience reports.
 * Honors privacy controls: if `isAnonymous: true`, submitter identity is redacted unless officer/admin.
 */
export const getInterviewReports = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { company, role, difficulty, outcome, search, page = 1, limit = 20 } = req.query;

    const filter: Record<string, any> = { moderationStatus: 'approved' };

    if (company && typeof company === 'string') {
      filter.companyName = { $regex: new RegExp(company.trim(), 'i') };
    }

    if (role && typeof role === 'string') {
      filter.role = { $regex: new RegExp(role.trim(), 'i') };
    }

    if (difficulty && typeof difficulty === 'string') {
      filter.difficulty = difficulty.toLowerCase();
    }

    if (outcome && typeof outcome === 'string') {
      filter.outcome = outcome.toLowerCase();
    }

    if (search && typeof search === 'string') {
      const q = search.trim();
      filter.$or = [
        { companyName: { $regex: new RegExp(q, 'i') } },
        { role: { $regex: new RegExp(q, 'i') } },
        { overallExperience: { $regex: new RegExp(q, 'i') } },
        { 'rounds.questions.question': { $regex: new RegExp(q, 'i') } },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [reports, total] = await Promise.all([
      InterviewReport.find(filter)
        .populate('student', 'email role')
        .sort({ driveYear: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      InterviewReport.countDocuments(filter),
    ]);

    const isOfficerOrAdmin = req.user?.role === 'placement_officer' || req.user?.role === 'admin';

    // Apply privacy masking for anonymous reports
    const sanitizedReports = reports.map((rep) => {
      const obj: any = rep.toObject();
      if (obj.isAnonymous && !isOfficerOrAdmin) {
        delete obj.student;
        obj.authorDisplay = 'Anonymous Evidra Student';
      } else if (obj.student) {
        const email = (obj.student as any)?.email;
        obj.authorDisplay = email ? email.split('@')[0] : 'Verified Student';
      }
      return obj;
    });

    sendSuccess(
      res,
      {
        reports: sanitizedReports,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Interview experiences retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/interviews/questions
 * Searchable aggregated question bank company-wise with topic & difficulty filtering.
 */
export const getQuestionBank = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { company, topic, difficulty, search } = req.query;

    const filter: Record<string, any> = { moderationStatus: 'approved' };
    if (company && typeof company === 'string') {
      filter.companyName = { $regex: new RegExp(company.trim(), 'i') };
    }

    const reports = await InterviewReport.find(filter).select('companyName role driveYear rounds');

    let allQuestions: Array<{
      question: string;
      topic: string;
      difficulty: string;
      tips?: string;
      codeSnippet?: string;
      companyName: string;
      role: string;
      roundName: string;
      driveYear: number;
    }> = [];

    reports.forEach((rep) => {
      rep.rounds.forEach((rnd) => {
        rnd.questions.forEach((q) => {
          allQuestions.push({
            question: q.question,
            topic: q.topic,
            difficulty: q.difficulty || 'medium',
            tips: q.tips,
            codeSnippet: q.codeSnippet,
            companyName: rep.companyName,
            role: rep.role,
            roundName: rnd.roundName,
            driveYear: rep.driveYear,
          });
        });
      });
    });

    // Apply question level filters
    if (topic && typeof topic === 'string') {
      const t = topic.trim().toLowerCase();
      allQuestions = allQuestions.filter((q) => q.topic.toLowerCase().includes(t));
    }

    if (difficulty && typeof difficulty === 'string') {
      const d = difficulty.trim().toLowerCase();
      allQuestions = allQuestions.filter((q) => q.difficulty.toLowerCase() === d);
    }

    if (search && typeof search === 'string') {
      const s = search.trim().toLowerCase();
      allQuestions = allQuestions.filter(
        (q) =>
          q.question.toLowerCase().includes(s) ||
          q.topic.toLowerCase().includes(s) ||
          q.companyName.toLowerCase().includes(s)
      );
    }

    sendSuccess(
      res,
      {
        totalQuestions: allQuestions.length,
        questions: allQuestions,
      },
      'Company question bank retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/interviews/experiences
 * Student submits an interview report.
 */
export const submitInterviewReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const {
      companyName,
      role,
      driveYear,
      difficulty,
      outcome,
      rounds,
      overallExperience,
      preparationTips,
      isAnonymous,
    } = req.body;

    if (!companyName || !role || !rounds || !overallExperience) {
      throw ApiError.badRequest('Missing required interview report fields.');
    }

    const report = await InterviewReport.create({
      student: user.userId,
      companyName: String(companyName).trim(),
      role: String(role).trim(),
      driveYear: Number(driveYear || new Date().getFullYear()),
      difficulty: difficulty || 'medium',
      outcome: outcome || 'offered',
      rounds: Array.isArray(rounds) ? rounds : [],
      overallExperience: String(overallExperience).trim(),
      preparationTips: preparationTips ? String(preparationTips).trim() : undefined,
      isAnonymous: Boolean(isAnonymous),
      moderationStatus: 'approved', // Auto-approved or marked approved for immediate student utility
    });

    sendSuccess(res, { report }, 'Interview experience submitted successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/interviews/moderation
 * Placement officer view of reports requiring moderation.
 */
export const listPendingReports = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const reports = await InterviewReport.find({ moderationStatus: 'pending' })
      .populate('student', 'email role')
      .sort({ createdAt: -1 });

    sendSuccess(res, { reports }, 'Pending interview reports retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/interviews/experiences/:id/moderate
 * Placement officer moderation action (approve or reject).
 */
export const moderateReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const id = req.params.id as string;
    const { status, notes } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid report ID format.');
    }

    if (!['approved', 'rejected'].includes(status)) {
      throw ApiError.badRequest("Moderation status must be 'approved' or 'rejected'.");
    }

    const report = await InterviewReport.findById(id);
    if (!report) {
      throw ApiError.notFound('Interview report not found.');
    }

    report.moderationStatus = status;
    report.moderationNotes = notes ? String(notes).trim() : undefined;
    report.moderatedBy = new Types.ObjectId(user.userId);
    report.moderatedAt = new Date();

    await report.save();

    sendSuccess(res, { report }, `Interview report ${status} successfully`);
  } catch (error) {
    next(error);
  }
};
