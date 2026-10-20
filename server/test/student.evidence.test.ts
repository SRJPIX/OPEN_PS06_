import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { User, IUser } from '../src/models/User';
import { StudentProfile, IStudentProfile } from '../src/models/StudentProfile';
import { StudentSkill } from '../src/models/StudentSkill';
import { Evidence } from '../src/models/Evidence';
import { Skill } from '../src/models/Skill';
import { hashPassword } from '../src/utils/password';
import { signAuthToken } from '../src/utils/token';
import { resolveCanonicalSkillDefinition, seedCanonicalSkills } from '../src/utils/skillNormalizer';
import { config } from '../src/config/env';

describe('Student Profile & Evidence-Backed Skill System', () => {
  const app = createApp();
  let dbAvailable = false;

  let student1Cookie: string[];
  let student1User: IUser;
  let student1Profile: IStudentProfile;

  let student2Cookie: string[];
  let student2User: IUser;
  let student2Profile: IStudentProfile;

  let officerCookie: string[];
  let officerUser: IUser;

  const cleanup = async () => {
    if (!dbAvailable) return;
    const testUsers = await User.find({ email: { $regex: /@student-evidence-test\.com$/ } });
    const userIds = testUsers.map((u) => u._id);
    const profiles = await StudentProfile.find({ user: { $in: userIds } });
    const profileIds = profiles.map((p) => p._id);

    await Evidence.deleteMany({ student: { $in: profileIds } });
    await StudentSkill.deleteMany({ student: { $in: profileIds } });
    await StudentProfile.deleteMany({ _id: { $in: profileIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  };

  beforeAll(async () => {
    dbAvailable = await connectDB(config.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    if (dbAvailable) {
      await cleanup();
      await seedCanonicalSkills();

      const passwordHash = await hashPassword('Password123!');

      // 1. Create Student 1
      student1User = await User.create({
        email: 'student1@student-evidence-test.com',
        passwordHash,
        role: 'student',
        status: 'active',
      });
      student1Profile = await StudentProfile.create({
        user: student1User._id,
        rollNumber: 'EV2026001',
        department: 'Information Technology',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.2,
      });
      const s1Token = signAuthToken({
        userId: student1User._id.toString(),
        role: 'student',
      });
      student1Cookie = [`${config.COOKIE_NAME}=${s1Token}; Path=/`];

      // 2. Create Student 2 (for ownership isolation tests)
      student2User = await User.create({
        email: 'student2@student-evidence-test.com',
        passwordHash,
        role: 'student',
        status: 'active',
      });
      student2Profile = await StudentProfile.create({
        user: student2User._id,
        rollNumber: 'EV2026002',
        department: 'Computer Science',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 9.0,
      });
      const s2Token = signAuthToken({
        userId: student2User._id.toString(),
        role: 'student',
      });
      student2Cookie = [`${config.COOKIE_NAME}=${s2Token}; Path=/`];

      // 3. Create Placement Officer
      officerUser = await User.create({
        email: 'officer@student-evidence-test.com',
        passwordHash,
        role: 'placement_officer',
        status: 'active',
      });
      const officerToken = signAuthToken({
        userId: officerUser._id.toString(),
        role: 'placement_officer',
      });
      officerCookie = [`${config.COOKIE_NAME}=${officerToken}; Path=/`];
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await cleanup();
      await disconnectDB();
    }
  });

  describe('1. Canonical Skill Dictionary & Alias Normalisation', () => {
    it('should normalize React variants (ReactJS, React.js, React) to React', () => {
      const v1 = resolveCanonicalSkillDefinition('ReactJS');
      const v2 = resolveCanonicalSkillDefinition('react.js');
      const v3 = resolveCanonicalSkillDefinition('React');

      expect(v1?.slug).toBe('react');
      expect(v2?.slug).toBe('react');
      expect(v3?.slug).toBe('react');
      expect(v1?.name).toBe('React');
    });

    it('should normalize JS variants (JS, JavaScript, vanilla js) to JavaScript', () => {
      const v1 = resolveCanonicalSkillDefinition('JS');
      const v2 = resolveCanonicalSkillDefinition('JavaScript');
      const v3 = resolveCanonicalSkillDefinition('vanilla js');

      expect(v1?.slug).toBe('javascript');
      expect(v2?.slug).toBe('javascript');
      expect(v3?.slug).toBe('javascript');
      expect(v1?.name).toBe('JavaScript');
    });

    it('should normalize Node variants (NodeJS, Node.js, node js) to Node.js', () => {
      const v1 = resolveCanonicalSkillDefinition('NodeJS');
      const v2 = resolveCanonicalSkillDefinition('Node.js');
      const v3 = resolveCanonicalSkillDefinition('node js');

      expect(v1?.slug).toBe('nodejs');
      expect(v2?.slug).toBe('nodejs');
      expect(v3?.slug).toBe('nodejs');
      expect(v1?.name).toBe('Node.js');
    });

    it('STRICT: should keep Java and JavaScript completely distinct', () => {
      const java = resolveCanonicalSkillDefinition('Java');
      const coreJava = resolveCanonicalSkillDefinition('core java');
      const js = resolveCanonicalSkillDefinition('JS');
      const javascript = resolveCanonicalSkillDefinition('JavaScript');

      expect(java?.slug).toBe('java');
      expect(coreJava?.slug).toBe('java');
      expect(java?.name).toBe('Java');

      expect(js?.slug).toBe('javascript');
      expect(javascript?.slug).toBe('javascript');
      expect(js?.name).toBe('JavaScript');

      // Crucial assertion: Java is not JavaScript
      expect(java?.slug).not.toBe(javascript?.slug);
    });

    it('should resolve skill via API endpoint POST /api/skills/resolve', async () => {
      if (!dbAvailable) return;
      const res = await request(app).post('/api/skills/resolve').send({ query: 'React.js' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inMemoryMatch.slug).toBe('react');
      expect(res.body.data.resolvedSkill.name).toBe('React');
    });
  });

  describe('2. Student Profile Management', () => {
    it("should retrieve a student's own profile via GET /api/students/profile/me", async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/students/profile/me').set('Cookie', student1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.rollNumber).toBe('EV2026001');
      expect(res.body.data.profile.department).toBe('Information Technology');
      expect(res.body.data.metrics).toBeDefined();
    });

    it("should update a student's branch, graduation year, CGPA, and education history", async () => {
      if (!dbAvailable) return;

      const updates = {
        department: 'Artificial Intelligence & Data Science',
        graduationYear: 2027,
        cgpa: 8.95,
        bio: 'Aspiring ML and Systems engineer.',
        education: [
          {
            institution: 'Apex Model College',
            degree: 'Higher Secondary',
            fieldOfStudy: 'Science',
            startYear: 2020,
            endYear: 2022,
            scoreOrCgpa: '94%',
          },
          {
            institution: 'Apex Institute of Technology',
            degree: 'B.Tech',
            fieldOfStudy: 'Artificial Intelligence & Data Science',
            startYear: 2023,
            endYear: 2027,
            scoreOrCgpa: '8.95 CGPA',
          },
        ],
        links: {
          github: 'https://github.com/student1-updated',
        },
      };

      const res = await request(app)
        .put('/api/students/profile/me')
        .set('Cookie', student1Cookie)
        .send(updates);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.department).toBe('Artificial Intelligence & Data Science');
      expect(res.body.data.graduationYear).toBe(2027);
      expect(res.body.data.cgpa).toBe(8.95);
      expect(res.body.data.education).toHaveLength(2);
      expect(res.body.data.links.github).toBe('https://github.com/student1-updated');
    });

    it('should add a self-reported skill and mark status as self_reported', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/students/skills')
        .set('Cookie', student1Cookie)
        .send({
          name: 'ReactJS', // uses alias normalisation
          proficiency: 'advanced',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.skill.name).toBe('React');
      expect(res.body.data.status).toBe('self_reported');
      expect(res.body.data.isVerified).toBe(false);
    });
  });

  describe('3. Evidence Submission & Traceability', () => {
    let createdEvidenceId: string;

    it('should submit evidence record for React & Node.js skills', async () => {
      if (!dbAvailable) return;

      const payload = {
        type: 'github_repo',
        title: 'Fullstack Microservices Platform',
        description: 'Scalable service built using React and Node.js with distributed caching',
        url: 'https://github.com/student1/microservices',
        skills: ['React', 'Node.js'],
      };

      const res = await request(app)
        .post('/api/evidence')
        .set('Cookie', student1Cookie)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('submitted');
      expect(res.body.data.isVerified).toBe(false); // MUST NOT be verified automatically
      expect(res.body.data.skills).toHaveLength(2);

      createdEvidenceId = res.body.data._id;

      // Verify associated StudentSkill status updated to 'submitted'
      const reactSkill = await Skill.findOne({ slug: 'react' });
      const studentSkill = await StudentSkill.findOne({
        student: student1Profile._id,
        skill: reactSkill?._id,
      });
      expect(studentSkill?.status).toBe('submitted');
      expect(studentSkill?.isVerified).toBe(false); // A repo URL alone does not verify a skill!
    });

    it('should support various evidence types (coding_assessment, technical_quiz, evaluated_project, verified_certification)', async () => {
      if (!dbAvailable) return;

      const assessmentPayload = {
        type: 'coding_assessment',
        title: 'Algorithms & Data Structures Hackathon',
        url: 'https://hackerrank.com/certificates/12345',
        skills: ['Java'],
        metadata: { score: 98, total: 100 },
      };

      const res = await request(app)
        .post('/api/evidence')
        .set('Cookie', student1Cookie)
        .send(assessmentPayload);

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('coding_assessment');
      expect(res.body.data.status).toBe('submitted');
    });

    it("should list a student's own submitted evidence", async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/evidence').set('Cookie', student1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it("should support GET /api/evidence/me as alias for student's own evidence", async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/evidence/me').set('Cookie', student1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it("should disallow other students from viewing another student's evidence (Ownership Enforcement)", async () => {
      if (!dbAvailable) return;

      // Student 2 tries to access Student 1's evidence record
      const res = await request(app)
        .get(`/api/evidence/${createdEvidenceId}`)
        .set('Cookie', student2Cookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Placement Officer Evaluation & Verification Governance', () => {
    let evidenceToReviewId: string;

    beforeAll(async () => {
      if (!dbAvailable) return;

      // Submit specific evidence to be reviewed
      const res = await request(app)
        .post('/api/evidence')
        .set('Cookie', student1Cookie)
        .send({
          type: 'verified_certification',
          title: 'AWS Certified Cloud Practitioner',
          url: 'https://aws.amazon.com/verification/999',
          skills: ['AWS'],
        });

      evidenceToReviewId = res.body.data._id;
    });

    it('should prevent students from reviewing/approving evidence (403 Forbidden)', async () => {
      if (!dbAvailable) return;

      // Student 1 tries to approve their own evidence
      const res = await request(app)
        .post(`/api/evidence/${evidenceToReviewId}/review`)
        .set('Cookie', student1Cookie)
        .send({
          action: 'approve',
          notes: 'Self approval attempt',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should list pending evidence evaluations for placement officers', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/evidence/reviews/pending')
        .set('Cookie', officerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should allow placement officer to request additional evidence', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post(`/api/evidence/${evidenceToReviewId}/review`)
        .set('Cookie', officerCookie)
        .send({
          action: 'request_evidence',
          notes: 'Please attach the PDF credential certificate along with verification link.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('needs_additional_evidence');
      expect(res.body.data.isVerified).toBe(false);
      expect(res.body.data.auditHistory).toHaveLength(1);
      expect(res.body.data.auditHistory[0].toStatus).toBe('needs_additional_evidence');
    });

    it('should allow placement officer to approve evidence and transition skill to verified', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post(`/api/evidence/${evidenceToReviewId}/review`)
        .set('Cookie', officerCookie)
        .send({
          action: 'approve',
          notes: 'Official AWS badge validated successfully.',
          confidenceScore: 95,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('verified');
      expect(res.body.data.isVerified).toBe(true);
      expect(res.body.data.reviewedBy._id).toBe(officerUser._id.toString());
      expect(res.body.data.auditHistory).toHaveLength(2); // needs_additional_evidence -> verified

      // Check that the student's AWS skill transitioned to verified
      const awsSkill = await Skill.findOne({ slug: 'aws' });
      const studentSkill = await StudentSkill.findOne({
        student: student1Profile._id,
        skill: awsSkill?._id,
      });

      expect(studentSkill?.status).toBe('verified');
      expect(studentSkill?.isVerified).toBe(true);
      expect(studentSkill?.confidenceScore).toBe(95);
      expect(studentSkill?.verifiedAt).toBeDefined();
    });

    it('should allow placement officer to reject unverified/invalid evidence', async () => {
      if (!dbAvailable) return;

      // Submit an invalid evidence
      const submitRes = await request(app)
        .post('/api/evidence')
        .set('Cookie', student2Cookie)
        .send({
          type: 'github_repo',
          title: 'Empty Repository',
          url: 'https://github.com/student2/empty',
          skills: ['Python'],
        });

      const invalidEvidenceId = submitRes.body.data._id;

      const reviewRes = await request(app)
        .post(`/api/evidence/${invalidEvidenceId}/review`)
        .set('Cookie', officerCookie)
        .send({
          action: 'reject',
          notes: 'Repository contains only boilerplate README without substantial project code.',
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe('rejected');
      expect(reviewRes.body.data.isVerified).toBe(false);

      const pythonSkill = await Skill.findOne({ slug: 'python' });
      const studentSkill = await StudentSkill.findOne({
        student: student2Profile._id,
        skill: pythonSkill?._id,
      });
      expect(studentSkill?.status).toBe('rejected');
      expect(studentSkill?.isVerified).toBe(false);
    });
  });
});
