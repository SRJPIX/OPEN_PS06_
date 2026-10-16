import { Types } from 'mongoose';
import { StudentProfile, IStudentProfile } from '../models/StudentProfile';
import { StudentSkill } from '../models/StudentSkill';
import { Evidence } from '../models/Evidence';
import { Project } from '../models/Project';
import { Assessment } from '../models/Assessment';
import { CANONICAL_SKILLS } from './skillNormalizer';
import { ClaimValidationStatus, ResumeClaimType } from '../models/ResumeClaim';

export interface ExtractedClaimItem {
  claimType: ResumeClaimType;
  text: string;
  extractedText: string;
  validationStatus: ClaimValidationStatus;
  explanation: string;
  confidenceScore: number;
  isVerified: boolean;
  evidenceIds: Types.ObjectId[];
  skillIds: Types.ObjectId[];
  flaggedForOfficerReview: boolean;
}

export interface AuditResumeClaimsResult {
  claims: ExtractedClaimItem[];
  stats: {
    totalClaims: number;
    supportedClaims: number;
    needsReviewClaims: number;
    unsupportedClaims: number;
    contradictedClaims: number;
    verificationRate: number;
  };
}

/**
 * Audits extracted text from a student's resume against their actual profile,
 * skills, projects, assessments, and evidence artifacts.
 *
 * Classifies every claim as:
 * - SUPPORTED: Confirmed by verified evidence or institutional record
 * - NEEDS_REVIEW: Partially matching or backed by pending review evidence
 * - UNSUPPORTED: No supporting evidence in vault (does not assume false!)
 * - CONTRADICTED: Directly conflicts with authoritative institutional records (e.g. false CGPA)
 */
