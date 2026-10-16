import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../src/app';
import { connectDB } from '../src/config/db';
import { User, IUser } from '../src/models/User';
import { StudentProfile, IStudentProfile } from '../src/models/StudentProfile';
import { StudentSkill } from '../src/models/StudentSkill';
import { Evidence } from '../src/models/Evidence';
import { Skill } from '../src/models/Skill';
import { Job } from '../src/models/Job';
import { Company } from '../src/models/Company';
import { Resume } from '../src/models/Resume';
import { ResumeClaim } from '../src/models/ResumeClaim';
import { hashPassword } from '../src/utils/password';
import { signAuthToken } from '../src/utils/token';
import { seedCanonicalSkills } from '../src/utils/skillNormalizer';
import { generateResumePdf } from '../src/utils/resumePdfGenerator';
import { extractTextFromPdf } from '../src/utils/pdfExtractor';
import { config } from '../src/config/env';

describe('Evidra Resume: Truthful Generation, Validation, & Audit', () => {
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

  let verifiedSkillNode: any;
  let verifiedSkillTs: any;
  let unverifiedSkillPython: any;
  let testEvidence: any;
  let testCompany: any;
  let testJob: any;

  const cleanup = async () => {
    if (!dbAvailable) return;
    const testUsers = await User.find({ email: { $regex: /@resume-test\.com$/ } });
    const userIds = testUsers.map((u) => u._id);
    const profiles = await StudentProfile.find({
      $or: [{ user: { $in: userIds } }, { rollNumber: { $in: ['RESUME202601', 'RESUME202602'] } }],
    });
    const profileIds = profiles.map((p) => p._id);

    await ResumeClaim.deleteMany({ student: { $in: profileIds } });
    await Resume.deleteMany({ student: { $in: profileIds } });
    await Evidence.deleteMany({ student: { $in: profileIds } });
    await StudentSkill.deleteMany({ student: { $in: profileIds } });
    await StudentProfile.deleteMany({ _id: { $in: profileIds } });
    await User.deleteMany({ _id: { $in: userIds } });
    if (testJob?._id) await Job.deleteOne({ _id: testJob._id });
    if (testCompany?._id) await Company.deleteOne({ _id: testCompany._id });
  };

  beforeAll(async () => {
    dbAvailable = await connectDB(config.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    if (dbAvailable) {
      await cleanup();
      await seedCanonicalSkills();

      const passwordHash = await hashPassword('Password123!');

      // Create Student 1
      student1User = await User.create({
        email: 'student1@resume-test.com',
        passwordHash,
        role: 'student',
        status: 'active',
      });
      student1Profile = await StudentProfile.create({
        user: student1User._id,
        rollNumber: 'RESUME202601',
        department: 'Computer Science',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.5,
      });
      const s1Token = signAuthToken({
        userId: student1User._id.toString(),
        role: 'student',
      });
      student1Cookie = [`${config.COOKIE_NAME}=${s1Token}; Path=/`];

      // Create Student 2 (isolation check)
      student2User = await User.create({
        email: 'student2@resume-test.com',
        passwordHash,
        role: 'student',
        status: 'active',
      });
      student2Profile = await StudentProfile.create({
        user: student2User._id,
        rollNumber: 'RESUME202602',
        department: 'Information Technology',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 7.9,
      });
      const s2Token = signAuthToken({
        userId: student2User._id.toString(),
        role: 'student',
      });
      student2Cookie = [`${config.COOKIE_NAME}=${s2Token}; Path=/`];

      // Create Placement Officer
      officerUser = await User.create({
        email: 'officer@resume-test.com',
        passwordHash,
        role: 'placement_officer',
        status: 'active',
      });
      const officerToken = signAuthToken({
        userId: officerUser._id.toString(),
        role: 'placement_officer',
      });
      officerCookie = [`${config.COOKIE_NAME}=${officerToken}; Path=/`];

      // Retrieve skills
      verifiedSkillNode = await Skill.findOne({ slug: 'nodejs' });
      verifiedSkillTs = await Skill.findOne({ slug: 'typescript' });
      unverifiedSkillPython = await Skill.findOne({ slug: 'python' });

      // Create verified evidence for Student 1
      testEvidence = await Evidence.create({
        student: student1Profile._id,
        title: 'Distributed Backend Microservice',
        description: 'Built high-throughput API with Node.js and TypeScript',
        type: 'github_repo',
        url: 'https://github.com/student1/microservice',
        status: 'verified',
        verificationScore: 95,
        skills: [verifiedSkillNode._id, verifiedSkillTs._id],
        verifiedAt: new Date(),
        verifiedBy: officerUser._id,
      });

      // Link verified skills to Student 1
      await StudentSkill.create({
        student: student1Profile._id,
        skill: verifiedSkillNode._id,
        level: 'proficient',
        isVerified: true,
        primaryEvidence: testEvidence._id,
        supportingEvidence: [testEvidence._id],
        evidence: [testEvidence._id],
      });

      await StudentSkill.create({
        student: student1Profile._id,
        skill: verifiedSkillTs._id,
        level: 'proficient',
        isVerified: true,
        primaryEvidence: testEvidence._id,
        supportingEvidence: [testEvidence._id],
        evidence: [testEvidence._id],
      });

      // Student 1 has an unverified self-reported skill (Python) without evidence
      await StudentSkill.create({
        student: student1Profile._id,
        skill: unverifiedSkillPython._id,
        level: 'beginner',
        isVerified: false,
        supportingEvidence: [],
        evidence: [],
      });

      // Create Company & target Job
      testCompany = await Company.create({
        name: 'Cloud Corp',
        industry: 'Cloud Computing',
        createdBy: officerUser._id,
      });

      testJob = await Job.create({
        company: testCompany._id,
        postedBy: officerUser._id,
        title: 'Backend Systems Engineer',
        description: 'Design robust distributed microservices using Node.js & TypeScript',
        requiredSkills: [verifiedSkillNode._id, verifiedSkillTs._id],
        location: 'Bengaluru',
        workplaceType: 'hybrid',
        jobType: 'full_time',
        status: 'open',
      });
    }
  });

  afterAll(async () => {
    await cleanup();
  });

  // 1. PDF Generation & Selectable Text (Pure unit test, independent of DB)
  describe('PDF Generation & Selectable Text Unit Tests', () => {
    it('generates a selectable-text PDF with valid %PDF header and non-empty buffer', async () => {
      const mockResume: any = {
        _id: '660e1d5e3f1b2c001f8a9999',
        title: 'Test ATS Resume',
        version: 1,
        contactDetails: {
          fullName: 'Siddharth Candidate',
          email: 'siddharth@example.com',
          phone: '+91 9876543210',
          location: 'Bengaluru, India',
          degree: 'B.Tech Computer Science',
          department: 'CSE',
          cgpa: 8.9,
          links: [
            { label: 'GitHub', url: 'https://github.com/siddharth' },
            { label: 'LinkedIn', url: 'https://linkedin.com/in/siddharth' },
          ],
        },
        targetRole: 'Backend Engineer',
        summary: 'Factual summary grounded in verified technical projects.',
        skills: [
          {
            category: 'Backend & APIs',
            skills: [
              { name: 'Node.js', isVerified: true },
              { name: 'TypeScript', isVerified: true },
            ],
          },
        ],
        projects: [
          {
            title: 'High Throughput Message Broker',
            description: 'Distributed event bus',
            technologies: ['Node.js', 'TypeScript', 'Redis'],
            bullets: [
              {
                text: 'Engineered event bus with sub-10ms delivery latency',
                isVerified: true,
              },
            ],
          },
        ],
        education: [
          {
            institution: 'National Institute of Technology',
            degree: 'B.Tech Computer Science',
            graduationYear: 2026,
            cgpa: 8.9,
          },
        ],
      };

      const buffer = await generateResumePdf(mockResume);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);

      // Verify %PDF- magic bytes
      const magic = buffer.subarray(0, 5).toString('ascii');
      expect(magic).toBe('%PDF-');

      // Verify selectable text extraction
      const extracted = await extractTextFromPdf(buffer);
      expect(extracted.text).toContain('Siddharth Candidate');
      expect(extracted.text).toContain('Node.js');
      expect(extracted.text).toContain('High Throughput Message Broker');
      expect(extracted.text).toContain('National Institute of Technology');
      expect(extracted.numPages).toBeGreaterThanOrEqual(1);
    });
  });

  // 2. Upload Restrictions
  describe('Upload Restrictions & File Validation', () => {
    it('validates PDF magic bytes and rejects invalid or empty buffers in parser', async () => {
      await expect(extractTextFromPdf(Buffer.from(''))).rejects.toThrow(/PDF buffer is empty/);
      await expect(
        extractTextFromPdf(Buffer.from('This is not a real PDF document.'))
      ).rejects.toThrow(/Not a valid PDF document/);
    });

    it('rejects non-PDF file upload with 400 Bad Request', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .post('/api/resumes/upload-and-analyze')
        .set('Cookie', student1Cookie)
        .attach('file', Buffer.from('console.log("hello world");'), 'script.js');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/only pdf documents are supported/i);
    });

    it('rejects files exceeding 5MB limit with 400 Bad Request', async () => {
      if (!dbAvailable) return;
      // 5.5 MB dummy buffer
      const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0x25); // filled with '%'
      const res = await request(app)
        .post('/api/resumes/upload-and-analyze')
        .set('Cookie', student1Cookie)
        .attach('file', largeBuffer, 'massive_resume.pdf');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exceeds maximum permitted limit of 5mb/i);
    });

    it('rejects corrupted or empty file buffers lacking %PDF magic bytes', async () => {
      if (!dbAvailable) return;
      const corruptBuffer = Buffer.from('This is not a real PDF document.');
      const res = await request(app)
        .post('/api/resumes/upload-and-analyze')
        .set('Cookie', student1Cookie)
        .attach('file', corruptBuffer, 'fake.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toMatch(/not a valid pdf document/i);
    });
  });

  // 3. Permissions & Private Document Access
  describe('Permissions & Access Control', () => {
    it('denies unauthenticated requests to resume endpoints with 401', async () => {
      const res = await request(app).get('/api/resumes/me');
      expect(res.status).toBe(401);
    });

    it('prevents Student 2 from viewing or downloading Student 1 resume PDF with 403', async () => {
      if (!dbAvailable) return;

      // Create a test resume owned by Student 1
      const s1Resume = await Resume.create({
        student: student1Profile._id,
        title: 'Student 1 Private Resume',
        version: 1,
        status: 'generated',
        isPrimary: true,
        contact: {
          fullName: 'Student 1',
          email: 'student1@resume-test.com',
          degree: 'B.Tech',
          department: 'CSE',
        },
      });

      // Student 2 attempts to download Student 1's PDF
      const pdfRes = await request(app)
        .get(`/api/resumes/${s1Resume._id}/pdf`)
        .set('Cookie', student2Cookie);
      expect(pdfRes.status).toBe(403);

      // Student 2 attempts to get Student 1's provenance
      const provRes = await request(app)
        .get(`/api/resumes/${s1Resume._id}/provenance`)
        .set('Cookie', student2Cookie);
      expect(provRes.status).toBe(403);
    });

    it('allows Placement Officer to review flagged claims and verify them', async () => {
      if (!dbAvailable) return;

      const claim = await ResumeClaim.create({
        resume: new Types.ObjectId(),
        student: student1Profile._id,
        claimType: 'skill',
        text: 'AWS Cloud Architecture',
        extractedText: 'AWS Cloud Architecture',
        validationStatus: 'NEEDS_REVIEW',
        explanation: 'Awaiting faculty review',
        isVerified: false,
        confidenceScore: 50,
      });

      // Officer views claims
      const listRes = await request(app).get('/api/resumes/claims').set('Cookie', officerCookie);
      expect(listRes.status).toBe(200);

      // Officer verifies claim
      const verifyRes = await request(app)
        .post(`/api/resumes/claims/${claim._id}/verify`)
        .set('Cookie', officerCookie)
        .send({
          isVerified: true,
          confidenceScore: 95,
          notes: 'Verified via certified AWS Cloud Practitioner badge.',
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.isVerified).toBe(true);
      expect(verifyRes.body.data.validationStatus).toBe('SUPPORTED');
    });
  });

  // 4. Truthful Resume Generation, Monotonic Versioning, & Evidence Traceability
  describe('Resume Generation & Versioning', () => {
    it('monotonically increments resume version (v1, v2) for the student', async () => {
      if (!dbAvailable) return;

      // Clean up previous test resumes for Student 1 so count starts at 0
      await Resume.deleteMany({ student: student1Profile._id });

      // Generate v1
      const gen1 = await request(app)
        .post('/api/resumes/generate')
        .set('Cookie', student1Cookie)
        .send({
          jobId: testJob._id.toString(),
          targetRole: 'Backend Engineer',
          title: 'Tailored Resume 1',
        });

      expect(gen1.status).toBe(201);
      expect(gen1.body.data.resume.version).toBe(1);

      // Generate v2
      const gen2 = await request(app)
        .post('/api/resumes/generate')
        .set('Cookie', student1Cookie)
        .send({
          jobId: testJob._id.toString(),
          targetRole: 'Senior Backend Engineer',
          title: 'Tailored Resume 2',
        });

      expect(gen2.status).toBe(201);
      expect(gen2.body.data.resume.version).toBe(2);
    });

    it('omits unsupported self-reported claims and records explicit exclusion reasons', async () => {
      if (!dbAvailable) return;

      const genRes = await request(app)
        .post('/api/resumes/generate')
        .set('Cookie', student1Cookie)
        .send({
          targetRole: 'Fullstack Engineer',
          title: 'Omission Test Resume',
        });

      expect(genRes.status).toBe(201);
      const { resume, excludedItems } = genRes.body.data;

      // Python was unverified in student profile; ensure it was excluded
      const pythonExcluded = excludedItems.find((item: any) =>
        item.text.toLowerCase().includes('python')
      );
      expect(pythonExcluded).toBeDefined();
      expect(pythonExcluded.reason).toMatch(
        /omitted from ats resume:.*faculty\/institutional evidence in vault/i
      );

      // Verify that skills included in resume only contain verified ones
      const includedSkillNames = (resume.skills || []).flatMap((cat: any) =>
        cat.skills.map((s: any) => s.name.toLowerCase())
      );

      expect(includedSkillNames).toContain('node.js');
      expect(includedSkillNames).not.toContain('python');
    });

    it('associates generated bullets with exact evidence provenance and provides provenance API', async () => {
      if (!dbAvailable) return;

      const genRes = await request(app)
        .post('/api/resumes/generate')
        .set('Cookie', student1Cookie)
        .send({
          jobId: testJob._id.toString(),
          targetRole: 'Backend Systems Engineer',
          title: 'Provenance Test Resume',
        });

      expect(genRes.status).toBe(201);
      const resumeId = genRes.body.data.resume._id;

      // Query Provenance API
      const provRes = await request(app)
        .get(`/api/resumes/${resumeId}/provenance`)
        .set('Cookie', student1Cookie);

      expect(provRes.status).toBe(200);
      expect(provRes.body.data.resumeId).toBe(resumeId);

      const bulletsProvenance = provRes.body.data.bulletsProvenance;
      expect(bulletsProvenance.length).toBeGreaterThan(0);

      const supportedBullet = bulletsProvenance.find(
        (b: any) => b.validationStatus === 'SUPPORTED'
      );
      expect(supportedBullet).toBeDefined();
      expect(supportedBullet.evidence).toBeDefined();
      expect(supportedBullet.evidence.length).toBeGreaterThan(0);
      expect(supportedBullet.evidence[0].title).toBe('Distributed Backend Microservice');
    });

    it('downloads ATS-friendly selectable text PDF via authenticated endpoint', async () => {
      if (!dbAvailable) return;

      const genRes = await request(app)
        .post('/api/resumes/generate')
        .set('Cookie', student1Cookie)
        .send({
          targetRole: 'Backend Engineer',
          title: 'Downloadable ATS Resume',
        });

      const resumeId = genRes.body.data.resume._id;

      const pdfRes = await request(app)
        .get(`/api/resumes/${resumeId}/pdf`)
        .set('Cookie', student1Cookie);

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(pdfRes.headers['content-disposition']).toMatch(/inline; filename=.*\.pdf/);

      const magic = pdfRes.body.subarray(0, 5).toString('ascii');
      expect(magic).toBe('%PDF-');
    });
  });

  // 5. Uploaded Resume Claim Auditing, Anti-Prejudice Rule, & Student Actions
  describe('Uploaded Resume Claim Analysis & Student Actions', () => {
    it('classifies direct academic conflicts as CONTRADICTED and unverified skills as UNSUPPORTED without bias', async () => {
      if (!dbAvailable) return;

      // Student 1 verified CGPA is 8.5
      const uploadText = `
        Candidate Profile:
        Graduated with B.Tech Computer Science with 9.9 CGPA.
        Proficient in Node.js, TypeScript, and Docker.
      `;

      const uploadRes = await request(app)
        .post('/api/resumes/upload-and-analyze')
        .set('Cookie', student1Cookie)
        .send({
          text: uploadText,
          title: 'Contradiction & Evidence Check',
        });

      expect(uploadRes.status).toBe(201);
      const { claims, stats } = uploadRes.body.data;

      // CGPA 9.9 contradicts verified record 8.5
      const cgpaClaim = claims.find((c: any) => c.claimType === 'education');
      expect(cgpaClaim).toBeDefined();
      expect(cgpaClaim.validationStatus).toBe('CONTRADICTED');
      expect(cgpaClaim.explanation).toMatch(
        /contradiction: resume claims cgpa 9.90.*conflicts with official/i
      );

      // Node.js is verified in vault -> SUPPORTED
      const nodeClaim = claims.find((c: any) => c.text.toLowerCase().includes('node.js'));
      expect(nodeClaim).toBeDefined();
      expect(nodeClaim.validationStatus).toBe('SUPPORTED');

      // Docker has no evidence in vault -> UNSUPPORTED (anti-prejudice rule: NOT contradicted)
      const dockerClaim = claims.find((c: any) => c.text.toLowerCase().includes('docker'));
      expect(dockerClaim).toBeDefined();
      expect(dockerClaim.validationStatus).toBe('UNSUPPORTED');
      expect(dockerClaim.explanation).toMatch(
        /unsupported:.*missing evidence does not imply false claim/i
      );
    });

    it('allows student to correct claim, link evidence, and remove claim', async () => {
      if (!dbAvailable) return;

      const uploadRes = await request(app)
        .post('/api/resumes/upload-and-analyze')
        .set('Cookie', student1Cookie)
        .send({
          text: 'Expert in Docker containerization and Kubernetes orchestration.',
          title: 'Interactive Claim Lifecycle',
        });

      expect(uploadRes.status).toBe(201);
      const claim = uploadRes.body.data.claims[0];
      expect(claim).toBeDefined();

      // 1. Correct claim
      const correctRes = await request(app)
        .patch(`/api/resumes/claims/${claim._id}`)
        .set('Cookie', student1Cookie)
        .send({
          correctedText: 'Familiar with Docker fundamentals and containerized Node.js deployments.',
        });

      expect(correctRes.status).toBe(200);
      expect(correctRes.body.data.correctedText).toBe(
        'Familiar with Docker fundamentals and containerized Node.js deployments.'
      );

      // 2. Link evidence from vault
      const linkRes = await request(app)
        .post(`/api/resumes/claims/${claim._id}/link-evidence`)
        .set('Cookie', student1Cookie)
        .send({
          evidenceId: testEvidence._id.toString(),
        });

      expect(linkRes.status).toBe(200);
      expect(linkRes.body.data.validationStatus).toBe('SUPPORTED');
      expect(linkRes.body.data.isVerified).toBe(true);

      // 3. Delete claim
      const deleteRes = await request(app)
        .delete(`/api/resumes/claims/${claim._id}`)
        .set('Cookie', student1Cookie);

      expect(deleteRes.status).toBe(200);

      // Verify removal
      const checkClaim = await ResumeClaim.findById(claim._id);
      expect(checkClaim).toBeNull();
    });
  });
});
