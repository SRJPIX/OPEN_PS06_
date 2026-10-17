export interface CanonicalSkill {
  _id: string;
  name: string;
  slug: string;
  category: 'frontend' | 'backend' | 'database' | 'devops' | 'mobile' | 'ai_ml' | 'systems' | 'security' | 'general';
  aliases?: string[];
}

export interface StudentSkillItem {
  _id: string;
  student: string;
  skill: CanonicalSkill;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  status: 'self_reported' | 'submitted' | 'under_review' | 'verified' | 'rejected' | 'needs_additional_evidence';
  isVerified: boolean;
  confidenceScore: number;
  evidence: Array<{
    _id: string;
    type: string;
    title: string;
    status: string;
    isVerified: boolean;
    score?: number;
    url?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceItem {
  _id: string;
  student: string;
  skills: CanonicalSkill[];
  type:
    | 'coding_assessment'
    | 'technical_quiz'
    | 'evaluated_project'
    | 'github_repo'
    | 'verified_certification'
    | 'other_reviewed_evidence'
    | 'certificate'
    | 'publication'
    | 'portfolio_link'
    | 'document'
    | 'other';
  title: string;
  description?: string;
  url?: string;
  status: 'submitted' | 'under_review' | 'verified' | 'rejected' | 'needs_additional_evidence';
  isVerified: boolean;
  score?: number;
  evaluatorNotes?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  reviewedBy?: { _id: string; email: string; role: string } | string;
  reviewedAt?: string;
  reviewNotes?: string;
  metadata?: Record<string, unknown>;
  auditHistory?: Array<{
    fromStatus?: string;
    toStatus: string;
    reviewedBy: string;
    notes?: string;
    reviewedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentItem {
  _id: string;
  student: string;
  skill?: CanonicalSkill;
  title: string;
  provider: 'internal' | 'hackerrank' | 'leetcode' | 'custom';
  score: number;
  maxScore: number;
  passed: boolean;
  takenAt: string;
  certificateUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectItem {
  _id: string;
  student: string;
  title: string;
  description: string;
  skills: CanonicalSkill[];
  repoUrl?: string;
  liveUrl?: string;
  startDate?: string;
  endDate?: string;
  isOngoing: boolean;
  evidence?: EvidenceItem[];
  createdAt: string;
}

export interface JobCompany {
  _id: string;
  name: string;
  industry?: string;
  website?: string;
  logoUrl?: string;
}

export interface JobItem {
  _id: string;
  company: JobCompany | string;
  title: string;
  description: string;
  responsibilities?: string[];
  requiredSkills: CanonicalSkill[];
  preferredSkills: CanonicalSkill[];
  minCgpa?: number;
  eligibleDepartments?: string[];
  eligibleGraduationYears?: number[];
  location: string;
  workplaceType: 'remote' | 'hybrid' | 'on_site';
  jobType: 'full_time' | 'internship' | 'part_time' | 'contract';
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  deadline?: string;
  status: 'draft' | 'open' | 'closed' | 'archived';
  requisitionId?: string;
  sourceUrl?: string;
  createdAt: string;
}

export interface SkillMatchResult {
  skillId: string;
  skillName: string;
  category: string;
  weight: number;
  matchValue: number;
  isSupported: boolean;
  isPartial: boolean;
  evidenceItems?: Array<{
    id: string;
    type: string;
    title: string;
    url?: string;
    score?: number;
  }>;
}

export interface MatchAnalysis {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  rollNumber: string;
  fitScore: number;
  eligibility: {
    status: 'MET' | 'NOT_MET' | 'UNKNOWN';
    reasons: string[];
    cgpaMet: boolean;
    graduationYearMet: boolean;
    departmentMet: boolean;
  };
  supportedSkills: SkillMatchResult[];
  partialMatches: SkillMatchResult[];
  requiredSkillGaps: Array<{ skillId: string; skillName: string; weight: number }>;
  preferredSkillGaps: Array<{ skillId: string; skillName: string; weight: number }>;
  unsupportedClaims: Array<{ skillName: string }>;
  explanation: string;
  scoringPolicy: {
    version: string;
    requiredSkillWeight: number;
    preferredSkillWeight: number;
  };
}

export type ClaimValidationStatus = 'SUPPORTED' | 'NEEDS_REVIEW' | 'UNSUPPORTED' | 'CONTRADICTED';

export interface ResumeClaimItem {
  _id: string;
  resume: string;
  student: string;
  claimType: 'skill' | 'project' | 'experience' | 'education' | 'achievement';
  text: string;
  extractedText?: string;
  correctedText?: string;
  validationStatus?: ClaimValidationStatus;
  explanation?: string;
  isVerified: boolean;
  evidence: EvidenceItem[];
  skills?: CanonicalSkill[] | string[];
  confidenceScore: number;
  flaggedForOfficerReview?: boolean;
  reviewNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResumeBulletItem {
  bulletId: string;
  section: 'summary' | 'education' | 'skills' | 'projects' | 'experience' | 'certifications';
  text: string;
  validationStatus: ClaimValidationStatus;
  confidenceScore: number;
  evidenceIds: string[];
  skillIds: string[];
}

export interface ResumeExcludedItem {
  type: 'skill' | 'project' | 'certification' | 'metric';
  text: string;
  reason: string;
  relatedSkills?: string[];
}

export interface ResumeItem {
  _id: string;
  student: string;
  title: string;
  version: number;
  summary?: string;
  targetRole?: string;
  targetJob?: JobItem | string;
  validationStatus?: 'VERIFIED_ONLY' | 'PARTIALLY_VERIFIED' | 'SELF_REPORTED' | 'FLAGGED';
  bullets?: ResumeBulletItem[];
  excludedItems?: ResumeExcludedItem[];
  generationStats?: {
    verifiedSkillsIncluded: number;
    unverifiedSkillsOmitted: number;
    projectsIncluded: number;
    projectsOmitted: number;
    totalEvidenceLinked: number;
  };
  originalFile?: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  };
  fileUrl?: string;
  isPrimary: boolean;
  status: 'draft' | 'generated' | 'verified' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ResumeProvenanceResponse {
  resumeId: string;
  version: number;
  title: string;
  bulletsProvenance: Array<{
    bulletId: string;
    section: string;
    text: string;
    validationStatus: ClaimValidationStatus;
    confidenceScore: number;
    evidence: EvidenceItem[];
    skillIds: string[];
  }>;
  excludedItems: ResumeExcludedItem[];
  generationStats?: {
    verifiedSkillsIncluded: number;
    unverifiedSkillsOmitted: number;
    projectsIncluded: number;
    projectsOmitted: number;
    totalEvidenceLinked: number;
  };
}

export interface ApplicationHistoryItem {
  _id: string;
  application: string;
  fromStatus?: string;
  toStatus: string;
  changedBy?: {
    _id: string;
    email: string;
    role: string;
  };
  notes?: string;
  changedAt: string;
}

export interface ApplicationItem {
  _id: string;
  student: string;
  job: JobItem;
  resume: ResumeItem;
  currentStatus:
    | 'applied'
    | 'screening'
    | 'shortlisted'
    | 'assessment'
    | 'interview'
    | 'offered'
    | 'rejected'
    | 'withdrawn'
    | 'APPLIED'
    | 'UNDER_REVIEW'
    | 'INTERVIEW'
    | 'OFFER'
    | 'REJECTED'
    | 'WITHDRAWN';
  appliedAt: string;
  coverLetter?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewPrepQuestion {
  skill?: string;
  question: string;
  tips: string;
  difficulty: string;
}

export interface InterviewPrepData {
  job: {
    id: string;
    title: string;
    company: string;
  };
  matchSummary: {
    fitScore: number;
    eligibilityStatus: string;
    supportedSkillsCount: number;
    gapCount: number;
  };
  strengthQuestions: InterviewPrepQuestion[];
  gapQuestions: InterviewPrepQuestion[];
  scenarioQuestion: {
    title: string;
    scenario: string;
    focusAreas: string[];
  };
  behavioralQuestions: Array<{
    question: string;
    focus: string;
  }>;
}

export interface DashboardStatsData {
  stats: {
    availableJobs: number;
    totalApplications: number;
    interviews: number;
    offers: number;
    shortlisted: number;
    totalSkills: number;
    verifiedSkills: number;
    totalEvidence: number;
    verifiedEvidence: number;
    pendingEvidence: number;
    cgpa: number;
    graduationYear: number;
    department: string;
    degree: string;
    rollNumber: string;
  };
  recentApplications: ApplicationItem[];
  recentEvidence: EvidenceItem[];
}

