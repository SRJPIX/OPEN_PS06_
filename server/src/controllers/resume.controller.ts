import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Resume, IResume } from '../models/Resume';
import { ResumeClaim } from '../models/ResumeClaim';
import { StudentProfile } from '../models/StudentProfile';
import { StudentSkill } from '../models/StudentSkill';
import { Evidence } from '../models/Evidence';
import { Job } from '../models/Job';
import { Project } from '../models/Project';
import { Assessment } from '../models/Assessment';
import { Application } from '../models/Application';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { ApiError } from '../utils/apiError';
import { sendSuccess } from '../utils/apiResponse';
import { buildTruthfulResumeData } from '../utils/truthfulResumeBuilder';
import { generateResumePdf } from '../utils/resumePdfGenerator';
import { auditResumeClaims } from '../utils/resumeClaimAuditor';
import { extractTextFromPdf } from '../utils/pdfExtractor';

/**
 * Helper to check whether the current user is authorized to access a resume.
 */
const authorizeResumeAccess = async (req: Request, resume: IResume): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized('Authentication required.');

  if (req.user.role === 'placement_officer' || req.user.role === 'admin') {
    return; // Full access for institution officers
  }

  if (req.user.role === 'student') {
    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile || !resume.student.equals(profile._id as Types.ObjectId)) {
      throw ApiError.forbidden('You are not authorized to access this resume.');
    }
    return;
  }

  if (req.user.role === 'recruiter') {
    // Recruiter can access resume if student applied to one of their company jobs
    const applications = await Application.find({ resume: resume._id }).populate('job');
    if (!applications || applications.length === 0) {
      throw ApiError.forbidden('Recruiter access denied: No active application found for this candidate resume.');
    }
    const { Company } = await import('../models/Company');
    const userCompany = await Company.findOne({
      $or: [
        { createdBy: new Types.ObjectId(req.user.userId) },
        { authorizedRecruiters: new Types.ObjectId(req.user.userId) },
      ],
    });
    if (!userCompany) {
      throw ApiError.forbidden('Recruiter access denied: No company assigned to this recruiter account.');
    }
    const hasCompanyApp = applications.some((app) => {
      const jobCompany = (app.job as any)?.company;
      return jobCompany && jobCompany.toString() === userCompany._id.toString();
    });
    if (!hasCompanyApp) {
      throw ApiError.forbidden('Recruiter access denied: Candidate has not applied to a job at your company.');
    }
    return;
  }

  throw ApiError.forbidden('Access denied.');
};

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

    const resumes = await Resume.find({ student: profile._id })
      .populate('targetJob', 'title company location')
      .sort({ version: -1, updatedAt: -1 });

    sendSuccess(res, resumes, 'Resumes retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resumes/:id
 * Retrieve a single resume with all associated claims, structured sections, and exclusions.
 */
export const getResumeById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid resume ID format.');
    }

    const resume = await Resume.findById(id).populate({
      path: 'targetJob',
      populate: { path: 'company', select: 'name logoUrl industry' },
    });
    if (!resume) throw ApiError.notFound('Resume not found.');

    await authorizeResumeAccess(req, resume);

    const claims = await ResumeClaim.find({ resume: resume._id })
      .populate('evidence')
      .populate('skills', 'name slug category')
      .sort({ validationStatus: 1, confidenceScore: -1 });

    sendSuccess(res, { resume, claims }, 'Resume details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/resumes/generate
 * Generates a tailored, ATS-friendly resume backed by actual verified evidence.
 * - Monotonically increments version number.
 * - Associates every generated bullet with evidence IDs, skill IDs, and validation status.
 * - Omit unsupported claims and records explicit exclusion reasons.
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

    // Build truthful resume structure and provenance
    const { resumeData, excludedItems } = await buildTruthfulResumeData({
      studentProfileId: profile._id as Types.ObjectId,
      jobId,
      targetRole,
      title,
    });

    // Versioning: Monotonically increment version for this student
    const existingCount = await Resume.countDocuments({ student: profile._id });
    const version = existingCount + 1;

    resumeData.version = version;
    resumeData.isPrimary = existingCount === 0;

    // Create Resume Document
    const resume = await Resume.create(resumeData);

    // Create corresponding ResumeClaim records for bullets and skills
    const createdClaims: any[] = [];

    for (const bullet of resume.bullets || []) {
      const claim = await ResumeClaim.create({
        resume: resume._id,
        student: profile._id,
        claimType: bullet.section === 'skills' ? 'skill' : bullet.section === 'projects' ? 'project' : 'education',
        text: bullet.text,
        extractedText: bullet.text,
        validationStatus: bullet.validationStatus,
        explanation: 'Factual bullet derived from verified student evidence vault.',
        isVerified: bullet.validationStatus === 'SUPPORTED',
        evidence: bullet.evidenceIds,
        skills: bullet.skillIds,
        confidenceScore: bullet.confidenceScore,
        flaggedForOfficerReview: false,
      });
      createdClaims.push(claim);
    }

    // Audit log
    AuditLog.create({
      user: req.user._id,
      action: 'RESUME_GENERATED',
      entityType: 'Resume',
      entityId: resume._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        version,
        targetRole: resume.targetRole,
        jobId,
        supportedBulletsCount: (resume.bullets || []).length,
        omittedClaimsCount: excludedItems.length,
      },
    }).catch((err) => console.error('[AuditLog] Resume generation log failed:', err));

    sendSuccess(
      res,
      {
        resume,
        claims: createdClaims,
        excludedItems,
        targetJob: resumeData.targetJob,
      },
      'Tailored, evidence-backed resume generated successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resumes/:id/provenance
 * Retrieves detailed evidence provenance for every bullet and section of a resume,
 * including linked evidence artifacts, skills, evaluator remarks, and omission reasons.
 */
export const getResumeProvenance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid resume ID format.');

    const resume = await Resume.findById(id);
    if (!resume) throw ApiError.notFound('Resume not found.');

    await authorizeResumeAccess(req, resume);

    // Collect all evidence IDs and Skill IDs across all bullets
    const allEvidenceIds: Types.ObjectId[] = [];
    const allSkillIds: Types.ObjectId[] = [];

    (resume.bullets || []).forEach((b) => {
      if (b.evidenceIds) allEvidenceIds.push(...b.evidenceIds);
      if (b.skillIds) allSkillIds.push(...b.skillIds);
    });

    const [evidenceDocs, skillDocs] = await Promise.all([
      Evidence.find({ _id: { $in: allEvidenceIds } }).populate('skills', 'name slug category'),
      StudentSkill.find({ student: resume.student }).populate('skill', 'name slug category'),
    ]);

    const evidenceMap = new Map<string, any>();
    evidenceDocs.forEach((ev) => evidenceMap.set(ev._id.toString(), ev));

    // Map each bullet to its populated evidence details
    const bulletsProvenance = (resume.bullets || []).map((b) => ({
      bulletId: b.bulletId,
      section: b.section,
      text: b.text,
      validationStatus: b.validationStatus,
      confidenceScore: b.confidenceScore,
      evidence: (b.evidenceIds || []).map((eId) => evidenceMap.get(eId.toString())).filter(Boolean),
      skillIds: b.skillIds,
    }));

    sendSuccess(
      res,
      {
        resumeId: resume._id,
        version: resume.version,
        title: resume.title,
        bulletsProvenance,
        excludedItems: resume.excludedItems || [],
        generationStats: resume.generationStats,
      },
      'Resume bullet provenance retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/resumes/:id/pdf
 * Generates and streams an ATS-friendly, selectable-text PDF document.
 * Requires authenticated access and enforces student/officer/recruiter permissions.
 */
export const downloadResumePdf = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid resume ID format.');

    const resume = await Resume.findById(id);
    if (!resume) throw ApiError.notFound('Resume not found.');

    await authorizeResumeAccess(req, resume);

    // Generate selectable-text PDF
    const pdfBuffer = await generateResumePdf(resume);

    const safeTitle = (resume.title || 'Resume').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeTitle}_v${resume.version}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/resumes/upload-and-analyze
 * Accepts uploaded resume PDF or raw text, extracts factual claims,
 * and cross-references them against actual student evidence in vault.
 * Classifies claims into: SUPPORTED, NEEDS_REVIEW, UNSUPPORTED, CONTRADICTED.
 */
export const uploadAndAnalyzeResume = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    let extractedText = '';
    let fileName = 'Uploaded Resume';
    let fileSize = 0;
    let mimeType = 'text/plain';

    // 1. Check if multipart file uploaded
    if (req.file) {
      fileName = req.file.originalname;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;

      if (req.file.mimetype !== 'application/pdf' && !req.file.originalname.toLowerCase().endsWith('.pdf')) {
        throw ApiError.badRequest('Invalid file type: Only PDF documents are supported.');
      }

      try {
        const pdfData = await extractTextFromPdf(req.file.buffer);
        extractedText = pdfData.text;
      } catch (err: any) {
        throw ApiError.badRequest(err.message || 'Invalid or corrupted PDF document.');
      }
    } else if (req.body?.text) {
      extractedText = String(req.body.text).trim();
      fileName = req.body.title || 'Pasted Resume Text';
      fileSize = Buffer.byteLength(extractedText, 'utf8');
    } else {
      throw ApiError.badRequest('Please upload a PDF file or provide resume text.');
    }

    if (!extractedText || extractedText.length < 20) {
      throw ApiError.badRequest('Could not extract sufficient text from the resume. Please ensure the document is not an image-only scan.');
    }

    // 2. Audit Claims against Student Evidence Vault
    const auditResult = await auditResumeClaims(profile._id as Types.ObjectId, extractedText);

    // 3. Monotonically Version Resume
    const existingCount = await Resume.countDocuments({ student: profile._id });
    const version = existingCount + 1;

    // 4. Create Resume Record preserving original file metadata
    const resume = await Resume.create({
      student: profile._id,
      title: req.body?.title || `${fileName.replace(/\.pdf$/i, '')} (Audit v${version})`,
      version,
      summary: extractedText.substring(0, 300),
      status: 'draft',
      isPrimary: false,
      originalFile: {
        fileName,
        fileSize,
        mimeType,
        rawExtractedText: extractedText,
        uploadedAt: new Date(),
      },
    });

    // 5. Persist Claims into ResumeClaim collection
    const createdClaims: any[] = [];
    for (const c of auditResult.claims) {
      const claim = await ResumeClaim.create({
        resume: resume._id,
        student: profile._id,
        claimType: c.claimType,
        text: c.text,
        extractedText: c.extractedText,
        validationStatus: c.validationStatus,
        explanation: c.explanation,
        isVerified: c.isVerified,
        evidence: c.evidenceIds,
        skills: c.skillIds,
        confidenceScore: c.confidenceScore,
        flaggedForOfficerReview: c.flaggedForOfficerReview,
      });
      createdClaims.push(claim);
    }

    // Audit log
    AuditLog.create({
      user: req.user._id,
      action: 'RESUME_UPLOAD_ANALYZED',
      entityType: 'Resume',
      entityId: resume._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        fileName,
        fileSize,
        totalClaims: auditResult.stats.totalClaims,
        supportedClaims: auditResult.stats.supportedClaims,
        contradictedClaims: auditResult.stats.contradictedClaims,
      },
    }).catch((err) => console.error('[AuditLog] Upload analysis log failed:', err));

    sendSuccess(
      res,
      {
        resume,
        claims: createdClaims,
        stats: auditResult.stats,
        originalFile: resume.originalFile,
      },
      'Resume uploaded and audited against verified evidence',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/resumes/claims/:id
 * Allows a student to correct or clarify an extracted claim.
 */
export const updateResumeClaim = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid claim ID format.');

    const claim = await ResumeClaim.findById(id);
    if (!claim) throw ApiError.notFound('Resume claim not found.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile || !claim.student.equals(profile._id as Types.ObjectId)) {
      throw ApiError.forbidden('You are not authorized to update this claim.');
    }

    const { correctedText, text } = req.body as { correctedText?: string; text?: string };
    if (correctedText) claim.correctedText = correctedText.trim();
    if (text) claim.text = text.trim();

    await claim.save();

    sendSuccess(res, claim, 'Resume claim updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/resumes/claims/:id/link-evidence
 * Allows a student to link an existing verified evidence artifact to substantiate an unsupported claim.
 */
export const linkEvidenceToClaim = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid claim ID format.');

    const { evidenceId } = req.body as { evidenceId: string };
    if (!evidenceId || !Types.ObjectId.isValid(evidenceId)) {
      throw ApiError.badRequest('Valid evidenceId is required.');
    }

    const claim = await ResumeClaim.findById(id);
    if (!claim) throw ApiError.notFound('Resume claim not found.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile || !claim.student.equals(profile._id as Types.ObjectId)) {
      throw ApiError.forbidden('You are not authorized to modify this claim.');
    }

    const evidence = await Evidence.findById(evidenceId);
    if (!evidence || !evidence.student.equals(profile._id as Types.ObjectId)) {
      throw ApiError.badRequest('The specified evidence does not exist in your vault.');
    }

    // Add evidence link if not already present
    const evObjId = new Types.ObjectId(evidenceId);
    if (!claim.evidence.some((e) => e.equals(evObjId))) {
      claim.evidence.push(evObjId);
    }

    if (evidence.status === 'verified') {
      claim.validationStatus = 'SUPPORTED';
      claim.isVerified = true;
      claim.confidenceScore = 90;
      claim.explanation = 'SUPPORTED: Substantiated by verified evidence linked by candidate.';
      claim.flaggedForOfficerReview = false;
    } else {
      claim.validationStatus = 'NEEDS_REVIEW';
      claim.isVerified = false;
      claim.confidenceScore = 60;
      claim.explanation = 'NEEDS_REVIEW: Linked evidence submission is awaiting faculty review.';
    }

    await claim.save();

    sendSuccess(res, claim, 'Evidence successfully linked to resume claim');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/resumes/claims/:id
 * Allows a student to remove an inaccurate or unwanted claim from their audit record.
 */
export const deleteResumeClaim = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid claim ID format.');

    const claim = await ResumeClaim.findById(id);
    if (!claim) throw ApiError.notFound('Resume claim not found.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile || !claim.student.equals(profile._id as Types.ObjectId)) {
      throw ApiError.forbidden('You are not authorized to delete this claim.');
    }

    await claim.deleteOne();

    sendSuccess(res, null, 'Resume claim removed successfully');
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

/**
 * GET /api/resumes/claims
 * Placement officer: list resume claims with filters for unsupported claims, types, search, and validation status.
 */
export const listResumeClaims = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 15;
    const isVerified = req.query.isVerified as string;
    const validationStatus = req.query.validationStatus as string;
    const claimType = req.query.claimType as string;
    const search = req.query.search as string;
    const studentId = req.query.studentId as string;

    const query: Record<string, unknown> = {};

    if (isVerified === 'true') {
      query.isVerified = true;
    } else if (isVerified === 'false') {
      query.isVerified = false;
    }

    if (validationStatus && validationStatus !== 'all') {
      query.validationStatus = validationStatus;
    }

    if (claimType && claimType !== 'all') {
      query.claimType = claimType;
    }

    if (studentId && Types.ObjectId.isValid(studentId)) {
      query.student = new Types.ObjectId(studentId);
    }

    if (search && search.trim()) {
      const trimmed = search.trim();
      const matchingUsers = await User.find({ email: { $regex: trimmed, $options: 'i' } }).select('_id');
      const matchingProfiles = await StudentProfile.find({
        $or: [
          { rollNumber: { $regex: trimmed, $options: 'i' } },
          { user: { $in: matchingUsers.map((u) => u._id) } },
        ],
      }).select('_id');

      query.$or = [
        { text: { $regex: trimmed, $options: 'i' } },
        { student: { $in: matchingProfiles.map((p) => p._id) } },
      ];
    }

    const skip = (page - 1) * limit;

    const [claims, total, totalUnverified, totalVerified] = await Promise.all([
      ResumeClaim.find(query)
        .populate({
          path: 'student',
          select: 'rollNumber department degree graduationYear cgpa',
          populate: { path: 'user', select: 'email' },
        })
        .populate('resume', 'title version status isPrimary')
        .populate({
          path: 'evidence',
          populate: { path: 'skills', select: 'name slug category' },
        })
        .sort({ isVerified: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ResumeClaim.countDocuments(query),
      ResumeClaim.countDocuments({ isVerified: false }),
      ResumeClaim.countDocuments({ isVerified: true }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    sendSuccess(res, claims, 'Resume claims retrieved successfully', 200, {
      page,
      limit,
      total,
      totalPages,
      totalUnverified,
      totalVerified,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/resumes/claims/:id/verify
 * Placement officer: verify or reject/unverify a resume claim, assign confidence score, and link evidence.
 */
export const verifyResumeClaim = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const id = req.params.id as string;
    if (!id || !Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid claim ID format.');
    }

    const { isVerified, confidenceScore, evidenceIds, notes, validationStatus } = req.body as {
      isVerified: boolean;
      confidenceScore?: number;
      evidenceIds?: string[];
      notes?: string;
      validationStatus?: string;
    };

    const claim = await ResumeClaim.findById(id);
    if (!claim) throw ApiError.notFound('Resume claim not found.');

    const previousVerified = claim.isVerified;
    claim.isVerified = isVerified;

    if (validationStatus) {
      claim.validationStatus = validationStatus as any;
    } else {
      claim.validationStatus = isVerified ? 'SUPPORTED' : 'UNSUPPORTED';
    }

    if (confidenceScore !== undefined) {
      claim.confidenceScore = Math.min(100, Math.max(0, confidenceScore));
    } else {
      claim.confidenceScore = isVerified ? 90 : 20;
    }

    if (notes) {
      claim.reviewNotes = notes;
    }

    if (evidenceIds && Array.isArray(evidenceIds)) {
      const validEvIds = evidenceIds
        .filter((eId) => Types.ObjectId.isValid(eId))
        .map((eId) => new Types.ObjectId(eId));
      claim.evidence = validEvIds;
    }

    if (req.user) {
      claim.reviewedBy = new Types.ObjectId(req.user.userId);
    }

    await claim.save();

    await claim.populate([
      {
        path: 'student',
        select: 'rollNumber department graduationYear',
        populate: { path: 'user', select: 'email' },
      },
      { path: 'resume', select: 'title version' },
      {
        path: 'evidence',
        populate: { path: 'skills', select: 'name slug category' },
      },
    ]);

    // Audit Log
    AuditLog.create({
      user: req.user._id,
      action: isVerified ? 'RESUME_CLAIM_VERIFIED' : 'RESUME_CLAIM_UNVERIFIED',
      entityType: 'ResumeClaim',
      entityId: claim._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        text: claim.text,
        previousVerified,
        newVerified: isVerified,
        confidenceScore: claim.confidenceScore,
        validationStatus: claim.validationStatus,
        notes,
      },
    }).catch((err) => console.error('[AuditLog] Resume claim verification log failed:', err));

    sendSuccess(
      res,
      claim,
      isVerified
        ? 'Resume claim successfully verified with evidence backing'
        : 'Resume claim marked unverified'
    );
  } catch (error) {
    next(error);
  }
};
