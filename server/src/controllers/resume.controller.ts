import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Resume } from '../models/Resume';
import { ResumeClaim } from '../models/ResumeClaim';
import { StudentProfile } from '../models/StudentProfile';
import { StudentSkill } from '../models/StudentSkill';
import { Evidence } from '../models/Evidence';
import { Job } from '../models/Job';
import { Project } from '../models/Project';
import { ApiError } from '../utils/apiError';
import { sendSuccess } from '../utils/apiResponse';
import { CANONICAL_SKILLS } from '../utils/skillNormalizer';

/**
 * GET /api/resumes/me
 * List all resumes for the authenticated student.
 */
export const getMyResumes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const resumes = await Resume.find({ student: profile._id }).sort({ updatedAt: -1 });

    sendSuccess(res, resumes, 'Resumes retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resumes/:id
 * Retrieve a single resume with all associated claims and proof links.
 */
export const getResumeById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid resume ID format.');
    }

    const resume = await Resume.findById(id);
    if (!resume) throw ApiError.notFound('Resume not found.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    // Students can only view their own resume
    if (req.user.role === 'student' && !resume.student.equals(profile._id as Types.ObjectId)) {
      throw ApiError.forbidden('You are not authorized to view this resume.');
    }

    const claims = await ResumeClaim.find({ resume: resume._id })
      .populate('evidence')
      .sort({ claimType: 1, isVerified: -1 });

    sendSuccess(res, { resume, claims }, 'Resume details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/resumes/generate
 * Generate a tailored, evidence-backed resume for a specific job or target role.
 */
export const generateResume = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const { jobId, targetRole, title } = req.body as {
      jobId?: string;
      targetRole?: string;
      title?: string;
    };

    let targetJob = null;
    let effectiveRole = targetRole || 'Software Engineer';

    if (jobId && Types.ObjectId.isValid(jobId)) {
      targetJob = await Job.findById(jobId).populate('company', 'name');
      if (targetJob) {
        effectiveRole = targetJob.title;
      }
    }

    const [studentSkills, projects] = await Promise.all([
      StudentSkill.find({ student: profile._id }).populate('skill', 'name slug category'),
      Project.find({ student: profile._id }).populate('skills', 'name'),
    ]);

    const verifiedSkillsList = studentSkills.filter((s) => s.isVerified);
    const verifiedSkillNames = verifiedSkillsList.map((s: any) => s.skill?.name).filter(Boolean);

    // Create Resume Document
    const resumeCount = await Resume.countDocuments({ student: profile._id });
    const resumeTitle =
      title ||
      (targetJob
        ? `${targetJob.title} - ${(targetJob.company as any)?.name || 'Application'}`
        : `${effectiveRole} Resume v${resumeCount + 1}`);

    const summary = `Results-driven ${profile.degree} student in ${profile.department} (CGPA: ${profile.cgpa}/10). Specializing in ${
      verifiedSkillNames.slice(0, 4).join(', ') || 'Software Development'
    } with demonstrated, faculty-verified evidence and evaluated project deliverables.`;

    const resume = await Resume.create({
      student: profile._id,
      title: resumeTitle,
      version: resumeCount + 1,
      summary,
      targetRole: effectiveRole,
      status: 'generated',
      isPrimary: resumeCount === 0,
    });

    // Generate Factual Resume Claims
    const createdClaims = [];

    // 1. Skill Claims
    for (const s of studentSkills) {
      const skillName = (s.skill as any)?.name || 'Technical Skill';
      const isVerified = s.isVerified;
      const linkedEvidence = s.evidence || [];

      const claim = await ResumeClaim.create({
        resume: resume._id,
        student: profile._id,
        claimType: 'skill',
        text: `Demonstrated proficiency in ${skillName} (${s.proficiency} level)`,
        isVerified,
        evidence: linkedEvidence,
        confidenceScore: isVerified ? 95 : 40,
      });
      createdClaims.push(claim);
    }

    // 2. Project Claims
    for (const p of projects) {
      const hasVerifiedEvidence = p.evidence && p.evidence.length > 0;
      const claim = await ResumeClaim.create({
        resume: resume._id,
        student: profile._id,
        claimType: 'project',
        text: `Engineered ${p.title}: ${p.description.substring(0, 150)}...`,
        isVerified: hasVerifiedEvidence,
        evidence: p.evidence || [],
        confidenceScore: hasVerifiedEvidence ? 90 : 50,
      });
      createdClaims.push(claim);
    }

    // 3. Education Claim
    const educationClaim = await ResumeClaim.create({
      resume: resume._id,
      student: profile._id,
      claimType: 'education',
      text: `${profile.degree} in ${profile.department}, Batch of ${profile.graduationYear} (Cumulative CGPA: ${profile.cgpa})`,
      isVerified: true,
      evidence: [],
      confidenceScore: 100,
    });
    createdClaims.push(educationClaim);

    sendSuccess(
      res,
      { resume, claims: createdClaims, targetJob },
      'Tailored resume generated successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/resumes/analyze-upload
 * Analyzes uploaded resume text/markdown, verifies claims against the student's Evidence records,
 * and flags unverified/unsubstantiated claims.
 */
export const analyzeUploadedResume = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const { text, title } = req.body as { text: string; title?: string };
    if (!text || text.trim().length < 20) {
      throw ApiError.badRequest('Resume text must contain at least 20 characters for analysis.');
    }

    // Fetch student's verified skills & evidence
    const [studentSkills, evidenceList] = await Promise.all([
      StudentSkill.find({ student: profile._id }).populate('skill', 'name slug aliases'),
      Evidence.find({ student: profile._id, status: 'verified' }).populate('skills', 'name slug'),
    ]);

    const verifiedSkillSlugs = new Set<string>();
    const skillEvidenceMap = new Map<string, Types.ObjectId[]>();

    studentSkills.forEach((ss: any) => {
      if (ss.isVerified && ss.skill) {
        verifiedSkillSlugs.add(ss.skill.slug);
        skillEvidenceMap.set(ss.skill.slug, ss.evidence || []);
      }
    });

    evidenceList.forEach((ev: any) => {
      (ev.skills || []).forEach((sk: any) => {
        if (sk?.slug) {
          verifiedSkillSlugs.add(sk.slug);
          const existing = skillEvidenceMap.get(sk.slug) || [];
          skillEvidenceMap.set(sk.slug, [...existing, ev._id]);
        }
      });
    });

    // Create Resume record
    const resume = await Resume.create({
      student: profile._id,
      title: title || `Uploaded Resume Analysis - ${new Date().toLocaleDateString()}`,
      version: 1,
      summary: text.substring(0, 300),
      status: 'draft',
      isPrimary: false,
    });

    // Scan for technology mentions against Canonical Skill Dictionary
    const detectedSkillClaims: Array<{
      name: string;
      slug: string;
      isVerified: boolean;
      evidence: Types.ObjectId[];
    }> = [];

    const lowerText = text.toLowerCase();

    for (const entry of CANONICAL_SKILLS) {
      const slug = entry.slug;
      let matched = false;
      if (lowerText.includes(entry.name.toLowerCase())) {
        matched = true;
      } else {
        for (const alias of entry.aliases || []) {
          // Word boundary regex test for short aliases to avoid substring false positives
          const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const reg = new RegExp(`\\b${escaped}\\b`, 'i');
          if (reg.test(text)) {
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        const isVerified = verifiedSkillSlugs.has(slug);
        const evList = skillEvidenceMap.get(slug) || [];
        detectedSkillClaims.push({
          name: entry.name,
          slug,
          isVerified,
          evidence: evList,
        });
      }
    }

    // Persist claims into ResumeClaim collection
    const savedClaims = [];
    for (const claim of detectedSkillClaims) {
      const claimRecord = await ResumeClaim.create({
        resume: resume._id,
        student: profile._id,
        claimType: 'skill',
        text: `Claimed proficiency: ${claim.name}`,
        isVerified: claim.isVerified,
        evidence: claim.evidence,
        confidenceScore: claim.isVerified ? 95 : 25,
      });
      savedClaims.push(claimRecord);
    }

    const verifiedCount = savedClaims.filter((c) => c.isVerified).length;
    const unverifiedCount = savedClaims.length - verifiedCount;
    const verificationRate =
      savedClaims.length > 0 ? Math.round((verifiedCount / savedClaims.length) * 100) : 0;

    sendSuccess(
      res,
      {
        resume,
        claims: savedClaims,
        stats: {
          totalClaims: savedClaims.length,
          verifiedClaims: verifiedCount,
          unverifiedClaims: unverifiedCount,
          verificationRate,
        },
      },
      'Uploaded resume parsed and analyzed against verified evidence',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/resumes/:id
 * Delete a resume and its associated claims.
 */
export const deleteResume = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid resume ID format.');

    const resume = await Resume.findById(id);
    if (!resume) throw ApiError.notFound('Resume not found.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    if (req.user.role === 'student' && !resume.student.equals(profile._id as Types.ObjectId)) {
      throw ApiError.forbidden('You are not authorized to delete this resume.');
    }

    await ResumeClaim.deleteMany({ resume: resume._id });
    await resume.deleteOne();

    sendSuccess(res, null, 'Resume and associated claims deleted successfully');
  } catch (error) {
    next(error);
  }
};
