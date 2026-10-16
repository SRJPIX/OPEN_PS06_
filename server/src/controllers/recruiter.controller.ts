import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Company, ICompany } from '../models/Company';
import { Job, IJob } from '../models/Job';
import { Application, IApplication } from '../models/Application';
import { StudentProfile, IStudentProfile } from '../models/StudentProfile';
import { Evidence } from '../models/Evidence';
import { Skill, ISkill } from '../models/Skill';
import { StudentSkill } from '../models/StudentSkill';
import { calculateStudentJobMatch, DEFAULT_SCORING_POLICY } from '../utils/matchingEngine';
import { isAuthorizedForCompany } from './job.controller';
import { ApiError } from '../utils/apiError';
import { sendSuccess, sendError } from '../utils/apiResponse';

/**
 * Helper to fetch the authorized company for the current recruiter.
 */
export const getRecruiterCompany = async (userId: string): Promise<ICompany | null> => {
  return Company.findOne({
    $or: [
      { createdBy: new Types.ObjectId(userId) },
      { authorizedRecruiters: new Types.ObjectId(userId) },
    ],
  });
};

/**
 * GET /api/recruiter/company
 * Retrieve the company profile for the authenticated recruiter.
 */
export const getMyCompanyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    let company = await getRecruiterCompany(user.userId);

    if (!company) {
      // If recruiter has no company assigned yet, create a default workspace company
      const companyName = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').toUpperCase() + ' CORP';
      company = await Company.create({
        name: companyName,
        industry: 'Technology & Services',
        isVerified: true,
        createdBy: user._id,
        authorizedRecruiters: [user._id],
      });
    }

    sendSuccess(res, { company }, 'Company profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/recruiter/company
 * Update the recruiter's company profile.
 */
export const updateCompanyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const company = await getRecruiterCompany(user.userId);

    if (!company) {
      throw ApiError.notFound('Company not found for this recruiter.');
    }

    const { website, industry, description, logoUrl } = req.body;

    if (website !== undefined) company.website = String(website).trim();
    if (industry !== undefined && String(industry).trim()) company.industry = String(industry).trim();
    if (description !== undefined) company.description = String(description).trim();
    if (logoUrl !== undefined) company.logoUrl = String(logoUrl).trim();

    await company.save();

    sendSuccess(res, { company }, 'Company profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/recruiter/jobs
 * List all job requisitions belonging to the recruiter's company with application stats.
 */
export const getRecruiterJobs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const company = await getRecruiterCompany(user.userId);

    if (!company) {
      sendSuccess(res, { jobs: [], company: null }, 'No company assigned');
      return;
    }

    const jobs = await Job.find({ company: company._id })
      .populate('requiredSkills', 'name slug category')
      .populate('preferredSkills', 'name slug category')
      .sort({ createdAt: -1 });

    const jobIds = jobs.map((j) => j._id);
    const applications = await Application.find({ job: { $in: jobIds } });

    // Aggregate stats per job
    const appStatsByJob = new Map<string, { total: number; byStatus: Record<string, number> }>();
    applications.forEach((app) => {
      const jId = app.job.toString();
      const entry = appStatsByJob.get(jId) || { total: 0, byStatus: {} };
      entry.total += 1;
      entry.byStatus[app.currentStatus] = (entry.byStatus[app.currentStatus] || 0) + 1;
      appStatsByJob.set(jId, entry);
    });

    const enrichedJobs = jobs.map((job) => {
      const jId = job._id.toString();
      const stats = appStatsByJob.get(jId) || { total: 0, byStatus: {} };
      return {
        ...job.toObject(),
        applicationsCount: stats.total,
        applicationsByStatus: stats.byStatus,
      };
    });

    sendSuccess(res, { company, jobs: enrichedJobs }, 'Recruiter jobs retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/recruiter/jobs/:jobId/candidates
 * Ranked shortlist of candidates who applied to a specific requisition.
 * Explains candidate fit scores, skill match breakdown, and eligibility.
 */
export const getRecruiterJobCandidates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const jobId = req.params.jobId as string;

    if (!Types.ObjectId.isValid(jobId)) {
      throw ApiError.badRequest('Invalid job ID format.');
    }

    const job = await Job.findById(jobId).populate('company');
    if (!job) {
      throw ApiError.notFound('Job posting not found.');
    }

    const company = job.company as unknown as ICompany;
    if (!isAuthorizedForCompany(user.userId, user.role, company)) {
      throw ApiError.forbidden('Forbidden: You can only view candidates for your own company requisitions.');
    }

    // Fetch all applications for this job
    const applications = await Application.find({ job: job._id })
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'email role' },
      })
      .populate('resume', 'title version status bullets')
      .sort({ appliedAt: -1 });

    if (applications.length === 0) {
      sendSuccess(res, { job, candidates: [] }, 'No applications found for this job');
      return;
    }

    // Pre-load all required and preferred skills
    const allJobSkillIds = [...(job.requiredSkills || []), ...(job.preferredSkills || [])].map((id) =>
      id.toString()
    );
    const skillDocs = await Skill.find({ _id: { $in: allJobSkillIds } });
    const skillsMap = new Map<string, ISkill>();
    skillDocs.forEach((s) => skillsMap.set(s._id.toString(), s));

    const studentProfileIds = applications.map((a) => (a.student as any)._id);

    const [allStudentSkills, allEvidence] = await Promise.all([
      StudentSkill.find({ student: { $in: studentProfileIds } }),
      Evidence.find({ student: { $in: studentProfileIds } }),
    ]);

    const studentSkillsMap = new Map<string, any[]>();
    allStudentSkills.forEach((ss) => {
      const pId = ss.student.toString();
      const list = studentSkillsMap.get(pId) || [];
      list.push(ss);
      studentSkillsMap.set(pId, list);
    });

    const evidenceMap = new Map<string, any[]>();
    allEvidence.forEach((ev) => {
      const pId = (ev.student as Types.ObjectId).toString();
      const list = evidenceMap.get(pId) || [];
      list.push(ev);
      evidenceMap.set(pId, list);
    });

    // Score and rank each applicant
    const candidates = applications.map((app) => {
      const student = app.student as unknown as IStudentProfile;
      const pIdStr = (student as any)._id.toString();
      const studentSkills = studentSkillsMap.get(pIdStr) || [];
      const studentEv = evidenceMap.get(pIdStr) || [];

      const match = calculateStudentJobMatch({
        job,
        student,
        skillsMap,
        studentSkills,
        evidenceList: studentEv,
        policy: DEFAULT_SCORING_POLICY,
      });

      return {
        applicationId: app._id,
        currentStatus: app.currentStatus,
        appliedAt: app.appliedAt,
        resumeVersion: app.resumeVersion,
        resumeId: app.resume ? (app.resume as any)._id : undefined,
        interviewDetails: app.interviewDetails,
        offerDetails: app.offerDetails,
        student: {
          _id: student._id,
          fullName: (student as any).fullName || (student as any).user?.email?.split('@')[0] || 'Student',
          email: (student as any).user?.email,
          rollNumber: student.rollNumber,
          department: student.department,
          graduationYear: student.graduationYear,
          cgpa: student.cgpa,
        },
        fitScore: match.fitScore,
        eligibility: match.eligibility,
        supportedSkills: match.supportedSkills,
        missingRequiredSkills: match.missingRequiredSkills,
        missingPreferredSkills: match.missingPreferredSkills,
      };
    });

    // Sort ranked candidates by fitScore descending, then CGPA descending
    candidates.sort((a, b) => {
      if (a.eligibility.status === 'MET' && b.eligibility.status !== 'MET') return -1;
      if (b.eligibility.status === 'MET' && a.eligibility.status !== 'MET') return 1;
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
      return (b.student.cgpa || 0) - (a.student.cgpa || 0);
    });

    sendSuccess(res, { job, candidates }, 'Ranked applicant shortlist retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/recruiter/candidates/:studentId/evidence
 * View verified evidence and portfolio deliverables for an applicant.
 * Strictly verifies the student has applied to one of the recruiter's company jobs.
 */
export const getCandidateEvidenceForRecruiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const studentId = req.params.studentId as string;

    if (!Types.ObjectId.isValid(studentId)) {
      throw ApiError.badRequest('Invalid student ID format.');
    }

    const company = await getRecruiterCompany(user.userId);
    if (!company) {
      throw ApiError.forbidden('Forbidden: No company assigned to this recruiter.');
    }

    // Verify student applied to at least one job from this company
    const companyJobs = await Job.find({ company: company._id }).select('_id');
    const companyJobIds = companyJobs.map((j) => j._id);

    const application = await Application.findOne({
      student: new Types.ObjectId(studentId),
      job: { $in: companyJobIds },
    });

    if (!application) {
      throw ApiError.forbidden(
        'Access denied: Candidate has not applied to any active requisition at your company.'
      );
    }

    const evidenceList = await Evidence.find({ student: new Types.ObjectId(studentId) })
      .populate('skills', 'name slug category')
      .sort({ score: -1, createdAt: -1 });

    sendSuccess(
      res,
      { evidence: evidenceList },
      'Candidate verified deliverables retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

