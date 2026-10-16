import { Types } from 'mongoose';
import { ApplicationStatus } from '../models/Application';
import { Application } from '../models/Application';
import { Job, IJob } from '../models/Job';

/**
 * Formal placement application state machine transitions.
 * Terminal states: REJECTED, WITHDRAWN.
 */
export const VALID_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ['UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW: ['OFFER', 'REJECTED', 'UNDER_REVIEW', 'WITHDRAWN'],
  OFFER: ['REJECTED', 'WITHDRAWN'],
  REJECTED: [],
  WITHDRAWN: [],
};

export interface TransitionCheckResult {
  valid: boolean;
  message?: string;
}

/**
 * Validates whether a status transition is permitted given the current status and acting user's role.
 */
export const canTransitionStatus = (
  fromStatus: ApplicationStatus,
  toStatus: ApplicationStatus,
  role: string
): TransitionCheckResult => {
  // Same status transition (e.g. details update) is handled separately in detail endpoints
  if (fromStatus === toStatus) {
    return {
      valid: false,
      message: `Application is already in status '${fromStatus}'.`,
    };
  }

  // 1. Guard Terminal States
  if (fromStatus === 'REJECTED') {
    return {
      valid: false,
      message: 'Cannot transition an application that has already been REJECTED. Terminal states cannot be changed.',
    };
  }

  if (fromStatus === 'WITHDRAWN') {
    return {
      valid: false,
      message: 'Cannot transition an application that has been WITHDRAWN. Terminal states cannot be changed.',
    };
  }

  // 2. Role Restrictions
  if (role === 'student') {
    if (toStatus !== 'WITHDRAWN') {
      return {
        valid: false,
        message: 'Students are strictly forbidden from changing application status to INTERVIEW, OFFER, or any status other than WITHDRAWN.',
      };
    }
  }

  if (role === 'recruiter') {
    if (toStatus === 'WITHDRAWN') {
      return {
        valid: false,
        message: 'Recruiters cannot withdraw applications on behalf of candidates. Withdrawal is candidate-controlled.',
      };
    }
  }

  // 3. Workflow Transition Validity
  const allowed = VALID_STATUS_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    return {
      valid: false,
      message: `Invalid status transition from '${fromStatus}' to '${toStatus}'. Permitted transitions from '${fromStatus}' are: [${allowed.join(', ')}].`,
    };
  }

  return { valid: true };
};

/**
 * Resolves the root canonical job ID for a job (following duplicateOf links).
 */
export const resolveCanonicalJobId = (job: { _id: Types.ObjectId | string; duplicateOf?: Types.ObjectId | string | null }): Types.ObjectId => {
  if (job.duplicateOf) {
    return new Types.ObjectId(job.duplicateOf.toString());
  }
  return new Types.ObjectId(job._id.toString());
};

/**
 * Checks for duplicate applications to the same canonical job across the entire duplicate family.
 */
export const checkDuplicateApplication = async (
  studentProfileId: Types.ObjectId | string,
  targetJob: IJob
): Promise<{ isDuplicate: boolean; existingApplicationId?: Types.ObjectId; message?: string }> => {
  const canonicalId = resolveCanonicalJobId(targetJob);

  // Find all postings in this canonical family (the primary job itself and any duplicates pointing to it)
  const familyJobs = await Job.find({
    $or: [{ _id: canonicalId }, { duplicateOf: canonicalId }],
  }).select('_id');

  const familyJobIds = familyJobs.map((j) => j._id);
  // Also include targetJob._id explicitly
  if (!familyJobIds.some((id) => id.toString() === targetJob._id.toString())) {
    familyJobIds.push(targetJob._id as Types.ObjectId);
  }

  const existingApp = await Application.findOne({
    student: studentProfileId,
    job: { $in: familyJobIds },
  });

  if (existingApp) {
    return {
      isDuplicate: true,
      existingApplicationId: existingApp._id as Types.ObjectId,
      message: 'You have already applied for this position (or a duplicate/canonical listing of this job). Duplicate applications are strictly prevented.',
    };
  }

  return { isDuplicate: false };
};

export interface StudentDashboardMetrics {
  totalApplications: number;
  byStatus: Record<ApplicationStatus, number>;
  activeApplications: number;
  interviewsScheduled: number;
  offersReceived: number;
  interviewRate: number;
  offerRate: number;
}

/**
 * Computes deterministic dashboard statistics for a student from an array of applications.
 */
