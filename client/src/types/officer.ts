import type { CanonicalSkill, EvidenceItem, ProjectItem, AssessmentItem } from './student';

export interface OfficerDashboardStats {
  metrics: {
    pendingEvidenceCount: number;
    activeJobsCount: number;
    totalJobsCount: number;
    totalStudentsCount: number;
    unverifiedClaimsCount: number;
    activeApplicationsCount: number;
    placedStudentsCount: number;
    placementRate: number;
  };
  recentAuditLogs: AuditLogItem[];
  recentPendingEvidence: EvidenceItemWithStudent[];
  recentApplications: ApplicationPipelineItem[];
}

export interface AuditLogItem {
  _id: string;
  user?: {
    _id: string;
    email: string;
    role: string;
  };
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface EvidenceItemWithStudent extends Omit<EvidenceItem, 'student'> {
  student: {
    _id: string;
    rollNumber: string;
    department: string;
    degree: string;
    graduationYear: number;
    cgpa?: number;
    user?: {
      _id: string;
      email: string;
    };
  };
}

export interface OfficerAnalyticsData {
  funnel: Record<string, number>;
  departments: Array<{
    department: string;
    totalStudents: number;
    avgCgpa: number;
  }>;
  batches: Array<{
    year: number;
    studentCount: number;
    avgCgpa: number;
  }>;
  demandedSkills: Array<{
    _id: string;
    name: string;
    category: string;
    jobCount: number;
  }>;
  verifiedSkills: Array<{
    _id: string;
    name: string;
    category: string;
    verifiedCount: number;
  }>;
}

export interface StudentDirectoryItem {
  _id: string;
  rollNumber: string;
  department: string;
  degree: string;
  graduationYear: number;
  cgpa: number;
  phone?: string;
  bio?: string;
  user: {
    _id: string;
    email: string;
    role: string;
    status: string;
  };
  skills: Array<{
    _id: string;
    skill: CanonicalSkill;
    proficiency: string;
    status: string;
    isVerified: boolean;
    confidenceScore: number;
  }>;
  totalSkillsCount: number;
  verifiedSkillsCount: number;
  createdAt: string;
}

export interface StudentDetailsData {
  profile: StudentDirectoryItem;
  skills: Array<{
    _id: string;
    skill: CanonicalSkill;
    proficiency: string;
    status: string;
    isVerified: boolean;
    confidenceScore: number;
    evidence: EvidenceItem[];
    verifiedAt?: string;
  }>;
  evidence: EvidenceItem[];
  projects: ProjectItem[];
  assessments: AssessmentItem[];
  applications: Array<{
    _id: string;
    currentStatus: string;
    appliedAt: string;
    job: {
      _id: string;
      title: string;
      workplaceType: string;
      jobType: string;
      location: string;
      status: string;
      company: {
        _id: string;
        name: string;
        logoUrl?: string;
      };
    };
    resume: {
      _id: string;
      title: string;
      version: number;
      status: string;
    };
  }>;
  resumes: Array<{
    _id: string;
    title: string;
    version: number;
    status: string;
    isPrimary: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface PlacementSettingData {
  _id?: string;
  institutionName: string;
  defaultGraduationYear: number;
  minCgpaThreshold: number;
  scoringWeights: {
    requiredSkillWeight: number;
    preferredSkillWeight: number;
    courseworkWeight: number;
    verificationPenalty: number;
  };
  autoArchivePastDeadlines: boolean;
  strictDuplicateRejection: boolean;
  emailAlertsEnabled: boolean;
  evidenceReviewSlaDays: number;
  updatedBy?: {
    email: string;
    role: string;
  };
  updatedAt?: string;
}

export interface ResumeClaimItem {
  _id: string;
  student: {
    _id: string;
    rollNumber: string;
    department: string;
    graduationYear: number;
    cgpa?: number;
    user?: {
      email: string;
    };
  };
  resume: {
    _id: string;
    title: string;
    version: number;
    status: string;
    isPrimary: boolean;
  };
  claimType: 'skill' | 'project' | 'experience' | 'education' | 'achievement';
  text: string;
  isVerified: boolean;
  confidenceScore: number;
  evidence: EvidenceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationPipelineItem {
  _id: string;
  currentStatus:
    | 'applied'
    | 'screening'
    | 'shortlisted'
    | 'assessment'
    | 'interview'
    | 'offered'
    | 'rejected'
    | 'withdrawn';
  appliedAt: string;
  coverLetter?: string;
  job: {
    _id: string;
    title: string;
    workplaceType: string;
    jobType: string;
    location: string;
    status: string;
    company: {
      _id: string;
      name: string;
      logoUrl?: string;
      industry?: string;
    };
  };
  student: {
    _id: string;
    rollNumber: string;
    department: string;
    degree: string;
    graduationYear: number;
    cgpa: number;
    user: {
      _id: string;
      email: string;
    };
  };
  resume?: {
    _id: string;
    title: string;
    version: number;
    status: string;
    isPrimary?: boolean;
  };
}

export interface DuplicateCandidateItem {
  job: {
    _id: string;
    title: string;
    company: {
      _id: string;
      name: string;
      industry?: string;
      logoUrl?: string;
    };
    location: string;
    requisitionId?: string;
    sourceUrl?: string;
    sourceType?: string;
    status: string;
    createdAt: string;
  };
  duplicates: Array<{
    jobId: string;
    title: string;
    location: string;
    requisitionId?: string;
    similarityScore: number;
    reasons: string[];
  }>;
}

export interface BatchRankCandidate {
  candidateId: string;
  rollNumber: string;
  department: string;
  degree: string;
  graduationYear: number;
  cgpa: number;
  fitScore: number;
  rawScore: number;
  eligibility: {
    isEligible: boolean;
    status: 'ELIGIBLE' | 'CGPA_INELIGIBLE' | 'DEPARTMENT_INELIGIBLE' | 'YEAR_INELIGIBLE' | 'INELIGIBLE';
    reasons: string[];
  };
  breakdown: {
    requiredSkillsScore: number;
    preferredSkillsScore: number;
    courseworkScore: number;
    totalPossibleScore: number;
  };
  matchedRequiredSkills: Array<{
    skillId: string;
    skillName: string;
    weight: number;
    matchValue: number;
    isSupported: boolean;
    evidenceItems?: Array<{
      id: string;
      type: string;
      title: string;
      url?: string;
    }>;
  }>;
  matchedPreferredSkills: Array<{
    skillId: string;
    skillName: string;
    weight: number;
    matchValue: number;
    isSupported: boolean;
    evidenceItems?: Array<{
      id: string;
      type: string;
      title: string;
      url?: string;
    }>;
  }>;
  missingRequiredSkills: Array<{
    skillId: string;
    skillName: string;
  }>;
  missingPreferredSkills: Array<{
    skillId: string;
    skillName: string;
  }>;
}
