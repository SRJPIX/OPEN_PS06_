import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Job, IJob } from '../models/Job';
import { ICompany } from '../models/Company';
import { StudentProfile } from '../models/StudentProfile';
import { StudentSkill, IStudentSkill } from '../models/StudentSkill';
import { Evidence, IEvidence } from '../models/Evidence';
import { Skill, ISkill } from '../models/Skill';
import {
  calculateStudentJobMatch,
  compareCandidates,
  exportRankingsToCsv,
  ScoringPolicy,
  DEFAULT_SCORING_POLICY,
  CandidateJobMatch,
} from '../utils/matchingEngine';
import { rankCandidatesQuerySchema } from '../validators/matching.validator';
import { isAuthorizedForCompany } from './job.controller';
import { sendSuccess, sendError } from '../utils/apiResponse';

/**
 * Helper to compute ranked candidates for a job listing with optional filtering and custom weights.
 */
const computeJobRankings = async (
  jobId: string,
  filters: {
    batch?: number;
    graduationYear?: number;
    department?: string;
    minCgpa?: number;
    eligibility?: string;
    minScore?: number;
    requiredSkillWeight?: number;
    preferredSkillWeight?: number;
  }
): Promise<{
  job: IJob;
  candidates: CandidateJobMatch[];
  scoringPolicy: ScoringPolicy;
}> => {
  const job = await Job.findById(jobId).populate('company');
  if (!job) {
    throw new Error('Job not found');
  }

  // Scoring policy with weight overrides if supplied
  const scoringPolicy: ScoringPolicy = {
    ...DEFAULT_SCORING_POLICY,
    requiredSkillWeight: filters.requiredSkillWeight ?? DEFAULT_SCORING_POLICY.requiredSkillWeight,
    preferredSkillWeight:
      filters.preferredSkillWeight ?? DEFAULT_SCORING_POLICY.preferredSkillWeight,
  };

  // 1. Fetch all skills required/preferred by this job into a Map
  const allJobSkillIds = [...(job.requiredSkills || []), ...(job.preferredSkills || [])].map((id) =>
    (id as Types.ObjectId).toString()
  );

  const skillDocs = await Skill.find({ _id: { $in: allJobSkillIds } });
  const skillsMap = new Map<string, ISkill>();
  skillDocs.forEach((s) => skillsMap.set((s._id as Types.ObjectId).toString(), s));

  // 2. Query Candidate Profiles
  const profileQuery: Record<string, unknown> = {};

  const targetBatch = filters.batch ?? filters.graduationYear;
  if (targetBatch) {
    profileQuery.graduationYear = targetBatch;
  }
  if (filters.department) {
    profileQuery.department = { $regex: filters.department.trim(), $options: 'i' };
  }
  if (filters.minCgpa !== undefined) {
    profileQuery.cgpa = { $gte: filters.minCgpa };
  }

  const studentProfiles = await StudentProfile.find(profileQuery).populate(
    'user',
    'email role status'
  );
  if (studentProfiles.length === 0) {
    return { job, candidates: [], scoringPolicy };
  }

  const profileIds = studentProfiles.map((p) => p._id as Types.ObjectId);

  // 3. Batch fetch all student skills and verified/relevant evidence for these candidates
  const [allStudentSkills, allEvidence] = await Promise.all([
    StudentSkill.find({ student: { $in: profileIds } }),
    Evidence.find({
      student: { $in: profileIds },
      skills: { $in: allJobSkillIds },
    }),
  ]);

  // Group by student profile ID
  const studentSkillsByProfile = new Map<string, IStudentSkill[]>();
  allStudentSkills.forEach((ss) => {
    const pId = (ss.student as Types.ObjectId).toString();
    const arr = studentSkillsByProfile.get(pId) || [];
    arr.push(ss);
    studentSkillsByProfile.set(pId, arr);
  });

  const evidenceByProfile = new Map<string, IEvidence[]>();
  allEvidence.forEach((ev) => {
    const pId = (ev.student as Types.ObjectId).toString();
    const arr = evidenceByProfile.get(pId) || [];
    arr.push(ev);
    evidenceByProfile.set(pId, arr);
  });

  // 4. Calculate matches
  const matchResults: CandidateJobMatch[] = [];

  for (const student of studentProfiles) {
    const pIdStr = (student._id as Types.ObjectId).toString();
    const studentSkills = studentSkillsByProfile.get(pIdStr) || [];
    const studentEv = evidenceByProfile.get(pIdStr) || [];

    const match = calculateStudentJobMatch({
      job,
      student,
      skillsMap,
      studentSkills,
      evidenceList: studentEv,
      policy: scoringPolicy,
    });

    // Apply eligibility filter
    if (filters.eligibility && filters.eligibility !== 'ALL') {
      if (match.eligibility.status !== filters.eligibility) {
        continue;
      }
    }

    // Apply minScore filter
    if (filters.minScore !== undefined) {
      if (match.fitScore < filters.minScore) {
        continue;
      }
    }

    matchResults.push(match);
  }

  // 5. Deterministic tie-breaking sort
  matchResults.sort(compareCandidates);

  return { job, candidates: matchResults, scoringPolicy };
};