export const calculateStudentDashboardMetrics = (
  applications: Array<{ currentStatus: ApplicationStatus }>
): StudentDashboardMetrics => {
  const byStatus: Record<ApplicationStatus, number> = {
    APPLIED: 0,
    UNDER_REVIEW: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  };

  for (const app of applications) {
    if (byStatus[app.currentStatus] !== undefined) {
      byStatus[app.currentStatus]++;
    }
  }

  const totalApplications = applications.length;
  const activeApplications =
    byStatus.APPLIED + byStatus.UNDER_REVIEW + byStatus.INTERVIEW + byStatus.OFFER;
  const interviewsScheduled = byStatus.INTERVIEW + byStatus.OFFER;
  const offersReceived = byStatus.OFFER;

  const interviewRate =
    totalApplications > 0
      ? Math.round((interviewsScheduled / totalApplications) * 1000) / 10
      : 0;
  const offerRate =
    totalApplications > 0
      ? Math.round((offersReceived / totalApplications) * 1000) / 10
      : 0;

  return {
    totalApplications,
    byStatus,
    activeApplications,
    interviewsScheduled,
    offersReceived,
    interviewRate,
    offerRate,
  };
};

export interface PlacementDashboardMetrics {
  totalApplications: number;
  byStatus: Record<ApplicationStatus, number>;
  uniqueApplicants: number;
  totalJobsApplied: number;
  placedStudentsCount: number;
  placementRate: number;
  departmentBreakdown: Array<{
    department: string;
    totalApplications: number;
    offers: number;
    inInterview: number;
  }>;
  averageOfferCtc: number;
  highestOfferCtc: number;
}

/**
 * Computes aggregate dashboard statistics for placement officers from actual application records.
 */
export const calculatePlacementDashboardMetrics = (
  applications: Array<{
    student: any;
    job: any;
    currentStatus: ApplicationStatus;
    offerDetails?: { offeredCtc?: number };
  }>
): PlacementDashboardMetrics => {
  const byStatus: Record<ApplicationStatus, number> = {
    APPLIED: 0,
    UNDER_REVIEW: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  };

  const applicantSet = new Set<string>();
  const placedApplicantSet = new Set<string>();
  const jobSet = new Set<string>();
  const deptMap = new Map<
    string,
    { totalApplications: number; offers: number; inInterview: number }
  >();

  const ctcValues: number[] = [];

  for (const app of applications) {
    if (byStatus[app.currentStatus] !== undefined) {
      byStatus[app.currentStatus]++;
    }

    const studentId = app.student?._id ? app.student._id.toString() : app.student?.toString();
    if (studentId) applicantSet.add(studentId);

    const jobId = app.job?._id ? app.job._id.toString() : app.job?.toString();
    if (jobId) jobSet.add(jobId);

    if (app.currentStatus === 'OFFER' && studentId) {
      placedApplicantSet.add(studentId);
    }

    if (app.offerDetails?.offeredCtc && app.offerDetails.offeredCtc > 0) {
      ctcValues.push(app.offerDetails.offeredCtc);
    }

    const department =
      app.student?.department || 'Unspecified Department';
    const deptStats = deptMap.get(department) || {
      totalApplications: 0,
      offers: 0,
      inInterview: 0,
    };
    deptStats.totalApplications++;
    if (app.currentStatus === 'OFFER') deptStats.offers++;
    if (app.currentStatus === 'INTERVIEW') deptStats.inInterview++;
    deptMap.set(department, deptStats);
  }

  const uniqueApplicants = applicantSet.size;
  const placedStudentsCount = placedApplicantSet.size;
  const placementRate =
    uniqueApplicants > 0
      ? Math.round((placedStudentsCount / uniqueApplicants) * 1000) / 10
      : 0;

  const departmentBreakdown = Array.from(deptMap.entries())
    .map(([department, stats]) => ({
      department,
      ...stats,
    }))
    .sort((a, b) => b.totalApplications - a.totalApplications);

  const averageOfferCtc =
    ctcValues.length > 0
      ? Math.round(ctcValues.reduce((sum, v) => sum + v, 0) / ctcValues.length)
      : 0;
  const highestOfferCtc = ctcValues.length > 0 ? Math.max(...ctcValues) : 0;

  return {
    totalApplications: applications.length,
    byStatus,
    uniqueApplicants,
    totalJobsApplied: jobSet.size,
    placedStudentsCount,
    placementRate,
    departmentBreakdown,
    averageOfferCtc,
    highestOfferCtc,
  };
};

