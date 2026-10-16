import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { StudentProfile } from '../models/StudentProfile';
import { StudentSkill } from '../models/StudentSkill';
import { Evidence } from '../models/Evidence';
import { Job } from '../models/Job';
import { Application } from '../models/Application';
import { Assessment } from '../models/Assessment';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { Resume } from '../models/Resume';
import { ApiError } from '../utils/apiError';
import { sendSuccess } from '../utils/apiResponse';
import { resolveSkillDocument } from '../utils/skillNormalizer';
import {
  UpdateProfileInput,
  AddSkillInput,
  CreateAssessmentInput,
  CreateProjectInput,
} from '../validators/student.validator';

/**
 * Get current authenticated student's profile, education, and skill summary.
 */
export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId }).populate(
      'user',
      'email role status createdAt'
    );

    if (!profile) {
      throw ApiError.notFound('Student profile not found for the authenticated user.');
    }

    // Fetch student's skills
    const skills = await StudentSkill.find({ student: profile._id })
      .populate('skill', 'name slug category aliases')
      .populate('evidence', 'type title status isVerified score');

    // Fetch evidence metrics
    const totalEvidence = await Evidence.countDocuments({ student: profile._id });
    const verifiedEvidence = await Evidence.countDocuments({
      student: profile._id,
      status: 'verified',
    });

    sendSuccess(
      res,
      {
        profile,
        skills,
        metrics: {
          totalSkills: skills.length,
          verifiedSkills: skills.filter((s) => s.isVerified).length,
          totalEvidence,
          verifiedEvidence,
        },
      },
      'Student profile retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update current authenticated student's own profile.
 */
export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) {
      throw ApiError.notFound('Student profile not found.');
    }

    const updates = req.body as UpdateProfileInput;

    if (updates.department !== undefined) profile.department = updates.department;
    if (updates.degree !== undefined) profile.degree = updates.degree;
    if (updates.graduationYear !== undefined) profile.graduationYear = updates.graduationYear;
    if (updates.cgpa !== undefined) profile.cgpa = updates.cgpa;
    if (updates.phone !== undefined) profile.phone = updates.phone;
    if (updates.bio !== undefined) profile.bio = updates.bio;
    if (updates.education !== undefined) profile.education = updates.education;
    if (updates.links !== undefined) {
      profile.links = {
        ...profile.links,
        ...updates.links,
      };
    }

    await profile.save();

    sendSuccess(res, profile, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Add or update a self-reported skill for the current student.
 * Uses alias normalization to connect to canonical skill.
 * Self-reporting alone does NOT verify the skill.
 */
export const addOrUpdateSkill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const { name, proficiency } = req.body as AddSkillInput;

    const skillDoc = await resolveSkillDocument(name);
    if (!skillDoc) {
      throw ApiError.badRequest(
        `Unable to resolve '${name}' to a canonical skill in the dictionary.`
      );
    }

    let studentSkill = await StudentSkill.findOne({
      student: profile._id,
      skill: skillDoc._id,
    });

    if (studentSkill) {
      studentSkill.proficiency = proficiency;
      // Do not downgrade or change verified status if already verified by faculty
      await studentSkill.save();
    } else {
      studentSkill = await StudentSkill.create({
        student: profile._id,
        skill: skillDoc._id,
        proficiency,
        status: 'self_reported',
        isVerified: false,
        confidenceScore: 10,
        evidence: [],
      });
    }

    const populated = await studentSkill.populate('skill', 'name slug category aliases');

    sendSuccess(res, populated, 'Skill recorded successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/students/dashboard/stats
 * Real database-backed statistics for the student dashboard.
 */
export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const [
      availableJobs,
      totalApplications,
      interviews,
      offers,
      shortlisted,
      totalSkills,
      verifiedSkills,
      totalEvidence,
      verifiedEvidence,
      pendingEvidence,
      recentApplications,
      recentEvidence,
    ] = await Promise.all([
      Job.countDocuments({ status: 'open' }),
      Application.countDocuments({ student: profile._id }),
      Application.countDocuments({ student: profile._id, currentStatus: 'interview' }),
      Application.countDocuments({ student: profile._id, currentStatus: 'offered' }),
      Application.countDocuments({
        student: profile._id,
        currentStatus: { $in: ['shortlisted', 'assessment', 'interview', 'offered'] },
      }),
      StudentSkill.countDocuments({ student: profile._id }),
      StudentSkill.countDocuments({ student: profile._id, isVerified: true }),
      Evidence.countDocuments({ student: profile._id }),
      Evidence.countDocuments({ student: profile._id, status: 'verified' }),
      Evidence.countDocuments({
        student: profile._id,
        status: { $in: ['submitted', 'under_review'] },
      }),
      Application.find({ student: profile._id })
        .sort({ appliedAt: -1 })
        .limit(4)
        .populate({
          path: 'job',
          select: 'title workplaceType jobType location salaryMin salaryMax salaryCurrency',
          populate: { path: 'company', select: 'name logoUrl industry' },
        }),
      Evidence.find({ student: profile._id })
        .sort({ createdAt: -1 })
        .limit(4)
        .populate('skills', 'name slug category'),
    ]);

    sendSuccess(
      res,
      {
        stats: {
          availableJobs,
          totalApplications,
          interviews,
          offers,
          shortlisted,
          totalSkills,
          verifiedSkills,
          totalEvidence,
          verifiedEvidence,
          pendingEvidence,
          cgpa: profile.cgpa,
          graduationYear: profile.graduationYear,
          department: profile.department,
          degree: profile.degree,
          rollNumber: profile.rollNumber,
        },
        recentApplications,
        recentEvidence,
      },
      'Dashboard stats retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/students/assessments
 * List assessments taken by the student.
 */
export const getStudentAssessments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const assessments = await Assessment.find({ student: profile._id })
      .populate('skill', 'name slug category')
      .sort({ takenAt: -1 });

    sendSuccess(res, assessments, 'Assessments retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/students/assessments
 * Record a proctored or verified assessment and auto-generate linked evidence.
 */
export const createStudentAssessment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const { title, provider, skill: skillName, score, maxScore, passed, certificateUrl } =
      req.body as CreateAssessmentInput;

    const skillDoc = await resolveSkillDocument(skillName);
    if (!skillDoc) {
      throw ApiError.badRequest(`Skill '${skillName}' could not be resolved to a canonical skill.`);
    }

    // Create Assessment record
    const assessment = await Assessment.create({
      student: profile._id,
      skill: skillDoc._id,
      title,
      provider,
      score,
      maxScore,
      passed,
      takenAt: new Date(),
      certificateUrl,
    });

    // Auto-create evidence record for the assessment
    const evidence = await Evidence.create({
      student: profile._id,
      skills: [skillDoc._id],
      type: provider === 'internal' ? 'coding_assessment' : 'technical_quiz',
      title: `${title} (${provider.toUpperCase()})`,
      description: `Scored ${score}/${maxScore} (${Math.round((score / maxScore) * 100)}%) on ${title}`,
      url: certificateUrl,
      status: 'submitted',
      isVerified: false,
      score: Math.round((score / maxScore) * 100),
      metadata: {
        assessmentId: assessment._id,
        provider,
        score,
        maxScore,
      },
      auditHistory: [],
    });

    // Link evidence to student skill
    let studentSkill = await StudentSkill.findOne({
      student: profile._id,
      skill: skillDoc._id,
    });

    if (!studentSkill) {
      studentSkill = await StudentSkill.create({
        student: profile._id,
        skill: skillDoc._id,
        proficiency: score / maxScore >= 0.8 ? 'advanced' : 'intermediate',
        status: 'submitted',
        isVerified: false,
        confidenceScore: 40,
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

    await assessment.populate('skill', 'name slug category');

    sendSuccess(res, assessment, 'Assessment recorded successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/students/projects
 * List projects built by the student.
 */
export const getStudentProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const projects = await Project.find({ student: profile._id })
      .populate('skills', 'name slug category')
      .populate('evidence')
      .sort({ createdAt: -1 });

    sendSuccess(res, projects, 'Projects retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/students/projects
 * Record an evaluated project and auto-generate linked evidence.
 */
export const createStudentProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw ApiError.unauthorized('Authentication required.');

    const profile = await StudentProfile.findOne({ user: req.user.userId });
    if (!profile) throw ApiError.notFound('Student profile not found.');

    const {
      title,
      description,
      skills: skillNames,
      repoUrl,
      liveUrl,
      startDate,
      endDate,
      isOngoing,
    } = req.body as CreateProjectInput;

    const resolvedSkillIds: Types.ObjectId[] = [];
    for (const name of skillNames) {
      const doc = await resolveSkillDocument(name);
      if (doc && !resolvedSkillIds.some((id) => id.equals(doc._id as Types.ObjectId))) {
        resolvedSkillIds.push(doc._id as Types.ObjectId);
      }
    }

    if (resolvedSkillIds.length === 0) {
      throw ApiError.badRequest('At least one valid canonical skill is required.');
    }

    // Create Evidence for this project
    const evidence = await Evidence.create({
      student: profile._id,
      skills: resolvedSkillIds,
      type: repoUrl ? 'github_repo' : 'evaluated_project',
      title: `Project: ${title}`,
      description,
      url: repoUrl || liveUrl,
      status: 'submitted',
      isVerified: false,
      metadata: { repoUrl, liveUrl },
      auditHistory: [],
    });

    // Create Project
    const project = await Project.create({
      student: profile._id,
      title,
      description,
      skills: resolvedSkillIds,
      repoUrl,
      liveUrl,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      isOngoing,
      evidence: [evidence._id as Types.ObjectId],
    });

    // Link evidence to each StudentSkill
    for (const sId of resolvedSkillIds) {
      let studentSkill = await StudentSkill.findOne({
        student: profile._id,
        skill: sId,
      });

      if (!studentSkill) {
        studentSkill = await StudentSkill.create({
          student: profile._id,
          skill: sId,
          proficiency: 'intermediate',
          status: 'submitted',
          isVerified: false,
          confidenceScore: 35,
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

    await project.populate('skills', 'name slug category');

    sendSuccess(res, project, 'Project recorded successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/students
 * Placement officer & recruiter student directory listing with server-side filters and pagination.
 */
export const listStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const search = req.query.search as string;
    const department = req.query.department as string;
    const graduationYear = req.query.graduationYear
      ? parseInt(req.query.graduationYear as string, 10)
      : undefined;
    const minCgpa = req.query.minCgpa ? parseFloat(req.query.minCgpa as string) : undefined;
    const sortBy = (req.query.sortBy as string) || 'cgpa';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query: Record<string, unknown> = {};

    if (department) {
      query.department = { $regex: department.trim(), $options: 'i' };
    }
    if (graduationYear) {
      query.graduationYear = graduationYear;
    }
    if (minCgpa !== undefined && !isNaN(minCgpa)) {
      query.cgpa = { $gte: minCgpa };
    }

    if (search && search.trim()) {
      const trimmed = search.trim();
      const matchingUsers = await User.find({
        email: { $regex: trimmed, $options: 'i' },
      }).select('_id');
      const userIds = matchingUsers.map((u) => u._id);

      query.$or = [
        { rollNumber: { $regex: trimmed, $options: 'i' } },
        { department: { $regex: trimmed, $options: 'i' } },
        { user: { $in: userIds } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortObj: Record<string, 1 | -1> = { [sortBy]: sortOrder };

    const [profiles, total] = await Promise.all([
      StudentProfile.find(query)
        .populate('user', 'email role status')
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
      StudentProfile.countDocuments(query),
    ]);

    const profileIds = profiles.map((p) => p._id);
    const allSkills = await StudentSkill.find({ student: { $in: profileIds } }).populate(
      'skill',
      'name slug category'
    );

    const skillsByStudent = new Map<string, typeof allSkills>();
    allSkills.forEach((ss) => {
      const sId = ss.student.toString();
      const arr = skillsByStudent.get(sId) || [];
      arr.push(ss);
      skillsByStudent.set(sId, arr);
    });

    const students = profiles.map((p) => {
      const studentSkills = skillsByStudent.get(p._id.toString()) || [];
      const verifiedCount = studentSkills.filter((s) => s.isVerified).length;
      return {
        ...p.toObject(),
        skills: studentSkills,
        totalSkillsCount: studentSkills.length,
        verifiedSkillsCount: verifiedCount,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    sendSuccess(res, students, 'Students retrieved successfully', 200, {
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
 * GET /api/students/:id
 * Retrieve detailed student information including skills, evidence, projects, assessments, and applications.
 */
export const getStudentDetailsById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!id || !Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid student ID format.');
    }

    let profile = await StudentProfile.findById(id).populate('user', 'email role status');
    if (!profile) {
      profile = await StudentProfile.findOne({ user: id }).populate('user', 'email role status');
    }

    if (!profile) {
      throw ApiError.notFound('Student profile not found.');
    }

    const [skills, evidence, projects, assessments, applications, resumes] = await Promise.all([
      StudentSkill.find({ student: profile._id })
        .populate('skill', 'name slug category aliases')
        .populate('evidence')
        .sort({ isVerified: -1, confidenceScore: -1 }),
      Evidence.find({ student: profile._id })
        .populate('skills', 'name slug category')
        .populate('reviewedBy', 'email role')
        .sort({ createdAt: -1 }),
      Project.find({ student: profile._id })
        .populate('skills', 'name slug category')
        .sort({ createdAt: -1 }),
      Assessment.find({ student: profile._id })
        .populate('skill', 'name slug category')
        .sort({ takenAt: -1 }),
      Application.find({ student: profile._id })
        .populate({
          path: 'job',
          select: 'title workplaceType jobType location status',
          populate: { path: 'company', select: 'name logoUrl' },
        })
        .populate('resume', 'title version status')
        .sort({ appliedAt: -1 }),
      Resume.find({ student: profile._id }).sort({ updatedAt: -1 }),
    ]);

    sendSuccess(
      res,
      {
        profile,
        skills,
        evidence,
        projects,
        assessments,
        applications,
        resumes,
      },
      'Student profile details retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