export const auditResumeClaims = async (
  studentProfileId: Types.ObjectId,
  resumeText: string
): Promise<AuditResumeClaimsResult> => {
  const profile = await StudentProfile.findById(studentProfileId);
  if (!profile) {
    throw new Error('Student profile not found');
  }

  // 1. Fetch Student Vault Records
  const [studentSkills, evidenceList, projects, assessments] = await Promise.all([
    StudentSkill.find({ student: profile._id }).populate('skill', 'name slug aliases category'),
    Evidence.find({ student: profile._id }),
    Project.find({ student: profile._id }).populate('skills', 'name slug'),
    Assessment.find({ student: profile._id }),
  ]);

  const verifiedEvidenceMap = new Map<string, any>();
  const pendingEvidenceMap = new Map<string, any>();

  evidenceList.forEach((ev) => {
    if (ev.status === 'verified') {
      verifiedEvidenceMap.set(ev._id.toString(), ev);
    } else {
      pendingEvidenceMap.set(ev._id.toString(), ev);
    }
  });

  const verifiedSkillMap = new Map<string, { skillDoc: any; evidenceIds: Types.ObjectId[] }>();
  const unverifiedSkillMap = new Map<string, { skillDoc: any; evidenceIds: Types.ObjectId[] }>();

  studentSkills.forEach((ss: any) => {
    if (ss.skill) {
      const validEvIds = (ss.evidence || []).filter((eId: any) =>
        verifiedEvidenceMap.has(eId.toString())
      );
      if (ss.isVerified && validEvIds.length > 0) {
        verifiedSkillMap.set(ss.skill.slug, { skillDoc: ss.skill, evidenceIds: validEvIds });
      } else {
        unverifiedSkillMap.set(ss.skill.slug, { skillDoc: ss.skill, evidenceIds: ss.evidence || [] });
      }
    }
  });

  const claims: ExtractedClaimItem[] = [];

  // ==========================================
  // 1. PROFILE & ACADEMIC AUDIT (CGPA, Degree)
  // ==========================================
  // CGPA Claim Regex: matches e.g. "CGPA: 8.5/10", "GPA 9.2", "9.9 CGPA", "8.75 out of 10"
  const cgpaMatches = Array.from(
    resumeText.matchAll(/(?:\b(?:cgpa|gpa|grade point)\s*[:=-]?\s*(\d+(?:\.\d+)?)(?:\s*\/\s*10)?|\b(\d+(?:\.\d+)?)\s*(?:cgpa|gpa|grade point)\b|\b(\d+\.\d{1,2})\s*(?:\/|\s+out of\s+)10\b)/gi)
  );

  if (cgpaMatches.length > 0) {
    const rawVal = cgpaMatches[0][1] || cgpaMatches[0][2] || cgpaMatches[0][3];
    const claimedCgpa = parseFloat(rawVal);

    if (!isNaN(claimedCgpa)) {
      const diff = claimedCgpa - profile.cgpa;
      if (diff > 0.05) {
        // Resume claims higher CGPA than official institutional record!
        claims.push({
          claimType: 'education',
          text: `Academic Performance: Claimed CGPA ${claimedCgpa.toFixed(2)}/10`,
          extractedText: cgpaMatches[0][0],
          validationStatus: 'CONTRADICTED',
          explanation: `CONTRADICTION: Resume claims CGPA ${claimedCgpa.toFixed(2)}, which conflicts with official institutional profile recording ${profile.cgpa.toFixed(2)}.`,
          confidenceScore: 0,
          isVerified: false,
          evidenceIds: [],
          skillIds: [],
          flaggedForOfficerReview: true,
        });
      } else {
        claims.push({
          claimType: 'education',
          text: `Academic Performance: Verified CGPA ${profile.cgpa.toFixed(2)}/10`,
          extractedText: cgpaMatches[0][0],
          validationStatus: 'SUPPORTED',
          explanation: `SUPPORTED: Claimed CGPA matches official academic registry record (${profile.cgpa.toFixed(2)}).`,
          confidenceScore: 100,
          isVerified: true,
          evidenceIds: [],
          skillIds: [],
          flaggedForOfficerReview: false,
        });
      }
    }
  }

  // Degree & Department check
  const lowerText = resumeText.toLowerCase();
  if (lowerText.includes(profile.degree.toLowerCase()) || lowerText.includes(profile.department.toLowerCase())) {
    claims.push({
      claimType: 'education',
      text: `${profile.degree} in ${profile.department}`,
      extractedText: `${profile.degree} - ${profile.department}`,
      validationStatus: 'SUPPORTED',
      explanation: 'SUPPORTED: Matches registered academic program and department.',
      confidenceScore: 100,
      isVerified: true,
      evidenceIds: [],
      skillIds: [],
      flaggedForOfficerReview: false,
    });
  }

  // ==========================================
  // 2. SKILL CLAIMS AUDIT
  // ==========================================
  for (const entry of CANONICAL_SKILLS) {
    const slug = entry.slug;
    let matched = false;
    let matchedSnippet = '';

    // Test name
    const nameRegex = new RegExp(`\\b${entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const nameMatch = resumeText.match(nameRegex);
    if (nameMatch) {
      matched = true;
      matchedSnippet = nameMatch[0];
    } else if (entry.aliases) {
      for (const alias of entry.aliases) {
        const aliasRegex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        const aliasMatch = resumeText.match(aliasRegex);
        if (aliasMatch) {
          matched = true;
          matchedSnippet = aliasMatch[0];
          break;
        }
      }
    }

    if (matched) {
      if (verifiedSkillMap.has(slug)) {
        const item = verifiedSkillMap.get(slug)!;
        claims.push({
          claimType: 'skill',
          text: `Technical Competence: ${entry.name}`,
          extractedText: matchedSnippet,
          validationStatus: 'SUPPORTED',
          explanation: `SUPPORTED: Confirmed by ${item.evidenceIds.length} verified evidence artifact(s) in student portfolio.`,
          confidenceScore: 95,
          isVerified: true,
          evidenceIds: item.evidenceIds,
          skillIds: [item.skillDoc._id],
          flaggedForOfficerReview: false,
        });
      } else if (unverifiedSkillMap.has(slug)) {
        const item = unverifiedSkillMap.get(slug)!;
        const hasPendingEvidence = item.evidenceIds.some((id) => pendingEvidenceMap.has(id.toString()));

        claims.push({
          claimType: 'skill',
          text: `Technical Competence: ${entry.name}`,
          extractedText: matchedSnippet,
          validationStatus: hasPendingEvidence ? 'NEEDS_REVIEW' : 'UNSUPPORTED',
          explanation: hasPendingEvidence
            ? `NEEDS_REVIEW: Skill claimed with evidence submission currently pending faculty evaluation.`
            : `UNSUPPORTED: Skill claimed in resume without verified evidence in portfolio. (Note: Missing evidence does not mean false — submit proof to verify!)`,
          confidenceScore: hasPendingEvidence ? 60 : 35,
          isVerified: false,
          evidenceIds: item.evidenceIds,
          skillIds: [item.skillDoc._id],
          flaggedForOfficerReview: !hasPendingEvidence,
        });
      } else {
        // Skill mentioned on resume but not even registered in student's skills
        claims.push({
          claimType: 'skill',
          text: `Technical Competence: ${entry.name}`,
          extractedText: matchedSnippet,
          validationStatus: 'UNSUPPORTED',
          explanation: `UNSUPPORTED: No record or evidence for '${entry.name}' found in student portfolio vault. Missing evidence does not imply false claim; student may link an artifact.`,
          confidenceScore: 20,
          isVerified: false,
          evidenceIds: [],
          skillIds: [],
          flaggedForOfficerReview: true,
        });
      }
    }
  }

  // ==========================================
  // 3. PROJECT CLAIMS AUDIT
  // ==========================================
  for (const proj of projects) {
    const projRegex = new RegExp(`\\b${proj.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (projRegex.test(resumeText)) {
      const projVerifiedEv = (proj.evidence || []).filter((id: any) =>
        verifiedEvidenceMap.has(id.toString())
      );
      const projPendingEv = (proj.evidence || []).filter((id: any) =>
        pendingEvidenceMap.has(id.toString())
      );

      if (projVerifiedEv.length > 0) {
        claims.push({
          claimType: 'project',
          text: `Project: ${proj.title}`,
          extractedText: proj.title,
          validationStatus: 'SUPPORTED',
          explanation: `SUPPORTED: Corroborated by verified project codebase and evaluation records.`,
          confidenceScore: 90,
          isVerified: true,
          evidenceIds: projVerifiedEv,
          skillIds: proj.skills.map((sk: any) => sk._id || sk),
          flaggedForOfficerReview: false,
        });
      } else if (projPendingEv.length > 0) {
        claims.push({
          claimType: 'project',
          text: `Project: ${proj.title}`,
          extractedText: proj.title,
          validationStatus: 'NEEDS_REVIEW',
          explanation: `NEEDS_REVIEW: Project evidence has been submitted and is currently awaiting review.`,
          confidenceScore: 60,
          isVerified: false,
          evidenceIds: projPendingEv,
          skillIds: proj.skills.map((sk: any) => sk._id || sk),
          flaggedForOfficerReview: false,
        });
      } else {
        claims.push({
          claimType: 'project',
          text: `Project: ${proj.title}`,
          extractedText: proj.title,
          validationStatus: 'UNSUPPORTED',
          explanation: `UNSUPPORTED: Project mentioned in resume, but has no verified repository or artifact proof in the vault.`,
          confidenceScore: 40,
          isVerified: false,
          evidenceIds: [],
          skillIds: proj.skills.map((sk: any) => sk._id || sk),
          flaggedForOfficerReview: true,
        });
      }
    }
  }

  // ==========================================
  // 4. METRIC & PERFORMANCE CLAIMS AUDIT
  // ==========================================
  // Matches metric expressions like "reduced latency by 45%", "scaled to 50k requests", "improved 3x"
  const metricMatches = Array.from(
    resumeText.matchAll(/(\b(?:improved|reduced|increased|scaled|achieved|boosted|handled)\s+[^.,;\n]{0,40}\b\d+(?:\.\d+)?%|\b\d+x\b|\b\d+[\d,]*\s*(?:users|qps|req\/s|requests|ms|seconds|stars|downloads)\b)/gi)
  );

  for (const m of metricMatches.slice(0, 5)) {
    const metricStr = m[0].trim();
    let foundInVerifiedEvidence = false;
    let matchingEvidenceId: Types.ObjectId | null = null;

    for (const ev of evidenceList) {
      if (ev.description && ev.description.toLowerCase().includes(metricStr.toLowerCase())) {
        if (ev.status === 'verified') {
          foundInVerifiedEvidence = true;
          matchingEvidenceId = ev._id as Types.ObjectId;
          break;
        }
      }
    }

    if (foundInVerifiedEvidence && matchingEvidenceId) {
      claims.push({
        claimType: 'metric',
        text: `Metric Claim: "${metricStr}"`,
        extractedText: metricStr,
        validationStatus: 'SUPPORTED',
        explanation: `SUPPORTED: Numerical achievement corroborated by faculty-verified evidence artifact.`,
        confidenceScore: 90,
        isVerified: true,
        evidenceIds: [matchingEvidenceId],
        skillIds: [],
        flaggedForOfficerReview: false,
      });
    } else {
      claims.push({
        claimType: 'metric',
        text: `Metric Claim: "${metricStr}"`,
        extractedText: metricStr,
        validationStatus: 'UNSUPPORTED',
        explanation: `UNSUPPORTED: Quantitative achievement claim not backed by benchmark or verified document in vault. Missing proof does not mean claim is false; attach proof to verify.`,
        confidenceScore: 30,
        isVerified: false,
        evidenceIds: [],
        skillIds: [],
        flaggedForOfficerReview: true,
      });
    }
  }

  // ==========================================
  // 5. CALCULATE STATS
  // ==========================================
  const totalClaims = claims.length;
  const supportedClaims = claims.filter((c) => c.validationStatus === 'SUPPORTED').length;
  const needsReviewClaims = claims.filter((c) => c.validationStatus === 'NEEDS_REVIEW').length;
  const unsupportedClaims = claims.filter((c) => c.validationStatus === 'UNSUPPORTED').length;
  const contradictedClaims = claims.filter((c) => c.validationStatus === 'CONTRADICTED').length;
  const verificationRate = totalClaims > 0 ? Math.round((supportedClaims / totalClaims) * 100) : 0;

  return {
    claims,
    stats: {
      totalClaims,
      supportedClaims,
      needsReviewClaims,
      unsupportedClaims,
      contradictedClaims,
      verificationRate,
    },
  };
};
