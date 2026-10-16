import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { User, IUser } from '../src/models/User';
import { Company, ICompany } from '../src/models/Company';
import { Job, IJob } from '../src/models/Job';
import { Skill, ISkill } from '../src/models/Skill';
import { StudentProfile, IStudentProfile } from '../src/models/StudentProfile';
import { StudentSkill } from '../src/models/StudentSkill';
import { Evidence, IEvidence } from '../src/models/Evidence';
import { hashPassword } from '../src/utils/password';
import { signAuthToken } from '../src/utils/token';
import { seedCanonicalSkills } from '../src/utils/skillNormalizer';
import {
  calculateStudentJobMatch,
  calculateEvidenceItemContribution,
  calculateSkillEvidenceValue,
  evaluateEligibility,
  compareCandidates,
  exportRankingsToCsv,
  DEFAULT_SCORING_POLICY,
  ScoringPolicy,
  CandidateJobMatch,
} from '../src/utils/matchingEngine';
import { config } from '../src/config/env';

describe('Deterministic Explainable Job-Matching Engine', () => {
  const app = createApp();
  let dbAvailable = false;

  let officerCookie: string[];
  let officerUser: IUser;

  let recruiter1Cookie: string[];
  let recruiter1User: IUser;
  let company1: ICompany;

  let recruiter2Cookie: string[];
  let recruiter2User: IUser;

  let student1Cookie: string[];
  let student1User: IUser;
  let student1Profile: IStudentProfile;

  let student2User: IUser;
  let student2Profile: IStudentProfile;

  let student3User: IUser;
  let student3Profile: IStudentProfile;

  let reactSkill: ISkill;
  let nodeSkill: ISkill;
  let tsSkill: ISkill;
  let pythonSkill: ISkill;

  let testJob: IJob;

  const cleanup = async () => {
    if (!dbAvailable) return;
    const testUsers = await User.find({ email: { $regex: /@matching-engine-test\.com$/ } });
    const userIds = testUsers.map((u) => u._id);

    const companies = await Company.find({ createdBy: { $in: userIds } });
    const companyIds = companies.map((c) => c._id);

    const profiles = await StudentProfile.find({ user: { $in: userIds } });
    const profileIds = profiles.map((p) => p._id);

    await Evidence.deleteMany({ student: { $in: profileIds } });
    await StudentSkill.deleteMany({ student: { $in: profileIds } });
    await StudentProfile.deleteMany({ _id: { $in: profileIds } });
    await Job.deleteMany({ company: { $in: companyIds } });
    await Company.deleteMany({ _id: { $in: companyIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  };

  beforeAll(async () => {
    dbAvailable = await connectDB(config.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    if (dbAvailable) {
      await cleanup();
      await seedCanonicalSkills();

      const passwordHash = await hashPassword('Password123!');

      // Retrieve Canonical Skills
      reactSkill = (await Skill.findOne({ slug: 'react' }))!;
      nodeSkill = (await Skill.findOne({ slug: 'nodejs' }))!;
      tsSkill = (await Skill.findOne({ slug: 'typescript' }))!;
      pythonSkill = (await Skill.findOne({ slug: 'python' }))!;

      // 1. Placement Officer
      officerUser = await User.create({
        email: 'officer@matching-engine-test.com',
        passwordHash,
        role: 'placement_officer',
        status: 'active',
      });
      const oToken = signAuthToken({
        userId: officerUser._id.toString(),
        role: 'placement_officer',
      });
      officerCookie = [`${config.COOKIE_NAME}=${oToken}; Path=/`];

      // 2. Recruiter 1 & Company 1
      recruiter1User = await User.create({
        email: 'recruiter1@matching-engine-test.com',
        passwordHash,
        role: 'recruiter',
        status: 'active',
      });
      const r1Token = signAuthToken({ userId: recruiter1User._id.toString(), role: 'recruiter' });
      recruiter1Cookie = [`${config.COOKIE_NAME}=${r1Token}; Path=/`];

      company1 = await Company.create({
        name: 'Nexus Platforms',
        industry: 'Software',
        isVerified: true,
        createdBy: recruiter1User._id,
      });

      // 3. Recruiter 2 (not authorized for Company 1)
      recruiter2User = await User.create({
        email: 'recruiter2@matching-engine-test.com',
        passwordHash,
        role: 'recruiter',
        status: 'active',
      });
      const r2Token = signAuthToken({ userId: recruiter2User._id.toString(), role: 'recruiter' });
      recruiter2Cookie = [`${config.COOKIE_NAME}=${r2Token}; Path=/`];

      await Company.create({
        name: 'Vortex Systems',
        industry: 'Cloud',
        isVerified: true,
        createdBy: recruiter2User._id,
      });

      // 4. Student 1: High Skills + Fully Eligible
      student1User = await User.create({
        email: 'alice@matching-engine-test.com',
        passwordHash,
        role: 'student',
        status: 'active',
      });
      student1Profile = await StudentProfile.create({
        user: student1User._id,
        rollNumber: 'ALICE2026',
        department: 'Computer Science & Engineering',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.85,
      });
      const s1Token = signAuthToken({ userId: student1User._id.toString(), role: 'student' });
      student1Cookie = [`${config.COOKIE_NAME}=${s1Token}; Path=/`];

      // 5. Student 2: High Skills but NOT Eligible (CGPA below threshold)
      student2User = await User.create({
        email: 'bob@matching-engine-test.com',
        passwordHash,
        role: 'student',
        status: 'active',
      });
      student2Profile = await StudentProfile.create({
        user: student2User._id,
        rollNumber: 'BOB2026',
        department: 'Computer Science & Engineering',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 6.2, // Below 7.5 cut-off!
      });

      // 6. Student 3: Eligible but Moderate/Emerging Skills
      student3User = await User.create({
        email: 'charlie@matching-engine-test.com',
        passwordHash,
        role: 'student',
        status: 'active',
      });
      student3Profile = await StudentProfile.create({
        user: student3User._id,
        rollNumber: 'CHARLIE2026',
        department: 'Information Technology',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.0,
      });

      // 7. Seed Sample Job with Required and Preferred Skills
      testJob = await Job.create({
        company: company1._id,
        title: 'Full Stack Engineer',
        description: 'Modern web app development with React, Node.js and TypeScript.',
        location: 'Bengaluru',
        workplaceType: 'hybrid',
        jobType: 'full_time',
        status: 'open',
        postedBy: recruiter1User._id,
        requiredSkills: [reactSkill._id, nodeSkill._id], // Weight 3 each = 6
        preferredSkills: [tsSkill._id], // Weight 1 = 1 (Total weight = 7)
        minCgpa: 7.5,
        eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
        eligibleGraduationYears: [2026],
        requisitionId: 'REQ-MATCH-001',
      });

      // Seed Student 1 Evidence:
      // Verified Coding Assessment for React (score 90/100 -> contribution 1.0)
      await Evidence.create({
        student: student1Profile._id,
        skills: [reactSkill._id],
        type: 'coding_assessment',
        title: 'Advanced React Assessment',
        status: 'verified',
        isVerified: true,
        score: 90,
        maxScore: 100,
        reviewedBy: officerUser._id,
      });

      // Verified Evaluated Project for Node.js (score 85/100 -> contribution 0.90)
      await Evidence.create({
        student: student1Profile._id,
        skills: [nodeSkill._id],
        type: 'evaluated_project',
        title: 'Node.js Microservices System',
        status: 'verified',
        isVerified: true,
        score: 85,
        maxScore: 100,
        reviewedBy: officerUser._id,
      });

      // Verified Quiz for TypeScript (score 70/100 -> contribution 0.70)
      await Evidence.create({
        student: student1Profile._id,
        skills: [tsSkill._id],
        type: 'technical_quiz',
        title: 'TypeScript Generics Quiz',
        status: 'verified',
        isVerified: true,
        score: 70,
        maxScore: 100,
        reviewedBy: officerUser._id,
      });

      // Student 1 Unsupported Claim: Self-reported Python without verified assessment
      await StudentSkill.create({
        student: student1Profile._id,
        skill: pythonSkill._id,
        proficiency: 'intermediate',
        status: 'self_reported',
        isVerified: false,
      });

      // Seed Student 2 Evidence (Identical high skills to Student 1, but CGPA 6.2 < 7.5):
      await Evidence.create({
        student: student2Profile._id,
        skills: [reactSkill._id],
        type: 'coding_assessment',
        title: 'React Hackathon Assessment',
        status: 'verified',
        isVerified: true,
        score: 95,
        maxScore: 100,
        reviewedBy: officerUser._id,
      });
      await Evidence.create({
        student: student2Profile._id,
        skills: [nodeSkill._id],
        type: 'evaluated_project',
        title: 'Node.js API Architecture',
        status: 'verified',
        isVerified: true,
        score: 90,
        maxScore: 100,
        reviewedBy: officerUser._id,
      });

      // Seed Student 3 Evidence:
      // Partial quiz for React (score 50/100 -> contribution 0.50)
      await Evidence.create({
        student: student3Profile._id,
        skills: [reactSkill._id],
        type: 'technical_quiz',
        title: 'React Fundamentals Quiz',
        status: 'verified',
        isVerified: true,
        score: 50,
        maxScore: 100,
        reviewedBy: officerUser._id,
      });
    } else {
      const mockId = () => new Types.ObjectId();
      reactSkill = { _id: mockId(), name: 'React', slug: 'react', category: 'frontend', isCanonical: true } as any;
      nodeSkill = { _id: mockId(), name: 'Node.js', slug: 'nodejs', category: 'backend', isCanonical: true } as any;
      tsSkill = { _id: mockId(), name: 'TypeScript', slug: 'typescript', category: 'languages', isCanonical: true } as any;
      pythonSkill = { _id: mockId(), name: 'Python', slug: 'python', category: 'languages', isCanonical: true } as any;

      student1Profile = {
        _id: mockId(),
        rollNumber: 'ALICE2026',
        department: 'Computer Science & Engineering',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.85,
      } as any;

      student2Profile = {
        _id: mockId(),
        rollNumber: 'BOB2026',
        department: 'Computer Science & Engineering',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 6.2,
      } as any;

      student3Profile = {
        _id: mockId(),
        rollNumber: 'CHARLIE2026',
        department: 'Information Technology',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.0,
      } as any;

      testJob = {
        _id: mockId(),
        title: 'Full Stack Engineer',
        minCgpa: 7.5,
        eligibleBatches: [2026],
        eligibleBranches: ['Computer Science & Engineering', 'CSE'],
        requiredSkills: [reactSkill._id, nodeSkill._id],
        preferredSkills: [tsSkill._id],
      } as any;
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await cleanup();
      await disconnectDB();
    }
  });

  // ==========================================
  // 1. Exact Formula & Score Calculations
  // ==========================================
  describe('1. Exact Formula & Score Calculations', () => {
    it('should compute exact Fit Score = 100 * Σ(w_i * e_i) / Σ(w_i) with configurable weights', () => {
      const skillsMap = new Map<string, ISkill>([
        [reactSkill._id.toString(), reactSkill],
        [nodeSkill._id.toString(), nodeSkill],
        [tsSkill._id.toString(), tsSkill],
      ]);

      const mockEvidence = [
        {
          _id: 'ev1',
          skills: [reactSkill._id],
          type: 'coding_assessment',
          isVerified: true,
          status: 'verified',
          score: 90,
          maxScore: 100,
        },
        {
          _id: 'ev2',
          skills: [nodeSkill._id],
          type: 'evaluated_project',
          isVerified: true,
          status: 'verified',
          score: 85,
          maxScore: 100,
        },
        {
          _id: 'ev3',
          skills: [tsSkill._id],
          type: 'technical_quiz',
          isVerified: true,
          status: 'verified',
          score: 70,
          maxScore: 100,
        },
      ] as unknown as IEvidence[];

      const match = calculateStudentJobMatch({
        job: testJob,
        student: student1Profile,
        skillsMap,
        studentSkills: [],
        evidenceList: mockEvidence,
        policy: DEFAULT_SCORING_POLICY,
      });

      expect(match.totalWeight).toBe(7);
      expect(match.weightedScoreSum).toBe(6.4);
      expect(match.fitScore).toBe(91.4);
      expect(match.supportedSkills.length).toBe(3);
      expect(match.scoringPolicyVersion).toBe('evidra-v1.0');
    });

    it('should dynamically apply custom weight policies (e.g. required=5, preferred=2)', () => {
      const customPolicy: ScoringPolicy = {
        version: 'evidra-custom-v2',
        requiredSkillWeight: 5,
        preferredSkillWeight: 2,
        minSupportedThreshold: 0.7,
        minPartialThreshold: 0.2,
      };

      const skillsMap = new Map<string, ISkill>([
        [reactSkill._id.toString(), reactSkill],
        [nodeSkill._id.toString(), nodeSkill],
        [tsSkill._id.toString(), tsSkill],
      ]);

      const mockEvidence = [
        {
          _id: 'ev1',
          skills: [reactSkill._id],
          type: 'coding_assessment',
          isVerified: true,
          status: 'verified',
          score: 90,
          maxScore: 100,
        },
        {
          _id: 'ev2',
          skills: [nodeSkill._id],
          type: 'evaluated_project',
          isVerified: true,
          status: 'verified',
          score: 85,
          maxScore: 100,
        },
        {
          _id: 'ev3',
          skills: [tsSkill._id],
          type: 'technical_quiz',
          isVerified: true,
          status: 'verified',
          score: 70,
          maxScore: 100,
        },
      ] as unknown as IEvidence[];

      const match = calculateStudentJobMatch({
        job: testJob,
        student: student1Profile,
        skillsMap,
        studentSkills: [],
        evidenceList: mockEvidence,
        policy: customPolicy,
      });

      expect(match.totalWeight).toBe(12);
      expect(match.weightedScoreSum).toBe(10.9);
      expect(match.fitScore).toBe(90.8);
      expect(match.scoringPolicyVersion).toBe('evidra-custom-v2');
    });
  });

  // ==========================================
  // 2. Proficiency Mapping & Fraud Prevention
  // ==========================================
  describe('2. Evidence Type Mapping & Unverified Claim Handling', () => {
    it('should map reviewed assessments, evaluated projects, and certifications to correct proficiency values', () => {
      // High assessment (90%) -> 1.0
      const assessmentContribution = calculateEvidenceItemContribution({
        type: 'coding_assessment',
        isVerified: true,
        status: 'verified',
        score: 90,
        maxScore: 100,
      } as unknown as IEvidence);
      expect(assessmentContribution).toBe(1.0);

      // Evaluated project (80%) -> 0.90
      const projectContribution = calculateEvidenceItemContribution({
        type: 'evaluated_project',
        isVerified: true,
        status: 'verified',
        score: 80,
        maxScore: 100,
      } as unknown as IEvidence);
      expect(projectContribution).toBe(0.9);

      // Verified Certification -> 0.75
      const certContribution = calculateEvidenceItemContribution({
        type: 'verified_certification',
        isVerified: true,
        status: 'verified',
      } as unknown as IEvidence);
      expect(certContribution).toBe(0.75);
    });

    it('should strictly award 0.0 to unreviewed evidence or raw repository URLs', () => {
      // Unreviewed GitHub repo (status = 'submitted', isVerified = false)
      const rawRepoContribution = calculateEvidenceItemContribution({
        type: 'github_repo',
        url: 'https://github.com/student/unreviewed-repo',
        status: 'submitted',
        isVerified: false,
      } as unknown as IEvidence);
      expect(rawRepoContribution).toBe(0.0);

      // Rejected evidence
      const rejectedContribution = calculateEvidenceItemContribution({
        type: 'coding_assessment',
        status: 'rejected',
        isVerified: false,
        score: 30,
        maxScore: 100,
      } as unknown as IEvidence);
      expect(rejectedContribution).toBe(0.0);
    });

    it('should flag self-reported claims without verified evidence as Unsupported Claims', () => {
      const studentSkill = {
        skill: pythonSkill._id,
        proficiency: 'expert',
        status: 'self_reported',
        isVerified: false,
      } as unknown as IStudentSkill;

      const result = calculateSkillEvidenceValue(pythonSkill._id, [], studentSkill);
      expect(result.evidenceValue).toBe(0.0);
      expect(result.isClaimUnsupported).toBe(true);
      expect(result.claimReason).toContain('Self-reported skill with no verified assessment');
    });

    it('should NOT double-count duplicate evidence pointing to the same URL or ID', () => {
      const duplicateEvidence = [
        {
          _id: 'ev-unique-1',
          skills: [reactSkill._id],
          type: 'coding_assessment',
          url: 'https://assessments.evidra.dev/test/12345',
          isVerified: true,
          status: 'verified',
          score: 85,
          maxScore: 100,
        },
        {
          _id: 'ev-unique-2', // Duplicate URL pointing to the exact same test
          skills: [reactSkill._id],
          type: 'coding_assessment',
          url: 'https://assessments.evidra.dev/test/12345?ref=portal',
          isVerified: true,
          status: 'verified',
          score: 85,
          maxScore: 100,
        },
      ] as unknown as IEvidence[];

      const result = calculateSkillEvidenceValue(reactSkill._id, duplicateEvidence);
      // Only 1 unique item counted -> contribution 1.0 (not double counted!)
      expect(result.evidenceItems.length).toBe(1);
      expect(result.evidenceValue).toBe(1.0);
    });
  });

  // ==========================================
  // 3. Academic Eligibility Invariants
  // ==========================================
  describe('3. Academic Eligibility Invariants', () => {
    it('should accurately evaluate MET, NOT_MET, and UNKNOWN status', () => {
      // 1. Student 1: CGPA 8.85 >= 7.5, Batch 2026 in [2026], Branch CSE -> MET
      const el1 = evaluateEligibility(student1Profile, testJob);
      expect(el1.status).toBe('MET');
      expect(el1.isEligible).toBe(true);

      // 2. Student 2: CGPA 6.2 < 7.5 -> NOT_MET
      const el2 = evaluateEligibility(student2Profile, testJob);
      expect(el2.status).toBe('NOT_MET');
      expect(el2.isEligible).toBe(false);
      expect(el2.criteria.find((c) => c.criterion === 'cgpa')?.status).toBe('NOT_MET');

      // 3. Candidate with missing CGPA -> UNKNOWN
      const incompleteProfile = {
        department: 'Computer Science & Engineering',
        graduationYear: 2026,
      } as unknown as IStudentProfile;
      const el3 = evaluateEligibility(incompleteProfile, testJob);
      expect(el3.status).toBe('UNKNOWN');
      expect(el3.isEligible).toBe(false);
    });

    it('INVARIANT: A high skill score must NOT override a failed mandatory criterion', () => {
      // Student 2 has high skill fit, but CGPA 6.2 < 7.5
      const skillsMap = new Map<string, ISkill>([
        [reactSkill._id.toString(), reactSkill],
        [nodeSkill._id.toString(), nodeSkill],
        [tsSkill._id.toString(), tsSkill],
      ]);

      const mockEvidence = [
        {
          _id: 'ev1',
          skills: [reactSkill._id],
          type: 'coding_assessment',
          isVerified: true,
          status: 'verified',
          score: 95,
          maxScore: 100,
        },
        {
          _id: 'ev2',
          skills: [nodeSkill._id],
          type: 'evaluated_project',
          isVerified: true,
          status: 'verified',
          score: 90,
          maxScore: 100,
        },
      ] as unknown as IEvidence[];

      const match = calculateStudentJobMatch({
        job: testJob,
        student: student2Profile,
        skillsMap,
        studentSkills: [],
        evidenceList: mockEvidence,
      });

      // Fit score is high (81.4%)
      expect(match.fitScore).toBeGreaterThanOrEqual(80.0);
      // But eligibility MUST remain NOT_MET!
      expect(match.eligibility.status).toBe('NOT_MET');
      expect(match.eligibility.isEligible).toBe(false);
      expect(match.explanation).toContain('Academic Eligibility: NOT_MET');
    });
  });

  // ==========================================
  // 4. Deterministic Tie-Breaking
  // ==========================================
  describe('4. Deterministic Tie-Breaking', () => {
    it('should break ties deterministically using eligibility, skills, CGPA and ID', () => {
      // Candidate A: Fit Score 85.0, MET, 2 verified skills, CGPA 8.5, ID "AAA"
      const candA = {
        studentProfileId: 'AAA',
        fitScore: 85.0,
        cgpa: 8.5,
        eligibility: { status: 'MET' },
        supportedSkills: [{ isRequired: true }, { isRequired: true }],
      } as unknown as CandidateJobMatch;

      // Candidate B: Fit Score 85.0, NOT_MET, 2 verified skills, CGPA 9.0, ID "BBB"
      const candB = {
        studentProfileId: 'BBB',
        fitScore: 85.0,
        cgpa: 9.0,
        eligibility: { status: 'NOT_MET' },
        supportedSkills: [{ isRequired: true }, { isRequired: true }],
      } as unknown as CandidateJobMatch;

      // Candidate C: Fit Score 85.0, MET, 1 verified skill, CGPA 8.5, ID "CCC"
      const candC = {
        studentProfileId: 'CCC',
        fitScore: 85.0,
        cgpa: 8.5,
        eligibility: { status: 'MET' },
        supportedSkills: [{ isRequired: true }],
      } as unknown as CandidateJobMatch;

      // Candidate D: Fit Score 85.0, MET, 2 verified skills, CGPA 8.0, ID "DDD"
      const candD = {
        studentProfileId: 'DDD',
        fitScore: 85.0,
        cgpa: 8.0,
        eligibility: { status: 'MET' },
        supportedSkills: [{ isRequired: true }, { isRequired: true }],
      } as unknown as CandidateJobMatch;

      const list = [candB, candC, candD, candA];
      list.sort(compareCandidates);

      // Expected order:
      // 1. candA (MET, 85.0, 2 req skills, CGPA 8.5)
      // 2. candD (MET, 85.0, 2 req skills, CGPA 8.0)
      // 3. candC (MET, 85.0, 1 req skill, CGPA 8.5)
      // 4. candB (NOT_MET, regardless of CGPA 9.0)
      expect(list[0].studentProfileId).toBe('AAA');
      expect(list[1].studentProfileId).toBe('DDD');
      expect(list[2].studentProfileId).toBe('CCC');
      expect(list[3].studentProfileId).toBe('BBB');
    });

    it('should export rankings to RFC 4180 CSV correctly using exportRankingsToCsv', () => {
      const sampleRankings = [
        {
          studentProfileId: 'PROF-1',
          rollNumber: 'CS2026',
          email: 'test@example.com',
          department: 'CSE',
          graduationYear: 2026,
          cgpa: 8.5,
          eligibility: { status: 'MET' },
          fitScore: 88.0,
          supportedSkills: [{ skillName: 'React' }],
          partialMatches: [],
          requiredSkillGaps: [],
          preferredSkillGaps: [],
          unsupportedClaims: [],
          explanation: 'Fit 88.0/100',
          scoringPolicyVersion: 'evidra-v1.0',
        },
      ] as unknown as CandidateJobMatch[];

      const csvString = exportRankingsToCsv(sampleRankings);
      expect(csvString).toContain('Rank,Roll Number,Email,Department');
      expect(csvString).toContain('CS2026');
      expect(csvString).toContain('88.0');
    });
  });

  // ==========================================
  // 5. Batch Ranking, Filtering & CSV Export API
  // ==========================================
  describe('5. Batch Ranking & API Access Control', () => {
    it('Placement officer can batch-rank candidates for any job listing', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/matching/jobs/${testJob._id}/rank`)
        .set('Cookie', officerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rankings.length).toBeGreaterThanOrEqual(2);

      // Verify Student 1 ranks first (MET + highest verified skill evidence)
      const topRank = res.body.data.rankings[0];
      expect(topRank.studentProfileId).toBe(student1Profile._id.toString());
      expect(topRank.eligibility.status).toBe('MET');
      expect(topRank.fitScore).toBeGreaterThanOrEqual(90.0);

      // Verify Student 2 has high skill but NOT_MET eligibility
      const cand2 = res.body.data.rankings.find(
        (r: { studentProfileId: string }) => r.studentProfileId === student2Profile._id.toString()
      );
      expect(cand2).toBeDefined();
      expect(cand2.eligibility.status).toBe('NOT_MET');
    });

    it('Placement officer can filter batch rankings by eligibility status (e.g. MET only)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/matching/jobs/${testJob._id}/rank?eligibility=MET`)
        .set('Cookie', officerCookie);

      expect(res.status).toBe(200);
      expect(
        res.body.data.rankings.every(
          (r: { eligibility: { status: string } }) => r.eligibility.status === 'MET'
        )
      ).toBe(true);
      expect(
        res.body.data.rankings.some(
          (r: { studentProfileId: string }) => r.studentProfileId === student2Profile._id.toString()
        )
      ).toBe(false);
    });

    it('Placement officer can export batch rankings to downloadable CSV', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/matching/jobs/${testJob._id}/export/csv`)
        .set('Cookie', officerCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('.csv');
      expect(res.text).toContain('Rank,Roll Number,Email,Department');
      expect(res.text).toContain('ALICE2026');
      expect(res.text).toContain('MET');
    });

    it('Recruiter can rank candidates for their authorized company job', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/matching/jobs/${testJob._id}/rank`)
        .set('Cookie', recruiter1Cookie); // Owns Company 1

      expect(res.status).toBe(200);
      expect(res.body.data.rankings.length).toBeGreaterThan(0);
    });

    it('Recruiter is FORBIDDEN (403) from ranking candidates on jobs of unauthorized companies', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/matching/jobs/${testJob._id}/rank`)
        .set('Cookie', recruiter2Cookie); // Recruiter 2 does NOT own Company 1

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Student can inspect their own fit analysis on a published job (/my-fit)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/matching/jobs/${testJob._id}/my-fit`)
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.match.fitScore).toBeGreaterThanOrEqual(90.0);
      expect(res.body.data.match.supportedSkills.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.match.explanation).toContain('Candidate achieved');
      expect(res.body.data.match.disclaimer).toBeDefined();
    });

    it('Student is FORBIDDEN (403) from accessing batch ranking of all candidates', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/matching/jobs/${testJob._id}/rank`)
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(403);
    });
  });
});
