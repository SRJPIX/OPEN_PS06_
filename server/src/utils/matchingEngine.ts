import { Types } from 'mongoose';
import { IJob } from '../models/Job';
import { IStudentProfile } from '../models/StudentProfile';
import { IEvidence } from '../models/Evidence';
import { IStudentSkill } from '../models/StudentSkill';
import { ISkill } from '../models/Skill';
import { IUser } from '../models/User';
import { normalizeUrl } from './jobDeduplicator';

export type EligibilityStatus = 'MET' | 'NOT_MET' | 'UNKNOWN';

export interface EligibilityCriterionResult {
  criterion: 'cgpa' | 'graduationYear' | 'department' | 'custom';
  status: EligibilityStatus;
  requiredValue: string | number | string[] | number[];
  actualValue?: string | number | null;
  message: string;
}

export interface EligibilityResult {
  status: EligibilityStatus;
  isEligible: boolean;
  criteria: EligibilityCriterionResult[];
  summary: string;
}

export interface EvidenceDetail {
  id: string;
  type: string;
  title: string;
  url?: string;
  score?: number;
  maxScore?: number;
  proficiencyContribution: number;
}

export interface SkillMatchResult {
  skillId: string;
  skillName: string;
  slug: string;
  isRequired: boolean;
  weight: number;
  evidenceValue: number; // e_i in [0, 1]
  matchType: 'supported' | 'partial' | 'gap';
  isClaimUnsupported: boolean;
  evidenceItems: EvidenceDetail[];
}

export interface ScoringPolicy {
  version: string;
  requiredSkillWeight: number;
  preferredSkillWeight: number;
  minSupportedThreshold: number; // e_i >= 0.70
  minPartialThreshold: number; // 0.20 <= e_i < 0.70
}

export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  version: 'evidra-v1.0',
  requiredSkillWeight: 3,
  preferredSkillWeight: 1,
  minSupportedThreshold: 0.7,
  minPartialThreshold: 0.2,
};

export interface CandidateJobMatch {
  studentProfileId: string;
  userId: string;
  candidateName?: string;
  rollNumber: string;
  department: string;
  graduationYear: number;
  cgpa: number;
  email?: string;
  fitScore: number; // 0 to 100
  scoringFormula: string;
  totalWeight: number;
  weightedScoreSum: number;
  scoringPolicyVersion: string;
  eligibility: EligibilityResult;
  supportedSkills: SkillMatchResult[];
  partialMatches: SkillMatchResult[];
  requiredSkillGaps: SkillMatchResult[];
  preferredSkillGaps: SkillMatchResult[];
  unsupportedClaims: Array<{
    skillId: string;
    skillName: string;
    claimType: string;
    reason: string;
  }>;
  explanation: string;
  evidenceIds: string[];
  evidenceLinks: string[];
  rankedAt: Date;
  disclaimer: string;
}

/**
 * Normalizes branch/department strings for accurate comparison.
 */
export const normalizeDepartment = (dept?: string): string => {
  if (!dept) return '';
  const d = dept
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (d === 'cse' || d.includes('computer science') || d.includes('comp sci')) {
    return 'computer science engineering';
  }
  if (d === 'it' || d.includes('information technology')) {
    return 'information technology';
  }
  if (
    d === 'ece' ||
    d.includes('electronics and communication') ||
    d.includes('electronics communication')
  ) {
    return 'electronics communication engineering';
  }
  if (
    d === 'eee' ||
    d.includes('electrical and electronics') ||
    d.includes('electrical electronics')
  ) {
    return 'electrical electronics engineering';
  }
  if (d === 'mech' || d.includes('mechanical')) {
    return 'mechanical engineering';
  }
  if (d === 'civil') {
    return 'civil engineering';
  }
  return d;
};

/**
 * Evaluates candidate academic and profile eligibility against job requirements.
 * Evaluated strictly independently from skill fit score.
 */