/**
 * GET /api/matching/jobs/:jobId/rank
 * Batch ranks candidates for a job listing with explanations, gap analysis, and deterministic tie-breaking.
 */
export const getJobCandidateRankings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobId = req.params.jobId as string;
    const user = req.user!;

    if (!/^[0-9a-fA-F]{24}$/.test(jobId)) {
      sendError(res, 'INVALID_ID', 'Invalid job ID format', 400);
      return;
    }

    const queryValidation = rankCandidatesQuerySchema.safeParse(req.query);
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

    const filters = queryValidation.data;

    // Check permissions
    const jobDoc = await Job.findById(jobId).populate('company');
    if (!jobDoc) {
      sendError(res, 'NOT_FOUND', 'Job not found', 404);
      return;
    }

    const company = jobDoc.company as unknown as ICompany;
    if (!isAuthorizedForCompany(user._id.toString(), user.role, company)) {
      sendError(
        res,
        'FORBIDDEN',
        'Forbidden: You are not authorized to view candidate rankings for this company job',
        403
      );
      return;
    }

    const { job, candidates, scoringPolicy } = await computeJobRankings(jobId, filters);

    // Pagination
    const page = filters.page;
    const limit = filters.limit;
    const total = candidates.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedCandidates = candidates.slice((page - 1) * limit, page * limit);

    sendSuccess(
      res,
      {
        job: {
          id: job._id.toString(),
          title: job.title,
          company: company?.name || 'Unknown',
          status: job.status,
          minCgpa: job.minCgpa,
          eligibleDepartments: job.eligibleDepartments,
          eligibleGraduationYears: job.eligibleGraduationYears,
        },
        scoringPolicy,
        rankings: paginatedCandidates,
      },
      'Candidate rankings computed successfully',
      200,
      { page, limit, total, totalPages }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/matching/jobs/:jobId/export/csv
 * Exports batch candidate rankings for a job to an RFC 4180 CSV file download.
 */
export const exportJobRankingsCsv = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobId = req.params.jobId as string;
    const user = req.user!;

    if (!/^[0-9a-fA-F]{24}$/.test(jobId)) {
      sendError(res, 'INVALID_ID', 'Invalid job ID format', 400);
      return;
    }

    const queryValidation = rankCandidatesQuerySchema.safeParse(req.query);
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

    const filters = queryValidation.data;

    // Check permissions
    const jobDoc = await Job.findById(jobId).populate('company');
    if (!jobDoc) {
      sendError(res, 'NOT_FOUND', 'Job not found', 404);
      return;
    }

    const company = jobDoc.company as unknown as ICompany;
    if (!isAuthorizedForCompany(user._id.toString(), user.role, company)) {
      sendError(
        res,
        'FORBIDDEN',
        'Forbidden: You are not authorized to export candidate rankings for this company job',
        403
      );
      return;
    }

    const { candidates } = await computeJobRankings(jobId, filters);
    const csvContent = exportRankingsToCsv(candidates);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="evidra-rankings-${jobId}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/matching/jobs/:jobId/students/:studentId
 * Inspects detailed match analysis for an individual candidate against a job.
 */
export const getSingleCandidateMatch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobId = req.params.jobId as string;
    const studentId = req.params.studentId as string;
    const user = req.user!;

    if (!/^[0-9a-fA-F]{24}$/.test(jobId) || !/^[0-9a-fA-F]{24}$/.test(studentId)) {
      sendError(res, 'INVALID_ID', 'Invalid ID format', 400);
      return;
    }

    const job = await Job.findById(jobId).populate('company');
    if (!job) {
      sendError(res, 'NOT_FOUND', 'Job not found', 404);
      return;
    }

    const company = job.company as unknown as ICompany;
    if (!isAuthorizedForCompany(user._id.toString(), user.role, company)) {
      sendError(
        res,
        'FORBIDDEN',
        'Forbidden: You are not authorized to view candidates for this company job',
        403
      );
      return;
    }

    const student = await StudentProfile.findById(studentId).populate('user', 'email role status');
    if (!student) {
      sendError(res, 'NOT_FOUND', 'Student profile not found', 404);
      return;
    }

    // Fetch skills
    const allJobSkillIds = [...(job.requiredSkills || []), ...(job.preferredSkills || [])].map(
      (id) => (id as Types.ObjectId).toString()
    );

    const skillDocs = await Skill.find({ _id: { $in: allJobSkillIds } });
    const skillsMap = new Map<string, ISkill>();
    skillDocs.forEach((s) => skillsMap.set((s._id as Types.ObjectId).toString(), s));

    const [studentSkills, evidenceList] = await Promise.all([
      StudentSkill.find({ student: student._id }),
      Evidence.find({ student: student._id, skills: { $in: allJobSkillIds } }),
    ]);

    const match = calculateStudentJobMatch({
      job,
      student,
      skillsMap,
      studentSkills,
      evidenceList,
    });

    sendSuccess(res, { match }, 'Match analysis retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/matching/jobs/:jobId/my-fit
 * Allows an authenticated student to inspect their own fit analysis against a published job listing.
 */
export const getMyJobFit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobId = req.params.jobId as string;
    const user = req.user!;

    if (!/^[0-9a-fA-F]{24}$/.test(jobId)) {
      sendError(res, 'INVALID_ID', 'Invalid job ID format', 400);
      return;
    }

    const job = await Job.findById(jobId).populate('company');
    if (!job) {
      sendError(res, 'NOT_FOUND', 'Job not found', 404);
      return;
    }

    // Students can only view their fit on open/published jobs
    if (job.status !== 'open') {
      sendError(res, 'NOT_FOUND', 'Job not found or not published', 404);
      return;
    }

    const student = await StudentProfile.findOne({ user: user._id }).populate(
      'user',
      'email role status'
    );
    if (!student) {
      sendError(
        res,
        'NOT_FOUND',
        'Student profile not found. Please complete your profile first.',
        404
      );
      return;
    }

    // Fetch skills
    const allJobSkillIds = [...(job.requiredSkills || []), ...(job.preferredSkills || [])].map(
      (id) => (id as Types.ObjectId).toString()
    );

    const skillDocs = await Skill.find({ _id: { $in: allJobSkillIds } });
    const skillsMap = new Map<string, ISkill>();
    skillDocs.forEach((s) => skillsMap.set((s._id as Types.ObjectId).toString(), s));

    const [studentSkills, evidenceList] = await Promise.all([
      StudentSkill.find({ student: student._id }),
      Evidence.find({ student: student._id, skills: { $in: allJobSkillIds } }),
    ]);

    const match = calculateStudentJobMatch({
      job,
      student,
      skillsMap,
      studentSkills,
      evidenceList,
    });

    sendSuccess(res, { match }, 'My job fit analysis retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/matching/jobs/:jobId/interview-prep
 * Generate a personalized, evidence-grounded interview preparation kit tailored to the job and candidate match.
 */
export const getJobInterviewPrep = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobId = req.params.jobId as string;
    const user = req.user!;

    if (!/^[0-9a-fA-F]{24}$/.test(jobId)) {
      sendError(res, 'INVALID_ID', 'Invalid job ID format', 400);
      return;
    }

    const job = await Job.findById(jobId).populate('company');
    if (!job) {
      sendError(res, 'NOT_FOUND', 'Job not found', 404);
      return;
    }

    const student = await StudentProfile.findOne({ user: user._id }).populate(
      'user',
      'email role status'
    );
    if (!student) {
      sendError(res, 'NOT_FOUND', 'Student profile not found.', 404);
      return;
    }

    const allJobSkillIds = [...(job.requiredSkills || []), ...(job.preferredSkills || [])].map((id) =>
      (id as Types.ObjectId).toString()
    );

    const skillDocs = await Skill.find({ _id: { $in: allJobSkillIds } });
    const skillsMap = new Map<string, ISkill>();
    skillDocs.forEach((s) => skillsMap.set((s._id as Types.ObjectId).toString(), s));

    const [studentSkills, evidenceList] = await Promise.all([
      StudentSkill.find({ student: student._id }),
      Evidence.find({ student: student._id, skills: { $in: allJobSkillIds } }),
    ]);

    const match = calculateStudentJobMatch({
      job,
      student,
      skillsMap,
      studentSkills,
      evidenceList,
    });

    const companyName = (job.company as any)?.name || 'Hiring Company';

    const strengthQuestions = match.supportedSkills.map((s) => ({
      skill: s.skillName,
      question: `How have you leveraged ${s.skillName} in your projects or assessments to solve scalability or performance challenges?`,
      tips: `Highlight the verified evidence in your portfolio (${s.evidenceItems?.length ? 'Verified Evidence' : 'Evaluated Project'}). Be ready to walk through your architecture and design decisions.`,
      difficulty: 'Intermediate to Advanced',
    }));

    const gapQuestions = match.requiredSkillGaps.map((s) => ({
      skill: s.skillName,
      question: `What is your understanding of ${s.skillName} and how would you ramp up quickly on it for this ${job.title} role?`,
      tips: `Acknowledge this is a current gap while explaining how your experience in related technologies enables fast onboarding. Review the core concepts before your interview.`,
      difficulty: 'Foundational',
    }));

    const scenarioQuestion = {
      title: `System Architecture Scenario for ${companyName}`,
      scenario: `Design a fault-tolerant service or component for ${job.title} at ${companyName}, taking into account asynchronous processing, data consistency, and failure modes.`,
      focusAreas: ['High availability', 'Database schema design', 'API contract design', 'Error handling strategies'],
    };

    const behavioralQuestions = [
      {
        question: 'Tell me about a technical project where you encountered unexpected bugs or deployment issues. How did you resolve them?',
        focus: 'Problem solving, debugging rigor, and code quality verification.',
      },
      {
        question: `Why are you interested in joining ${companyName} as a ${job.title}?`,
        focus: `Demonstrating understanding of ${companyName}'s domain and aligning with job requirements.`,
      },
    ];

    sendSuccess(
      res,
      {
        job: {
          id: job._id,
          title: job.title,
          company: companyName,
        },
        matchSummary: {
          fitScore: match.fitScore,
          eligibilityStatus: match.eligibility.status,
          supportedSkillsCount: match.supportedSkills.length,
          gapCount: match.requiredSkillGaps.length,
        },
        strengthQuestions,
        gapQuestions,
        scenarioQuestion,
        behavioralQuestions,
      },
      'Interview preparation kit generated successfully'
    );
  } catch (error) {
    next(error);
  }
};

