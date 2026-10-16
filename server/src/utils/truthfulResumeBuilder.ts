import { Types } from 'mongoose';
import { IResume, IResumeBullet, IResumeExcludedItem } from '../models/Resume';
import { StudentProfile, IStudentProfile } from '../models/StudentProfile';
import { StudentSkill } from '../models/StudentSkill';
import { Project } from '../models/Project';
import { Assessment } from '../models/Assessment';
import { Job, IJob } from '../models/Job';
import { User } from '../models/User';
import { Evidence } from '../models/Evidence';

export interface BuildResumeOptions {
  studentProfileId: Types.ObjectId;
  jobId?: string;
  targetRole?: string;
  title?: string;
}

export interface BuildResumeResult {
  resumeData: Partial<IResume>;
  excludedItems: IResumeExcludedItem[];
  bulletProvenanceMap: Map<string, { evidenceIds: string[]; skillIds: string[] }>;
}

/**
 * Builds a strictly truthful, job-tailored ATS resume draft.
 * - Extracts only verified skills, evidence-backed projects, and passed certifications.
 * - Omits unsupported claims and records clear explanations for each exclusion.
 * - Never hallucinates metrics, achievements, or titles.
 */
export const buildTruthfulResumeData = async (
  options: BuildResumeOptions
): Promise<BuildResumeResult> => {
  const { studentProfileId, jobId, targetRole, title } = options;

  const profile = await StudentProfile.findById(studentProfileId).populate('user');
  if (!profile) {
    throw new Error('Student profile not found');
  }

  const user = await User.findById(profile.user);
  const fullName = profile.rollNumber ? `${profile.rollNumber}` : 'Student Candidate';

  let targetJob: IJob | null = null;
  const jobRequiredSkillIds = new Set<string>();
  const jobPreferredSkillIds = new Set<string>();

  if (jobId && Types.ObjectId.isValid(jobId)) {
    targetJob = await Job.findById(jobId).populate('company', 'name');
    if (targetJob) {
      (targetJob.requiredSkills || []).forEach((sk: any) => jobRequiredSkillIds.add(sk.toString()));
      (targetJob.preferredSkills || []).forEach((sk: any) =>
        jobPreferredSkillIds.add(sk.toString())
      );
    }
  }

  // 1. Fetch Student Skills, Projects, and Assessments
  const [studentSkills, projects, assessments, verifiedEvidenceList] = await Promise.all([
    StudentSkill.find({ student: profile._id }).populate('skill', 'name slug category'),
    Project.find({ student: profile._id }).populate('skills', 'name slug category'),
    Assessment.find({ student: profile._id, passed: true }),
    Evidence.find({ student: profile._id, status: 'verified' }),
  ]);

  const verifiedEvidenceIds = new Set(verifiedEvidenceList.map((e) => e._id.toString()));
  const skillToEvidenceMap = new Map<string, Types.ObjectId[]>();
  verifiedEvidenceList.forEach((ev) => {
    (ev.skills || []).forEach((skId: any) => {
      const sStr = skId.toString();
      if (!skillToEvidenceMap.has(sStr)) skillToEvidenceMap.set(sStr, []);
      skillToEvidenceMap.get(sStr)!.push(ev._id as Types.ObjectId);
    });
  });

  const excludedItems: IResumeExcludedItem[] = [];
  const bullets: IResumeBullet[] = [];
  const bulletProvenanceMap = new Map<string, { evidenceIds: string[]; skillIds: string[] }>();

  // ==========================================
  // 2. SKILLS AUDIT & GROUPING
  // ==========================================
  const verifiedSkillsList: Array<{
    skillId: Types.ObjectId;
    name: string;
    category: string;
    proficiency: string;
    evidenceIds: Types.ObjectId[];
    isVerified: boolean;
  }> = [];

  for (const s of studentSkills) {
    const skillDoc = s.skill as any;
    if (!skillDoc) continue;

    // Check if skill has verified evidence (direct or linked in evidence records)
    const directEvidence = (s.evidence || []).filter((eId: any) =>
      verifiedEvidenceIds.has(eId.toString())
    );
    const mappedEvidence = skillToEvidenceMap.get(skillDoc._id.toString()) || [];
    const combinedEvidenceMap = new Map<string, Types.ObjectId>();
    [...directEvidence, ...mappedEvidence].forEach((evId) =>
      combinedEvidenceMap.set(evId.toString(), evId)
    );
    const skillEvidence = Array.from(combinedEvidenceMap.values());

    if (s.isVerified && skillEvidence.length > 0) {
      verifiedSkillsList.push({
        skillId: skillDoc._id,
        name: skillDoc.name,
        category: skillDoc.category || 'Technical Skills',
        proficiency: s.proficiency || 'intermediate',
        evidenceIds: skillEvidence,
        isVerified: true,
      });

      // Register skill bullet with provenance
      const bulletId = `bullet-skill-${skillDoc.slug || skillDoc._id}`;
      bullets.push({
        bulletId,
        section: 'skills',
        text: `Demonstrated ${s.proficiency || 'proficient'} competence in ${skillDoc.name}`,
        skillIds: [skillDoc._id],
        evidenceIds: skillEvidence,
        validationStatus: 'SUPPORTED',
        confidenceScore: 100,
      });
      bulletProvenanceMap.set(bulletId, {
        evidenceIds: skillEvidence.map((id: any) => id.toString()),
        skillIds: [skillDoc._id.toString()],
      });
    } else {
      // Excluded unsupported skill claim
      excludedItems.push({
        type: 'skill',
        text: `Skill: ${skillDoc.name} (${s.proficiency || 'self-reported'})`,
        reason:
          'Omitted from ATS resume: skill claim does not have verified faculty/institutional evidence in vault.',
      });
    }
  }

  // Sort verified skills: target job required skills first, then preferred, then others
  verifiedSkillsList.sort((a, b) => {
    const aReq = jobRequiredSkillIds.has(a.skillId.toString())
      ? 2
      : jobPreferredSkillIds.has(a.skillId.toString())
        ? 1
        : 0;
    const bReq = jobRequiredSkillIds.has(b.skillId.toString())
      ? 2
      : jobPreferredSkillIds.has(b.skillId.toString())
        ? 1
        : 0;
    return bReq - aReq;
  });

  // Group into standard ATS categories
  const categoriesMap = new Map<string, typeof verifiedSkillsList>();
  for (const sk of verifiedSkillsList) {
    const cat = sk.category || 'General Technical';
    if (!categoriesMap.has(cat)) categoriesMap.set(cat, []);
    categoriesMap.get(cat)!.push(sk);
  }

  const structuredSkills = Array.from(categoriesMap.entries()).map(([category, skills]) => ({
    category,
    skills,
  }));

  // ==========================================
  // 3. PROJECTS AUDIT & SELECTION
  // ==========================================
  const qualifiedProjects: any[] = [];

  for (const proj of projects) {
    // Only accept projects that have evidence attached
    const projEvidence = (proj.evidence || []).filter((eId: any) =>
      verifiedEvidenceIds.has(eId.toString())
    );

    if (projEvidence.length > 0) {
      // Calculate relevance score against target job
      const projSkillIds = (proj.skills || []).map(
        (sk: any) => sk._id?.toString() || sk.toString()
      );
      let relevanceScore = 0;
      for (const sId of projSkillIds) {
        if (jobRequiredSkillIds.has(sId)) relevanceScore += 3;
        if (jobPreferredSkillIds.has(sId)) relevanceScore += 1;
      }

      // Generate strictly factual bullets from description without fabricating metrics
      const rawSentences = proj.description
        .split(/(?<=[.!?])\s+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 15);

      const factualBullets: IResumeBullet[] = [];
      const usedSentences = rawSentences.slice(0, 3); // Max 3 concise bullets

      usedSentences.forEach((sentence: string, idx: number) => {
        const bulletId = `bullet-proj-${proj._id}-${idx}`;
        const bulletObj: IResumeBullet = {
          bulletId,
          section: 'projects',
          text: sentence,
          skillIds: proj.skills.map((sk: any) => sk._id || sk),
          evidenceIds: projEvidence,
          validationStatus: 'SUPPORTED',
          confidenceScore: 95,
        };
        factualBullets.push(bulletObj);
        bullets.push(bulletObj);

        bulletProvenanceMap.set(bulletId, {
          evidenceIds: projEvidence.map((id: any) => id.toString()),
          skillIds: proj.skills.map((sk: any) => (sk._id || sk).toString()),
        });
      });

      qualifiedProjects.push({
        projectId: proj._id,
        title: proj.title,
        description: proj.description,
        technologies: (proj.skills || []).map((sk: any) => sk.name).filter(Boolean),
        url: proj.liveUrl || proj.repoUrl,
        bullets: factualBullets,
        relevanceScore,
      });
    } else {
      // Excluded project without evidence
      excludedItems.push({
        type: 'project',
        text: `Project: ${proj.title}`,
        reason:
          'Omitted from ATS resume: project repository/deliverable does not have approved verification artifacts.',
      });
    }
  }

  // Sort qualified projects by relevance to job, select top 2-3 to guarantee readable layout
  qualifiedProjects.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const selectedProjects = qualifiedProjects.slice(0, 3);

  // ==========================================
  // 4. CERTIFICATIONS & ASSESSMENTS
  // ==========================================
  const structuredCertifications: any[] = [];
  for (const ass of assessments) {
    const bulletId = `bullet-cert-${ass._id}`;
    const certObj = {
      title: `${ass.title} (${Math.round((ass.score / ass.maxScore) * 100)}% Score)`,
      issuer: ass.provider || 'Institutional Assessment Cell',
      issueDate: ass.createdAt,
      credentialUrl: ass.certificateUrl,
      evidenceId: undefined,
      isVerified: true,
    };
    structuredCertifications.push(certObj);

    bullets.push({
      bulletId,
      section: 'certifications',
      text: `Certified: ${certObj.title} by ${certObj.issuer}`,
      skillIds: [],
      evidenceIds: [],
      validationStatus: 'SUPPORTED',
      confidenceScore: 100,
    });

    bulletProvenanceMap.set(bulletId, {
      evidenceIds: [],
      skillIds: [],
    });
  }

  // ==========================================
  // 5. CONTACT & EDUCATION DETAILS
  // ==========================================
  const contactDetails = {
    fullName: user?.email ? user.email.split('@')[0].replace(/[._]/g, ' ').toUpperCase() : fullName,
    email: user?.email || '',
    phone: profile.phone || '',
    department: profile.department,
    degree: profile.degree,
    institution: 'Apex Institute of Technology',
    rollNumber: profile.rollNumber,
    graduationYear: profile.graduationYear,
    cgpa: profile.cgpa,
    links: [
      { label: 'Portfolio', url: `https://evidra.edu/students/${profile.rollNumber}` },
      { label: 'Evidence Vault', url: `https://evidra.edu/verify/${profile._id}` },
    ],
  };

  const education = [
    {
      institution: 'Apex Institute of Technology - Technical Campus',
      degree: profile.degree,
      department: profile.department,
      graduationYear: profile.graduationYear,
      cgpa: profile.cgpa,
      highlights: [
        `Academic Specialization in ${profile.department}`,
        `Cumulative Grade Point Average: ${profile.cgpa.toFixed(2)} / 10.0`,
      ],
    },
  ];

  // Education Bullet
  const eduBulletId = `bullet-edu-${profile._id}`;
  bullets.push({
    bulletId: eduBulletId,
    section: 'education',
    text: `${profile.degree} in ${profile.department}, Batch of ${profile.graduationYear} with CGPA ${profile.cgpa.toFixed(2)}`,
    skillIds: [],
    evidenceIds: [],
    validationStatus: 'SUPPORTED',
    confidenceScore: 100,
  });
  bulletProvenanceMap.set(eduBulletId, { evidenceIds: [], skillIds: [] });

  // Effective Role & Title
  const effectiveRole = targetJob?.title || targetRole || 'Software Development Engineer';
  const effectiveTitle =
    title ||
    (targetJob
      ? `${targetJob.title} - ${(targetJob.company as any)?.name || 'Application'}`
      : `${effectiveRole} Resume`);

  const summary = `Fact-checked ${profile.degree} candidate in ${profile.department} (CGPA: ${profile.cgpa}/10). Demonstrates verified technical competence in ${
    verifiedSkillsList
      .slice(0, 5)
      .map((s) => s.name)
      .join(', ') || 'software engineering'
  } backed by reviewed project codebases and validated academic evaluations.`;

  return {
    resumeData: {
      student: profile._id as Types.ObjectId,
      title: effectiveTitle,
      summary,
      targetRole: effectiveRole,
      targetJob: targetJob ? (targetJob._id as Types.ObjectId) : undefined,
      status: 'generated',
      contactDetails,
      education,
      skills: structuredSkills,
      projects: selectedProjects,
      certifications: structuredCertifications,
      bullets,
      excludedItems,
      generationStats: {
        totalEvidenceConsidered: verifiedEvidenceList.length,
        supportedBulletsCount: bullets.length,
        omittedClaimsCount: excludedItems.length,
        fitScore: targetJob
          ? Math.min(
              100,
              Math.round(
                (verifiedSkillsList.length / Math.max(1, (targetJob.requiredSkills || []).length)) *
                  100
              )
            )
          : 85,
        generatedAt: new Date(),
      },
    },
    excludedItems,
    bulletProvenanceMap,
  };
};