export const evaluateEligibility = (student: IStudentProfile, job: IJob): EligibilityResult => {
  const criteria: EligibilityCriterionResult[] = [];

  // 1. Minimum CGPA evaluation
  if (job.minCgpa && job.minCgpa > 0) {
    if (student.cgpa !== undefined && student.cgpa !== null && !isNaN(student.cgpa)) {
      if (student.cgpa >= job.minCgpa) {
        criteria.push({
          criterion: 'cgpa',
          status: 'MET',
          requiredValue: job.minCgpa,
          actualValue: student.cgpa,
          message: `CGPA ${student.cgpa.toFixed(2)} meets minimum requirement of ${job.minCgpa.toFixed(2)}.`,
        });
      } else {
        criteria.push({
          criterion: 'cgpa',
          status: 'NOT_MET',
          requiredValue: job.minCgpa,
          actualValue: student.cgpa,
          message: `CGPA ${student.cgpa.toFixed(2)} does not meet minimum requirement of ${job.minCgpa.toFixed(2)}.`,
        });
      }
    } else {
      criteria.push({
        criterion: 'cgpa',
        status: 'UNKNOWN',
        requiredValue: job.minCgpa,
        actualValue: null,
        message: 'Student CGPA record is not available.',
      });
    }
  }

  // 2. Graduation Year evaluation
  if (job.eligibleGraduationYears && job.eligibleGraduationYears.length > 0) {
    if (student.graduationYear) {
      if (job.eligibleGraduationYears.includes(student.graduationYear)) {
        criteria.push({
          criterion: 'graduationYear',
          status: 'MET',
          requiredValue: job.eligibleGraduationYears,
          actualValue: student.graduationYear,
          message: `Graduation year ${student.graduationYear} matches eligible batches [${job.eligibleGraduationYears.join(', ')}].`,
        });
      } else {
        criteria.push({
          criterion: 'graduationYear',
          status: 'NOT_MET',
          requiredValue: job.eligibleGraduationYears,
          actualValue: student.graduationYear,
          message: `Graduation year ${student.graduationYear} is not in eligible batches [${job.eligibleGraduationYears.join(', ')}].`,
        });
      }
    } else {
      criteria.push({
        criterion: 'graduationYear',
        status: 'UNKNOWN',
        requiredValue: job.eligibleGraduationYears,
        actualValue: null,
        message: 'Student graduation year is not recorded.',
      });
    }
  }

  // 3. Department / Branch evaluation
  if (job.eligibleDepartments && job.eligibleDepartments.length > 0) {
    if (student.department) {
      const studentNorm = normalizeDepartment(student.department);
      const isDeptMatch = job.eligibleDepartments.some((d) => {
        const targetNorm = normalizeDepartment(d);
        return (
          studentNorm === targetNorm ||
          studentNorm.includes(targetNorm) ||
          targetNorm.includes(studentNorm)
        );
      });

      if (isDeptMatch) {
        criteria.push({
          criterion: 'department',
          status: 'MET',
          requiredValue: job.eligibleDepartments,
          actualValue: student.department,
          message: `Department '${student.department}' matches eligible departments.`,
        });
      } else {
        criteria.push({
          criterion: 'department',
          status: 'NOT_MET',
          requiredValue: job.eligibleDepartments,
          actualValue: student.department,
          message: `Department '${student.department}' is not in eligible departments list.`,
        });
      }
    } else {
      criteria.push({
        criterion: 'department',
        status: 'UNKNOWN',
        requiredValue: job.eligibleDepartments,
        actualValue: null,
        message: 'Student department is not recorded.',
      });
    }
  }

  // Determine overall status
  let overallStatus: EligibilityStatus = 'MET';
  if (criteria.some((c) => c.status === 'NOT_MET')) {
    overallStatus = 'NOT_MET';
  } else if (criteria.some((c) => c.status === 'UNKNOWN')) {
    overallStatus = 'UNKNOWN';
  }

  const summary =
    overallStatus === 'MET'
      ? 'All mandatory eligibility requirements met.'
      : overallStatus === 'NOT_MET'
        ? `Mandatory criteria failed: ${criteria
            .filter((c) => c.status === 'NOT_MET')
            .map((c) => c.message)
            .join(' ')}`
        : 'One or more eligibility criteria could not be verified.';

  return {
    status: overallStatus,
    isEligible: overallStatus === 'MET',
    criteria,
    summary,
  };
};

