import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { config } from '../src/config/env';
import { User, IUser } from '../src/models/User';
import { Company, ICompany } from '../src/models/Company';
import { Job, IJob } from '../src/models/Job';
import { StudentProfile, IStudentProfile } from '../src/models/StudentProfile';
import { Evidence } from '../src/models/Evidence';
import { Skill, ISkill } from '../src/models/Skill';
import { StudentSkill } from '../src/models/StudentSkill';
import { Resume, IResume } from '../src/models/Resume';
import { Application, IApplication } from '../src/models/Application';
import { ApplicationStatusHistory } from '../src/models/ApplicationStatusHistory';
import { hashPassword } from '../src/utils/password';
import { seedCanonicalSkills } from '../src/utils/skillNormalizer';

describe('Recruiter Portal & Company Candidate Management Suite', () => {
  const app = createApp();
  let dbAvailable = false;

  let recruiter1User: IUser;
  let recruiter2User: IUser;
  let studentUser: IUser;
  let recruiter1Cookie: string[];
  let recruiter2Cookie: string[];
  let studentCookie: string[];

  let company1: ICompany;
  let company2: ICompany;
  let job1: IJob;
  let job2: IJob;
  let studentProfile: IStudentProfile;
  let studentResume: IResume;
  let application1: IApplication;

  const cleanup = async () => {
    if (!dbAvailable) return;
    const testUsers = await User.find({ email: { $regex: /@recruiter-test\.evidra\.dev$/ } });
    const userIds = testUsers.map((u) => u._id);

    const companies = await Company.find({ createdBy: { $in: userIds } });
    const companyIds = companies.map((c) => c._id);

    const profiles = await StudentProfile.find({ user: { $in: userIds } });
    const profileIds = profiles.map((p) => p._id);

    const jobs = await Job.find({ company: { $in: companyIds } });
    const jobIds = jobs.map((j) => j._id);

    await ApplicationStatusHistory.deleteMany({ changedBy: { $in: userIds } });
    await Application.deleteMany({
      $or: [{ student: { $in: profileIds } }, { job: { $in: jobIds } }],
    });
    await Resume.deleteMany({ student: { $in: profileIds } });
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

      const passwordHash = await hashPassword('Recruiter123!');

      // 1. Recruiter 1 (Acme Systems)
      recruiter1User = await User.create({
        email: 'recruiter1@recruiter-test.evidra.dev',
        passwordHash,
        role: 'recruiter',
        status: 'active',
        isEmailVerified: true,
      });

      // 2. Recruiter 2 (Beta Cloud)
      recruiter2User = await User.create({
        email: 'recruiter2@recruiter-test.evidra.dev',
        passwordHash,
        role: 'recruiter',
        status: 'active',
        isEmailVerified: true,
      });

      // 3. Student
      studentUser = await User.create({
        email: 'student@recruiter-test.evidra.dev',
        passwordHash,
        role: 'student',
        status: 'active',
        isEmailVerified: true,
      });

      // 4. Companies
      company1 = await Company.create({
        name: 'Acme Systems [RECRUITER_TEST]',
        industry: 'Enterprise Software',
        website: 'https://acme.test.evidra.dev',
        description: 'Building next-generation microservices.',
        isVerified: true,
        createdBy: recruiter1User._id,
        authorizedRecruiters: [recruiter1User._id as Types.ObjectId],
      });

      company2 = await Company.create({
        name: 'Beta Cloud [RECRUITER_TEST]',
        industry: 'Cloud Infrastructure',
        website: 'https://betacloud.test.evidra.dev',
        isVerified: true,
        createdBy: recruiter2User._id,
        authorizedRecruiters: [recruiter2User._id as Types.ObjectId],
      });

      // 5. Skills
      const reactSkill = (await Skill.findOne({ slug: 'react' }))!;
      const tsSkill = (await Skill.findOne({ slug: 'typescript' }))!;

      // 6. Jobs
      job1 = await Job.create({
        company: company1._id,
        postedBy: recruiter1User._id,
        title: 'Full Stack Engineer [RECRUITER_TEST]',
        description: 'Develop full stack web applications with React and TypeScript.',
        location: 'Bengaluru',
        workplaceType: 'hybrid',
        jobType: 'full_time',
        requiredSkills: [reactSkill._id, tsSkill._id],
        status: 'open',
        requisitionId: 'REQ-ACME-001',
      });

      job2 = await Job.create({
        company: company2._id,
        postedBy: recruiter2User._id,
        title: 'Cloud DevOps Engineer [RECRUITER_TEST]',
        description: 'Deploy Kubernetes clusters and AWS infrastructure.',
        location: 'Remote',
        workplaceType: 'remote',
        jobType: 'full_time',
        requiredSkills: [tsSkill._id],
        status: 'open',
        requisitionId: 'REQ-BETA-001',
      });

      // 7. Student Profile, Skills & Evidence
      studentProfile = await StudentProfile.create({
        user: studentUser._id,
        rollNumber: 'CS_REC_01',
        department: 'Computer Science',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.8,
      });

      const ev1 = await Evidence.create({
        student: studentProfile._id,
        skills: [reactSkill._id],
        type: 'evaluated_project',
        title: 'Full Stack React Platform',
        url: 'https://github.com/student/recruiter-react-platform',
        status: 'verified',
        isVerified: true,
        score: 90,
        maxScore: 100,
      });

      await StudentSkill.create({
        student: studentProfile._id,
        skill: reactSkill._id,
        proficiency: 'expert',
        status: 'verified',
        isVerified: true,
        confidenceScore: 90,
        evidence: [ev1._id],
      });

      // 8. Student Resume
      studentResume = await Resume.create({
        student: studentProfile._id,
        targetJob: job1._id,
        version: 1,
        title: 'Targeted Resume for Acme Systems',
        status: 'generated',
        sections: [
          {
            sectionId: 'sec-skills',
            title: 'Technical Skills',
            order: 1,
            bullets: [
              {
                bulletId: 'b1',
                text: 'Architected full stack React component systems.',
                validationStatus: 'SUPPORTED',
                evidenceIds: [ev1._id],
                skillIds: [reactSkill._id],
              },
            ],
          },
        ],
      });

      // 9. Application to Job 1 (Company 1)
      application1 = await Application.create({
        student: studentProfile._id,
        job: job1._id,
        canonicalJob: job1._id,
        resume: studentResume._id,
        resumeVersion: 1,
        currentStatus: 'APPLIED',
        appliedAt: new Date(),
      });

      await ApplicationStatusHistory.create({
        application: application1._id,
        fromStatus: null,
        toStatus: 'APPLIED',
        changedBy: studentUser._id,
        changedByRole: 'student',
        changedAt: new Date(),
      });

      // 10. Authenticate sessions
      const login1 = await request(app).post('/api/auth/login').send({
        email: 'recruiter1@recruiter-test.evidra.dev',
        password: 'Recruiter123!',
      });
      recruiter1Cookie = login1.headers['set-cookie'] as unknown as string[];

      const login2 = await request(app).post('/api/auth/login').send({
        email: 'recruiter2@recruiter-test.evidra.dev',
        password: 'Recruiter123!',
      });
      recruiter2Cookie = login2.headers['set-cookie'] as unknown as string[];

      const loginStudent = await request(app).post('/api/auth/login').send({
        email: 'student@recruiter-test.evidra.dev',
        password: 'Recruiter123!',
      });
      studentCookie = loginStudent.headers['set-cookie'] as unknown as string[];
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await cleanup();
      await disconnectDB();
    }
  });

  // =========================================================================
  // 1. COMPANY PROFILE MANAGEMENT
  // =========================================================================
  describe('1. Company Profile Management', () => {
    it('Recruiter can fetch their authorized company profile', async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/recruiter/company').set('Cookie', recruiter1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.company.name).toBe('Acme Systems [RECRUITER_TEST]');
      expect(res.body.data.company.industry).toBe('Enterprise Software');
    });

    it('Recruiter can update company description, website, and industry', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .put('/api/recruiter/company')
        .set('Cookie', recruiter1Cookie)
        .send({
          website: 'https://updated-acme.test.evidra.dev',
          description: 'Updated innovative enterprise platform description.',
          industry: 'Artificial Intelligence & SaaS',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.company.website).toBe('https://updated-acme.test.evidra.dev');
      expect(res.body.data.company.industry).toBe('Artificial Intelligence & SaaS');
    });

    it('Blocks unauthenticated or student users from recruiter endpoints', async () => {
      if (!dbAvailable) return;

      const resUnauth = await request(app).get('/api/recruiter/company');
      expect(resUnauth.status).toBe(401);

      const resStudent = await request(app)
        .get('/api/recruiter/company')
        .set('Cookie', studentCookie);
      expect(resStudent.status).toBe(403);
    });
  });

  // =========================================================================
  // 2. RECRUITER JOB MANAGEMENT
  // =========================================================================
  describe('2. Recruiter Job Management', () => {
    it('Recruiter receives their company job requisitions with application counts', async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/recruiter/jobs').set('Cookie', recruiter1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobs.length).toBeGreaterThanOrEqual(1);

      const matchedJob = res.body.data.jobs.find(
        (j: any) => j._id.toString() === job1._id.toString()
      );
      expect(matchedJob).toBeDefined();
      expect(matchedJob.title).toBe('Full Stack Engineer [RECRUITER_TEST]');
      expect(matchedJob.applicationsCount).toBe(1);
      expect(matchedJob.applicationsByStatus.APPLIED).toBe(1);
    });

    it('Recruiter 2 does not see Company 1 jobs in their requisition list', async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/recruiter/jobs').set('Cookie', recruiter2Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const company1Jobs = res.body.data.jobs.filter(
        (j: any) => j._id.toString() === job1._id.toString()
      );
      expect(company1Jobs.length).toBe(0);
    });
  });

  // =========================================================================
  // 3. RANKED APPLICANT SHORTLIST & CANDIDATE FIT EXPLANATIONS
  // =========================================================================
  describe('3. Ranked Applicant Shortlist & Fit Explanations', () => {
    it('Recruiter 1 can view ranked applicant shortlist with candidate fit scores', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/recruiter/jobs/${job1._id}/candidates`)
        .set('Cookie', recruiter1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.candidates.length).toBe(1);

      const candidate = res.body.data.candidates[0];
      expect(candidate.student.rollNumber).toBe('CS_REC_01');
      expect(candidate.currentStatus).toBe('APPLIED');
      expect(candidate.fitScore).toBeGreaterThan(0);
      expect(candidate.eligibility.status).toBe('MET');
      expect(candidate.supportedSkills.length).toBeGreaterThanOrEqual(1);
      expect(candidate.resumeVersion).toBe(1);
    });

    it('PREVENTS Recruiter 2 from viewing shortlist for Company 1 jobs (Access Scoping)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/recruiter/jobs/${job1._id}/candidates`)
        .set('Cookie', recruiter2Cookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 4. AUTHORIZED EVIDENCE & RESUME VIEWING
  // =========================================================================
  describe('4. Authorized Evidence and Resume Viewing', () => {
    it('Recruiter 1 can inspect verified evidence of candidate who applied to their job', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/recruiter/candidates/${studentProfile._id}/evidence`)
        .set('Cookie', recruiter1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.evidence.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.evidence[0].title).toBe('Full Stack React Platform');
    });

    it('PREVENTS Recruiter 2 from inspecting evidence of candidate who never applied to their company', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/recruiter/candidates/${studentProfile._id}/evidence`)
        .set('Cookie', recruiter2Cookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Recruiter 1 can download applicant ATS resume PDF', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/resumes/${studentResume._id}/pdf`)
        .set('Cookie', recruiter1Cookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.body).toBeDefined();
    });

    it('PREVENTS Recruiter 2 from downloading applicant resume PDF (Unapplied candidate)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get(`/api/resumes/${studentResume._id}/pdf`)
        .set('Cookie', recruiter2Cookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 5. PERMITTED APPLICATION STATUS UPDATES
  // =========================================================================
  describe('5. Permitted Application Status Updates', () => {
    it('Recruiter 1 advances applicant from APPLIED -> UNDER_REVIEW', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/applications/${application1._id}/status`)
        .set('Cookie', recruiter1Cookie)
        .send({
          status: 'UNDER_REVIEW',
          notes: 'Candidate meets primary skill benchmarks.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application.currentStatus).toBe('UNDER_REVIEW');
    });

    it('Recruiter 1 schedules interview (moves UNDER_REVIEW -> INTERVIEW)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/applications/${application1._id}/interview`)
        .set('Cookie', recruiter1Cookie)
        .send({
          round: 1,
          interviewType: 'technical',
          scheduledAt: '2026-12-01T10:00:00.000Z',
          meetingLink: 'https://meet.google.com/recruiter-test-call',
          interviewerName: 'Lead Architect',
          notes: 'Technical frontend architecture discussion',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application.currentStatus).toBe('INTERVIEW');
      expect(res.body.data.application.interviewDetails.interviewerName).toBe('Lead Architect');
    });

    it('PREVENTS Recruiter 2 from modifying status of Company 1 candidate', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/applications/${application1._id}/status`)
        .set('Cookie', recruiter2Cookie)
        .send({
          status: 'REJECTED',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});

