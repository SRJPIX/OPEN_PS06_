import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AlumniProfile } from '../models/AlumniProfile';
import { sendSuccess } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

/**
 * GET /api/alumni
 * List verified alumni profiles with consent-based referral availability.
 */
export const listAlumni = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { company, department, graduationYear, referralOnly, search, page = 1, limit = 20 } = req.query;

    const filter: Record<string, any> = { isVerified: true };

    if (referralOnly === 'true') {
      filter.referralAvailable = true;
    }

    if (company && typeof company === 'string') {
      filter.companyName = { $regex: new RegExp(company.trim(), 'i') };
    }

    if (department && typeof department === 'string') {
      filter.department = { $regex: new RegExp(department.trim(), 'i') };
    }

    if (graduationYear) {
      filter.graduationYear = Number(graduationYear);
    }

    if (search && typeof search === 'string') {
      const q = search.trim();
      filter.$or = [
        { fullName: { $regex: new RegExp(q, 'i') } },
        { companyName: { $regex: new RegExp(q, 'i') } },
        { designation: { $regex: new RegExp(q, 'i') } },
        { preferredSkills: { $in: [new RegExp(q, 'i')] } },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [alumni, total] = await Promise.all([
      AlumniProfile.find(filter)
        .sort({ referralAvailable: -1, graduationYear: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      AlumniProfile.countDocuments(filter),
    ]);

    sendSuccess(
      res,
      {
        alumni,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Alumni directory retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alumni/:id
 * Retrieve individual alumni details.
 */
export const getAlumniById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid alumni ID format.');
    }

    const profile = await AlumniProfile.findById(id);
    if (!profile) {
      throw ApiError.notFound('Alumni profile not found.');
    }

    sendSuccess(res, { alumni: profile }, 'Alumni profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/alumni
 * Create or register an alumni profile.
 */
export const createAlumniProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const {
      fullName,
      email,
      graduationYear,
      degree,
      department,
      companyName,
      designation,
      experienceYears,
      location,
      linkedinUrl,
      referralAvailable,
      maxReferralsPerMonth,
      preferredSkills,
      referralGuidelines,
    } = req.body;

    if (!fullName || !email || !graduationYear || !department || !companyName || !designation) {
      throw ApiError.badRequest('Missing required alumni registration fields.');
    }

    const profile = await AlumniProfile.create({
      user: user.role === 'student' ? user.userId : undefined,
      fullName: String(fullName).trim(),
      email: String(email).trim().toLowerCase(),
      graduationYear: Number(graduationYear),
      degree: String(degree || 'B.Tech').trim(),
      department: String(department).trim(),
      companyName: String(companyName).trim(),
      designation: String(designation).trim(),
      experienceYears: Number(experienceYears || 1),
      location: location ? String(location).trim() : undefined,
      linkedinUrl: linkedinUrl ? String(linkedinUrl).trim() : undefined,
      referralAvailable: referralAvailable !== undefined ? Boolean(referralAvailable) : true,
      maxReferralsPerMonth: Number(maxReferralsPerMonth || 3),
      preferredSkills: Array.isArray(preferredSkills) ? preferredSkills.map((s: any) => String(s).trim()) : [],
      referralGuidelines: referralGuidelines ? String(referralGuidelines).trim() : undefined,
      isVerified: true, // auto-verified for internal directory or can be verified by officer
    });

    sendSuccess(res, { alumni: profile }, 'Alumni profile registered successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/alumni/:id/request-referral
 * Student requests a referral from an alumni member.
 */
export const requestReferral = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid alumni ID format.');
    }

    const alumni = await AlumniProfile.findById(id);
    if (!alumni) {
      throw ApiError.notFound('Alumni profile not found.');
    }

    if (!alumni.referralAvailable) {
      throw ApiError.badRequest('This alumni is currently not accepting new referral requests.');
    }

    if (alumni.activeReferralsCount >= alumni.maxReferralsPerMonth) {
      throw ApiError.badRequest(
        `Alumni has reached their monthly referral limit (${alumni.maxReferralsPerMonth}). Please try again next month.`
      );
    }

    const { targetRole, resumeUrl, note } = req.body;
    if (!targetRole) {
      throw ApiError.badRequest('Target job role or opening is required.');
    }

    alumni.activeReferralsCount += 1;
    await alumni.save();

    sendSuccess(
      res,
      {
        alumniId: alumni._id,
        alumniName: alumni.fullName,
        companyName: alumni.companyName,
        targetRole,
        requestedAt: new Date(),
        status: 'SUBMITTED',
        message: `Your referral request has been forwarded to ${alumni.fullName} at ${alumni.companyName}.`,
      },
      'Referral request submitted successfully'
    );
  } catch (error) {
    next(error);
  }
};