/**
 * Computes the evidence-supported proficiency contribution p in [0, 1] for an individual evidence item.
 * Strictly adheres to rule: unreviewed evidence or raw repository existence has proficiency 0.
 */
export const calculateEvidenceItemContribution = (evidence: IEvidence): number => {
  // CRITICAL RULE: A repository URL alone or unreviewed evidence is NOT verified proficiency.
  if (!evidence.isVerified || evidence.status !== 'verified') {
    return 0.0;
  }

  // 1. Coding Assessment
  if (evidence.type === 'coding_assessment') {
    if (evidence.score !== undefined && evidence.maxScore && evidence.maxScore > 0) {
      const ratio = evidence.score / evidence.maxScore;
      if (ratio >= 0.85) return 1.0;
      if (ratio >= 0.7) return 0.85;
      if (ratio >= 0.5) return 0.65;
      return Math.max(0.35, ratio);
    }
    return 0.8; // Reviewed assessment passed without numerical score
  }

  // 2. Evaluated Project
  if (evidence.type === 'evaluated_project') {
    if (evidence.score !== undefined && evidence.maxScore && evidence.maxScore > 0) {
      const ratio = evidence.score / evidence.maxScore;
      if (ratio >= 0.8) return 0.9;
      if (ratio >= 0.6) return 0.75;
      return Math.max(0.4, ratio);
    }
    return 0.75; // Evaluated project verified by officer
  }

  // 3. Technical Quiz
  if (evidence.type === 'technical_quiz') {
    if (evidence.score !== undefined && evidence.maxScore && evidence.maxScore > 0) {
      const ratio = evidence.score / evidence.maxScore;
      return Math.min(0.85, Math.max(0.4, ratio));
    }
    return 0.7;
  }

  // 4. Verified Certification
  if (evidence.type === 'verified_certification' || evidence.type === 'certificate') {
    return 0.75;
  }

  // 5. GitHub Repository (Only when evaluated & verified by an officer)
  if (evidence.type === 'github_repo') {
    if (evidence.score !== undefined && evidence.maxScore && evidence.maxScore > 0) {
      const ratio = evidence.score / evidence.maxScore;
      return Math.min(0.85, Math.max(0.4, ratio));
    }
    return 0.65; // Verified repository structure and code reviewed by evaluator
  }

  // 6. Other Reviewed Evidence
  if (evidence.type === 'other_reviewed_evidence') {
    return 0.7;
  }

  return 0.6;
};

/**
 * Aggregates evidence items for a specific skill into match value e_i in [0, 1].
 * Deduplicates duplicate items and prevents double-counting.
 */
