import { Request, Response, NextFunction } from 'express';
import { StudentProfile } from '../models/StudentProfile';
import { StudentSkill } from '../models/StudentSkill';
import { Evidence } from '../models/Evidence';
import { ApiError } from '../utils/apiError';
import { sendSuccess } from '../utils/apiResponse';
import { resolveSkillDocument } from '../utils/skillNormalizer';
import { UpdateProfileInput, AddSkillInput } from '../validators/student.validator';

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