export const calculateSkillEvidenceValue = (
  skillId: Types.ObjectId | string,
  evidenceList: IEvidence[],
  studentSkill?: IStudentSkill
): {
  evidenceValue: number;
  evidenceItems: EvidenceDetail[];
  isClaimUnsupported: boolean;
  claimReason?: string;
} => {
  const targetSkillIdStr = skillId.toString();

  // 1. Filter evidence items associated with this skill
  const relevantEvidence = evidenceList.filter((ev) =>
    ev.skills?.some((s) => (s as Types.ObjectId).toString() === targetSkillIdStr)
  );

  // 2. Deduplicate evidence by unique ID and unique URL to prevent double-counting
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const uniqueEvidence: IEvidence[] = [];

  for (const ev of relevantEvidence) {
    const idStr = (ev._id as Types.ObjectId).toString();
    if (seenIds.has(idStr)) continue;
    seenIds.add(idStr);

    if (ev.url) {
      const cleanUrl = normalizeUrl(ev.url);
      if (cleanUrl && seenUrls.has(cleanUrl)) continue;
      if (cleanUrl) seenUrls.add(cleanUrl);
    }

    uniqueEvidence.push(ev);
  }

  // 3. Calculate individual contribution for verified items
  const details: EvidenceDetail[] = [];
  const contributions: number[] = [];

  for (const ev of uniqueEvidence) {
    const contribution = calculateEvidenceItemContribution(ev);
    if (contribution > 0) {
      contributions.push(contribution);
      details.push({
        id: (ev._id as Types.ObjectId).toString(),
        type: ev.type,
        title: ev.title,
        url: ev.url,
        score: ev.score,
        maxScore: ev.maxScore,
        proficiencyContribution: contribution,
      });
    }
  }

  // 4. Multi-evidence aggregation with diminishing returns (capped at 1.0)
  contributions.sort((a, b) => b - a);

  let evidenceValue = 0;
  if (contributions.length > 0) {
    const p1 = contributions[0];
    const p2 = contributions.length > 1 ? contributions[1] : 0;
    const p3 = contributions.length > 2 ? contributions[2] : 0;
    // Highest evidence value + synergy from additional verified evidence
    evidenceValue = Math.min(1.0, p1 + 0.25 * p2 + 0.1 * p3);
    evidenceValue = Math.round(evidenceValue * 100) / 100;
  }

  // 5. Detect unsupported claims
  // Candidate self-reported skill or submitted unverified repos, but evidenceValue is 0
  let isClaimUnsupported = false;
  let claimReason: string | undefined;

  if (evidenceValue === 0) {
    if (studentSkill && studentSkill.status === 'self_reported') {
      isClaimUnsupported = true;
      claimReason = 'Self-reported skill with no verified assessment or evaluated project.';
    } else if (relevantEvidence.some((e) => !e.isVerified || e.status !== 'verified')) {
      isClaimUnsupported = true;
      claimReason = 'Evidence submitted but pending review or unverified by placement evaluator.';
    }
  }

  return {
    evidenceValue,
    evidenceItems: details,
    isClaimUnsupported,
    claimReason,
  };
};

/**
 * Calculates deterministic match analysis between a student profile and a job listing.
 * Implements Fit Score = 100 * sum(w_i * e_i) / sum(w_i).
 */
export const calculateStudentJobMatch = (params: {
  job: IJob;
  student: IStudentProfile;
  skillsMap: Map<string, ISkill>;
  studentSkills: IStudentSkill[];
  evidenceList: IEvidence[];
  policy?: ScoringPolicy;
}): CandidateJobMatch => {
  const {
    job,
    student,
    skillsMap,
    studentSkills,
    evidenceList,
    policy = DEFAULT_SCORING_POLICY,
  } = params;

  // 1. Eligibility evaluation (independent from skill fit score)
  const eligibility = evaluateEligibility(student, job);

  // 2. Identify required and preferred skills
  const requiredSkillIds = (job.requiredSkills || []).map((id) =>
    (id as Types.ObjectId).toString()
  );
  const preferredSkillIds = (job.preferredSkills || []).map((id) =>
    (id as Types.ObjectId).toString()
  );

  // Deduplicate preferred skills that might also be in required
  const filteredPrefSkillIds = preferredSkillIds.filter((id) => !requiredSkillIds.includes(id));

  const supportedSkills: SkillMatchResult[] = [];
  const partialMatches: SkillMatchResult[] = [];
  const requiredSkillGaps: SkillMatchResult[] = [];
  const preferredSkillGaps: SkillMatchResult[] = [];
  const unsupportedClaims: CandidateJobMatch['unsupportedClaims'] = [];

  let totalWeight = 0;
  let weightedScoreSum = 0;
  const allEvidenceIds = new Set<string>();
  const allEvidenceLinks = new Set<string>();

  // Process a skill
  const processSkill = (skillIdStr: string, isRequired: boolean) => {
    const skillDoc = skillsMap.get(skillIdStr);
    const skillName = skillDoc ? skillDoc.name : 'Unknown Skill';
    const slug = skillDoc ? skillDoc.slug : skillIdStr;
    const weight = isRequired ? policy.requiredSkillWeight : policy.preferredSkillWeight;

    const studentSkillRecord = studentSkills.find(
      (s) => (s.skill as Types.ObjectId).toString() === skillIdStr
    );

    const { evidenceValue, evidenceItems, isClaimUnsupported, claimReason } =
      calculateSkillEvidenceValue(skillIdStr, evidenceList, studentSkillRecord);

    totalWeight += weight;
    weightedScoreSum += weight * evidenceValue;

    evidenceItems.forEach((ev) => {
      allEvidenceIds.add(ev.id);
      if (ev.url) allEvidenceLinks.add(ev.url);
    });

    let matchType: 'supported' | 'partial' | 'gap' = 'gap';
    if (evidenceValue >= policy.minSupportedThreshold) {
      matchType = 'supported';
    } else if (evidenceValue >= policy.minPartialThreshold) {
      matchType = 'partial';
    }

    const matchObj: SkillMatchResult = {
      skillId: skillIdStr,
      skillName,
      slug,
      isRequired,
      weight,
      evidenceValue,
      matchType,
      isClaimUnsupported,
      evidenceItems,
    };

    if (matchType === 'supported') {
      supportedSkills.push(matchObj);
    } else if (matchType === 'partial') {
      partialMatches.push(matchObj);
    } else {
      if (isRequired) {
        requiredSkillGaps.push(matchObj);
      } else {
        preferredSkillGaps.push(matchObj);
      }
    }

    if (isClaimUnsupported && claimReason) {
      unsupportedClaims.push({
        skillId: skillIdStr,
        skillName,
        claimType: studentSkillRecord?.status || 'unverified_evidence',
        reason: claimReason,
      });
    }
  };

  // Evaluate required skills
  for (const rId of requiredSkillIds) {
    processSkill(rId, true);
  }

  // Evaluate preferred skills
  for (const pId of filteredPrefSkillIds) {
    processSkill(pId, false);
  }

  // Calculate Fit Score
  let fitScore = 0;
  if (totalWeight > 0) {
    fitScore = Math.round(((100 * weightedScoreSum) / totalWeight) * 10) / 10;
  } else {
    // If job specified zero skills, default score is 100
    fitScore = 100;
  }

  // 3. Generate Plain-Language Explanation
  const explanationLines: string[] = [];
  explanationLines.push(
    `Candidate achieved a ${fitScore.toFixed(1)}/100 skill fit for "${job.title}".`
  );
  explanationLines.push(`Academic Eligibility: ${eligibility.status} (${eligibility.summary}).`);

  if (supportedSkills.length > 0) {
    const skillSummaries = supportedSkills
      .map((s) => `${s.skillName} (value: ${(s.evidenceValue * 100).toFixed(0)}%)`)
      .join(', ');
    explanationLines.push(`Verified Core Skills: ${skillSummaries}.`);
  }

  if (partialMatches.length > 0) {
    const partialSummaries = partialMatches
      .map((s) => `${s.skillName} (${(s.evidenceValue * 100).toFixed(0)}%)`)
      .join(', ');
    explanationLines.push(`Partial Demonstrations: ${partialSummaries}.`);
  }

  if (requiredSkillGaps.length > 0) {
    explanationLines.push(
      `Required Skill Gaps: Missing verified evidence for [${requiredSkillGaps.map((s) => s.skillName).join(', ')}].`
    );
  }

  if (preferredSkillGaps.length > 0) {
    explanationLines.push(
      `Preferred Skill Gaps: Missing [${preferredSkillGaps.map((s) => s.skillName).join(', ')}].`
    );
  }

  if (unsupportedClaims.length > 0) {
    explanationLines.push(
      `Unsupported Claims: ${unsupportedClaims.map((c) => `${c.skillName} (${c.reason})`).join('; ')}.`
    );
  }

  const candidateUser = student.user as unknown as IUser;

  return {
    studentProfileId: (student._id as Types.ObjectId).toString(),
    userId: student.user ? (student.user as Types.ObjectId).toString() : '',
    candidateName: candidateUser?.email ? candidateUser.email.split('@')[0] : undefined,
    rollNumber: student.rollNumber,
    department: student.department,
    graduationYear: student.graduationYear,
    cgpa: student.cgpa,
    email: candidateUser?.email,
    fitScore,
    scoringFormula: '100 * Σ(w_i * e_i) / Σ(w_i)',
    totalWeight,
    weightedScoreSum: Math.round(weightedScoreSum * 100) / 100,
    scoringPolicyVersion: policy.version,
    eligibility,
    supportedSkills,
    partialMatches,
    requiredSkillGaps,
    preferredSkillGaps,
    unsupportedClaims,
    explanation: explanationLines.join(' '),
    evidenceIds: Array.from(allEvidenceIds),
    evidenceLinks: Array.from(allEvidenceLinks),
    rankedAt: new Date(),
    disclaimer:
      'Rankings and fit scores are decision-support indicators based on verified academic and skill evidence. They do not constitute automated hiring guarantees or definitive assessments of candidate potential.',
  };
};

/**
 * Deterministic tie-breaker comparator.
 * 1. Eligibility Status (MET > UNKNOWN > NOT_MET)
 * 2. Fit Score (descending)
 * 3. Count of Supported Skills (descending)
 * 4. Maximum Evidence Contribution (descending)
 * 5. CGPA (descending)
 * 6. Student Profile ID (lexicographical string tie-breaker for strict determinism)
 */
export const compareCandidates = (a: CandidateJobMatch, b: CandidateJobMatch): number => {
  // 1. Eligibility Status
  const statusRank: Record<EligibilityStatus, number> = { MET: 3, UNKNOWN: 2, NOT_MET: 1 };
  const diffStatus = statusRank[b.eligibility.status] - statusRank[a.eligibility.status];
  if (diffStatus !== 0) return diffStatus;

  // 2. Fit Score
  const diffScore = b.fitScore - a.fitScore;
  if (Math.abs(diffScore) > 0.001) return diffScore;

  // 3. Supported Required Skills Count
  const bSupportedReq = b.supportedSkills.filter((s) => s.isRequired).length;
  const aSupportedReq = a.supportedSkills.filter((s) => s.isRequired).length;
  if (bSupportedReq !== aSupportedReq) return bSupportedReq - aSupportedReq;

  // 4. Supported Skills Total Count
  if (b.supportedSkills.length !== a.supportedSkills.length) {
    return b.supportedSkills.length - a.supportedSkills.length;
  }

  // 5. Academic CGPA
  const diffCgpa = (b.cgpa || 0) - (a.cgpa || 0);
  if (Math.abs(diffCgpa) > 0.001) return diffCgpa;

  // 6. Absolute Deterministic Tie-Breaker: Student Profile ID
  return a.studentProfileId.localeCompare(b.studentProfileId);
};

/**
 * Exports ranked candidates to RFC 4180 CSV string.
 */
export const exportRankingsToCsv = (rankings: CandidateJobMatch[]): string => {
  const escapeCell = (str?: string | number | null): string => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headers = [
    'Rank',
    'Roll Number',
    'Email',
    'Department',
    'Graduation Year',
    'CGPA',
    'Eligibility Status',
    'Fit Score',
    'Supported Skills',
    'Partial Matches',
    'Required Gaps',
    'Preferred Gaps',
    'Unsupported Claims',
    'Explanation',
    'Policy Version',
  ];

  const rows = [headers.join(',')];

  rankings.forEach((cand, idx) => {
    const rank = idx + 1;
    const supported = cand.supportedSkills.map((s) => s.skillName).join('; ');
    const partial = cand.partialMatches.map((s) => s.skillName).join('; ');
    const reqGaps = cand.requiredSkillGaps.map((s) => s.skillName).join('; ');
    const prefGaps = cand.preferredSkillGaps.map((s) => s.skillName).join('; ');
    const unsupp = cand.unsupportedClaims.map((c) => c.skillName).join('; ');

    const row = [
      rank,
      escapeCell(cand.rollNumber),
      escapeCell(cand.email || ''),
      escapeCell(cand.department),
      cand.graduationYear,
      cand.cgpa.toFixed(2),
      cand.eligibility.status,
      cand.fitScore.toFixed(1),
      escapeCell(supported),
      escapeCell(partial),
      escapeCell(reqGaps),
      escapeCell(prefGaps),
      escapeCell(unsupp),
      escapeCell(cand.explanation),
      escapeCell(cand.scoringPolicyVersion),
    ];
    rows.push(row.join(','));
  });

  return rows.join('\r\n');
};
