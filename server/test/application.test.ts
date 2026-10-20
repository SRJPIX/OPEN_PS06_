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
import { Resume, IResume } from '../src/models/Resume';
import { Application, ApplicationStatus } from '../src/models/Application';
import { ApplicationStatusHistory } from '../src/models/ApplicationStatusHistory';
import { hashPassword } from '../src/utils/password';
import { signAuthToken } from '../src/utils/token';
import {
  canTransitionStatus,
  resolveCanonicalJobId,
  VALID_STATUS_TRANSITIONS,
  calculateStudentDashboardMetrics,
  calculatePlacementDashboardMetrics,
} from '../src/utils/applicationWorkflow';
import { exportApplicationsToCsv } from '../src/utils/applicationCsvExporter';
import { isAuthorizedForCompany } from '../src/controllers/application.controller';
import { updateApplicationStatusSchema } from '../src/validators/application.validator';

describe('Placement Application Pipeline & Tracking System', () => {
  const app = createApp();
  let dbAvailable = false;

  let officerUser: IUser;
  let officerCookie: string[];

  let recruiter1User: IUser;
  let recruiter1Cookie: string[];
  let company1: ICompany;

  let recruiter2User: IUser;
  let recruiter2Cookie: string[];
  let company2: ICompany;

  let student1User: IUser;
  let student1Profile: IStudentProfile;
  let student1Cookie: string[];
  let student1ApprovedResume: IResume;
  let student1DraftResume: IResume;

  let student2User: IUser;
  let student2Profile: IStudentProfile;
  let student2Cookie: string[];
  let student2ApprovedResume: IResume;

  let openJob1: IJob;
  let duplicateJob1: IJob;
  let archivedJob: IJob;
  let company2Job: IJob;

  const cleanup = async () => {
    if (!dbAvailable) return;
    const testUsers = await User.find({ email: { $regex: /@app-pipeline-test\.com$/ } });
    const userIds = testUsers.map((u) => u._id);

    const companies = await Company.find({ createdBy: { $in: userIds } });
    const companyIds = companies.map((c) => c._id);

    const profiles = await StudentProfile.find({ user: { $in: userIds } });
    const profileIds = profiles.map((p) => p._id);

    const jobs = await Job.find({ company: { $in: companyIds } });
    const jobIds = jobs.map((j) => j._id);

    await ApplicationStatusHistory.deleteMany({ changedBy: { $in: userIds } });
    await Application.deleteMany({ $or: [{ student: { $in: profileIds } }, { job: { $in: jobIds } }] });
    await Resume.deleteMany({ student: { $in: profileIds } });
    await StudentProfile.deleteMany({ _id: { $in: profileIds } });
    await Job.deleteMany({ company: { $in: companyIds } });
    await Company.deleteMany({ _id: { $in: companyIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  };

  beforeAll(async () => {
    dbAvailable = await connectDB(config.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });

    if (dbAvailable) {
      await cleanup();

      const passwordHash = await hashPassword('PipelinePass123!');

      // 1. Placement Officer
      officerUser = await User.create({
        email: 'officer@app-pipeline-test.com',
        passwordHash,
        role: 'placement_officer',
        status: 'active',
      });
      const oToken = signAuthToken({ userId: officerUser._id.toString(), role: 'placement_officer' });
      officerCookie = [`${config.COOKIE_NAME}=${oToken}; Path=/`];

      // 2. Recruiter 1 (Company 1)
      recruiter1User = await User.create({
        email: 'recruiter1@app-pipeline-test.com',
        passwordHash,
        role: 'recruiter',
        status: 'active',
      });
      const r1Token = signAuthToken({ userId: recruiter1User._id.toString(), role: 'recruiter' });
      recruiter1Cookie = [`${config.COOKIE_NAME}=${r1Token}; Path=/`];

      company1 = await Company.create({
        name: 'Apex Systems Global',
        industry: 'Software Engineering',
        isVerified: true,
        createdBy: recruiter1User._id,
      });

      // 3. Recruiter 2 (Company 2)
      recruiter2User = await User.create({
        email: 'recruiter2@app-pipeline-test.com',
        passwordHash,
        role: 'recruiter',
        status: 'active',
      });
      const r2Token = signAuthToken({ userId: recruiter2User._id.toString(), role: 'recruiter' });
      recruiter2Cookie = [`${config.COOKIE_NAME}=${r2Token}; Path=/`];

      company2 = await Company.create({
        name: 'Horizon Biotech',
        industry: 'Biotechnology',
        isVerified: true,
        createdBy: recruiter2User._id,
      });

      // 4. Student 1
      student1User = await User.create({
        email: 'student1@app-pipeline-test.com',
        passwordHash,
        role: 'student',
        status: 'active',
      });
      student1Profile = await StudentProfile.create({
        user: student1User._id,
        rollNumber: 'CS2026_01',
        department: 'Computer Science',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.9,
      });
      const s1Token = signAuthToken({ userId: student1User._id.toString(), role: 'student' });
      student1Cookie = [`${config.COOKIE_NAME}=${s1Token}; Path=/`];

      // Student 1 approved resume (generated)
      student1ApprovedResume = await Resume.create({
        student: student1Profile._id,
        title: 'Full Stack Engineer Resume',
        version: 1,
        targetRole: 'Full Stack Developer',
        status: 'generated',
        isPrimary: true,
      });

      // Student 1 unapproved draft resume
      student1DraftResume = await Resume.create({
        student: student1Profile._id,
        title: 'Draft Unapproved Resume',
        version: 2,
        status: 'draft',
        isPrimary: false,
      });

      // 5. Student 2
      student2User = await User.create({
        email: 'student2@app-pipeline-test.com',
        passwordHash,
        role: 'student',
        status: 'active',
      });
      student2Profile = await StudentProfile.create({
        user: student2User._id,
        rollNumber: 'IT2026_02',
        department: 'Information Technology',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.5,
      });
      const s2Token = signAuthToken({ userId: student2User._id.toString(), role: 'student' });
      student2Cookie = [`${config.COOKIE_NAME}=${s2Token}; Path=/`];

      student2ApprovedResume = await Resume.create({
        student: student2Profile._id,
        title: 'DevOps Specialist Resume',
        version: 1,
        status: 'verified',
        isPrimary: true,
      });

      // 6. Jobs
      openJob1 = await Job.create({
        company: company1._id,
        title: 'Software Development Engineer',
        description: 'Design and implement scalable microservices using Node.js and TypeScript.',
        location: 'Bengaluru',
        workplaceType: 'hybrid',
        jobType: 'full_time',
        status: 'open',
        postedBy: recruiter1User._id,
      });

      duplicateJob1 = await Job.create({
        company: company1._id,
        title: 'Software Development Engineer - Duplicate Posting',
        description: 'Cross-listed duplicate posting.',
        location: 'Bengaluru',
        workplaceType: 'hybrid',
        jobType: 'full_time',
        status: 'archived',
        postedBy: recruiter1User._id,
        duplicateOf: openJob1._id,
      });

      archivedJob = await Job.create({
        company: company1._id,
        title: 'Archived Systems Engineer',
        description: 'Previously closed role.',
        location: 'Hyderabad',
        workplaceType: 'on_site',
        jobType: 'full_time',
        status: 'archived',
        postedBy: recruiter1User._id,
      });

      company2Job = await Job.create({
        company: company2._id,
        title: 'Bioinformatics Analyst',
        description: 'Genomic data pipeline processing.',
        location: 'Remote',
        workplaceType: 'remote',
        jobType: 'full_time',
        status: 'open',
        postedBy: recruiter2User._id,
      });
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await cleanup();
      await disconnectDB();
    }
  });

  // =========================================================================
  // 1. WORKFLOW STATE MACHINE & TRANSITION RULES (Unit Tests)
  // =========================================================================
  describe('1. Workflow State Machine & Transition Rules', () => {
    it('defines valid forward transitions for canonical statuses', () => {
      expect(VALID_STATUS_TRANSITIONS.APPLIED).toEqual(['UNDER_REVIEW', 'REJECTED', 'WITHDRAWN']);
      expect(VALID_STATUS_TRANSITIONS.UNDER_REVIEW).toEqual(['INTERVIEW', 'REJECTED', 'WITHDRAWN']);
      expect(VALID_STATUS_TRANSITIONS.INTERVIEW).toEqual(['OFFER', 'REJECTED', 'UNDER_REVIEW', 'WITHDRAWN']);
      expect(VALID_STATUS_TRANSITIONS.OFFER).toEqual(['REJECTED', 'WITHDRAWN']);
      expect(VALID_STATUS_TRANSITIONS.REJECTED).toEqual([]);
      expect(VALID_STATUS_TRANSITIONS.WITHDRAWN).toEqual([]);
    });

    it('allows placement officer to advance APPLIED -> UNDER_REVIEW -> INTERVIEW -> OFFER', () => {
      const step1 = canTransitionStatus('APPLIED', 'UNDER_REVIEW', 'placement_officer');
      expect(step1.valid).toBe(true);

      const step2 = canTransitionStatus('UNDER_REVIEW', 'INTERVIEW', 'placement_officer');
      expect(step2.valid).toBe(true);

      const step3 = canTransitionStatus('INTERVIEW', 'OFFER', 'placement_officer');
      expect(step3.valid).toBe(true);
    });

    it('allows placement officer to reject application from APPLIED, UNDER_REVIEW, INTERVIEW, or OFFER', () => {
      expect(canTransitionStatus('APPLIED', 'REJECTED', 'placement_officer').valid).toBe(true);
      expect(canTransitionStatus('UNDER_REVIEW', 'REJECTED', 'placement_officer').valid).toBe(true);
      expect(canTransitionStatus('INTERVIEW', 'REJECTED', 'placement_officer').valid).toBe(true);
      expect(canTransitionStatus('OFFER', 'REJECTED', 'placement_officer').valid).toBe(true);
    });

    it('REJECTS invalid forward jumps (APPLIED -> OFFER directly without review)', () => {
      const check = canTransitionStatus('APPLIED', 'OFFER', 'placement_officer');
      expect(check.valid).toBe(false);
      expect(check.message).toContain('Invalid status transition');
    });

    it('REJECTS transitions from terminal status REJECTED', () => {
      const check1 = canTransitionStatus('REJECTED', 'OFFER', 'placement_officer');
      expect(check1.valid).toBe(false);
      expect(check1.message).toContain('Terminal states cannot be changed');

      const check2 = canTransitionStatus('REJECTED', 'INTERVIEW', 'recruiter');
      expect(check2.valid).toBe(false);
    });

    it('REJECTS transitions from terminal status WITHDRAWN', () => {
      const check1 = canTransitionStatus('WITHDRAWN', 'OFFER', 'placement_officer');
      expect(check1.valid).toBe(false);
      expect(check1.message).toContain('Terminal states cannot be changed');

      const check2 = canTransitionStatus('WITHDRAWN', 'APPLIED', 'student');
      expect(check2.valid).toBe(false);
    });

    it('REJECTS backward transition from OFFER -> APPLIED or UNDER_REVIEW -> APPLIED', () => {
      const check1 = canTransitionStatus('OFFER', 'APPLIED', 'placement_officer');
      expect(check1.valid).toBe(false);

      const check2 = canTransitionStatus('UNDER_REVIEW', 'APPLIED', 'placement_officer');
      expect(check2.valid).toBe(false);
    });

    it('REJECTS transition if target status equals current status', () => {
      const check = canTransitionStatus('INTERVIEW', 'INTERVIEW', 'placement_officer');
      expect(check.valid).toBe(false);
      expect(check.message).toContain('already in status');
    });

    it('validates status payloads using either status or toStatus fields', () => {
      const parsedWithStatus = updateApplicationStatusSchema.safeParse({
        status: 'UNDER_REVIEW',
        notes: 'Ready for recruiter review',
      });
      expect(parsedWithStatus.success).toBe(true);
      if (parsedWithStatus.success) {
        expect(parsedWithStatus.data.status).toBe('UNDER_REVIEW');
      }

      const parsedWithToStatus = updateApplicationStatusSchema.safeParse({
        toStatus: 'INTERVIEW',
        notes: 'Advancing to interview round',
      });
      expect(parsedWithToStatus.success).toBe(true);
      if (parsedWithToStatus.success) {
        expect(parsedWithToStatus.data.status).toBe('INTERVIEW');
      }
    });
  });

  // =========================================================================
  // 2. ROLE PERMISSION INVARIANTS (Unit Tests)
  // =========================================================================
  describe('2. Role Permission Invariants', () => {
    it('PREVENTS students from granting themselves INTERVIEW or OFFER status (Req #7)', () => {
      const interviewCheck = canTransitionStatus('APPLIED', 'INTERVIEW', 'student');
      expect(interviewCheck.valid).toBe(false);
      expect(interviewCheck.message).toContain('Students are strictly forbidden');

      const offerCheck = canTransitionStatus('UNDER_REVIEW', 'OFFER', 'student');
      expect(offerCheck.valid).toBe(false);
      expect(offerCheck.message).toContain('Students are strictly forbidden');

      const reviewCheck = canTransitionStatus('APPLIED', 'UNDER_REVIEW', 'student');
      expect(reviewCheck.valid).toBe(false);
    });

    it('PERMITS students only to transition an active application to WITHDRAWN', () => {
      expect(canTransitionStatus('APPLIED', 'WITHDRAWN', 'student').valid).toBe(true);
      expect(canTransitionStatus('UNDER_REVIEW', 'WITHDRAWN', 'student').valid).toBe(true);
      expect(canTransitionStatus('INTERVIEW', 'WITHDRAWN', 'student').valid).toBe(true);
      expect(canTransitionStatus('OFFER', 'WITHDRAWN', 'student').valid).toBe(true);
    });

    it('PREVENTS recruiters from withdrawing on behalf of students', () => {
      const check = canTransitionStatus('APPLIED', 'WITHDRAWN', 'recruiter');
      expect(check.valid).toBe(false);
      expect(check.message).toContain('Recruiters cannot withdraw');
    });

    it('enforces company authorization scoping for recruiters (isAuthorizedForCompany)', () => {
      const mockRecruiterId = new Types.ObjectId().toString();
      const mockOtherRecruiterId = new Types.ObjectId().toString();

      const authorizedCompany = {
        createdBy: mockRecruiterId,
        authorizedRecruiters: [],
      } as any;

      const nonAuthorizedCompany = {
        createdBy: mockOtherRecruiterId,
        authorizedRecruiters: [new Types.ObjectId().toString()],
      } as any;

      // Recruiter authorized for own company
      expect(isAuthorizedForCompany(mockRecruiterId, 'recruiter', authorizedCompany)).toBe(true);

      // Recruiter NOT authorized for other company
      expect(isAuthorizedForCompany(mockRecruiterId, 'recruiter', nonAuthorizedCompany)).toBe(false);

      // Placement officer authorized for ANY company
      expect(isAuthorizedForCompany(mockRecruiterId, 'placement_officer', nonAuthorizedCompany)).toBe(true);

      // Admin authorized for ANY company
      expect(isAuthorizedForCompany(mockRecruiterId, 'admin', nonAuthorizedCompany)).toBe(true);
    });
  });

  // =========================================================================
  // 3. CANONICAL JOB DEDUPLICATION & RESUME VERSION CONSISTENCY (Unit Tests)
  // =========================================================================
  describe('3. Canonical Job Deduplication & Resume Version Consistency', () => {
    it('correctly resolves canonical job ID when duplicateOf is present vs absent', () => {
      const canonicalId = new Types.ObjectId();
      const duplicateId = new Types.ObjectId();

      const standaloneJob = { _id: canonicalId };
      expect(resolveCanonicalJobId(standaloneJob).toString()).toBe(canonicalId.toString());

      const duplicateJob = { _id: duplicateId, duplicateOf: canonicalId };
      expect(resolveCanonicalJobId(duplicateJob).toString()).toBe(canonicalId.toString());
    });

    it('stores exact submitted resume version and snapshot fields', () => {
      const mockResumeId = new Types.ObjectId();
      const mockProfileId = new Types.ObjectId();
      const mockJobId = new Types.ObjectId();

      const app = new Application({
        student: mockProfileId,
        job: mockJobId,
        resume: mockResumeId,
        resumeVersion: 1,
        resumeSnapshot: {
          resumeId: mockResumeId,
          version: 1,
          title: 'Full Stack Engineer v1',
          summary: 'Expert in Node and React',
          targetRole: 'Full Stack Developer',
          submittedAt: new Date(),
        },
        currentStatus: 'APPLIED',
      });

      expect(app.resumeVersion).toBe(1);
      expect(app.resumeSnapshot?.title).toBe('Full Stack Engineer v1');
      expect(app.resumeSnapshot?.version).toBe(1);
    });
  });

  // =========================================================================
  // 4. DASHBOARD STATISTICS & RFC 4180 CSV EXPORT (Unit Tests)
  // =========================================================================
  describe('4. Dashboard Statistics & RFC 4180 CSV Export', () => {
    it('computes accurate student dashboard statistics', () => {
      const mockApps = [
        { currentStatus: 'APPLIED' as ApplicationStatus },
        { currentStatus: 'UNDER_REVIEW' as ApplicationStatus },
        { currentStatus: 'INTERVIEW' as ApplicationStatus },
        { currentStatus: 'OFFER' as ApplicationStatus },
        { currentStatus: 'REJECTED' as ApplicationStatus },
        { currentStatus: 'WITHDRAWN' as ApplicationStatus },
      ];

      const stats = calculateStudentDashboardMetrics(mockApps);

      expect(stats.totalApplications).toBe(6);
      expect(stats.byStatus.APPLIED).toBe(1);
      expect(stats.byStatus.UNDER_REVIEW).toBe(1);
      expect(stats.byStatus.INTERVIEW).toBe(1);
      expect(stats.byStatus.OFFER).toBe(1);
      expect(stats.byStatus.REJECTED).toBe(1);
      expect(stats.byStatus.WITHDRAWN).toBe(1);
      expect(stats.activeApplications).toBe(4); // APPLIED + UNDER_REVIEW + INTERVIEW + OFFER
      expect(stats.interviewsScheduled).toBe(2); // INTERVIEW + OFFER
      expect(stats.offersReceived).toBe(1);
      expect(stats.interviewRate).toBe(33.3); // (2/6)*100 = 33.3%
      expect(stats.offerRate).toBe(16.7); // (1/6)*100 = 16.7%
    });

    it('computes accurate aggregate placement dashboard statistics', () => {
      const studentA = { _id: 'std_A', department: 'Computer Science' };
      const studentB = { _id: 'std_B', department: 'Computer Science' };
      const studentC = { _id: 'std_C', department: 'Information Technology' };

      const job1 = { _id: 'job_1' };
      const job2 = { _id: 'job_2' };

      const mockApps = [
        {
          student: studentA,
          job: job1,
          currentStatus: 'OFFER' as ApplicationStatus,
          offerDetails: { offeredCtc: 1800000 },
        },
        {
          student: studentB,
          job: job1,
          currentStatus: 'INTERVIEW' as ApplicationStatus,
        },
        {
          student: studentC,
          job: job2,
          currentStatus: 'APPLIED' as ApplicationStatus,
        },
      ];

      const stats = calculatePlacementDashboardMetrics(mockApps);

      expect(stats.totalApplications).toBe(3);
      expect(stats.uniqueApplicants).toBe(3);
      expect(stats.totalJobsApplied).toBe(2);
      expect(stats.placedStudentsCount).toBe(1);
      expect(stats.placementRate).toBe(33.3); // (1/3)*100 = 33.3%
      expect(stats.averageOfferCtc).toBe(1800000);
      expect(stats.highestOfferCtc).toBe(1800000);

      const csDept = stats.departmentBreakdown.find((d) => d.department === 'Computer Science');
      expect(csDept?.totalApplications).toBe(2);
      expect(csDept?.offers).toBe(1);
      expect(csDept?.inInterview).toBe(1);
    });

    it('generates RFC 4180 compliant CSV with proper escaping for quotes, commas, and linebreaks', () => {
      const sampleApps = [
        {
          _id: 'app_12345',
          appliedAt: new Date('2026-03-01'),
          updatedAt: new Date('2026-03-05'),
          currentStatus: 'INTERVIEW',
          resumeVersion: 1,
          student: {
            rollNumber: 'CS2026_01',
            department: 'Computer Science & Engineering',
            degree: 'B.Tech',
            cgpa: 9.1,
            user: { email: 'alice@campus.edu', name: 'Alice "Tech" Doe' },
          },
          job: {
            title: 'Lead Architect, Core Platform',
            workplaceType: 'hybrid',
            jobType: 'full_time',
            company: { name: 'Acme Systems, Inc.' },
          },
          resumeSnapshot: { title: 'Tailored Resume, Final Version' },
          interviewDetails: {
            round: 2,
            interviewType: 'technical',
            scheduledAt: new Date('2026-03-10'),
          },
          offerDetails: {
            offeredCtc: 2400000,
            currency: 'INR',
          },
        },
      ];

      const csv = exportApplicationsToCsv(sampleApps);

      // Header row
      expect(csv).toContain('Application ID,Roll Number,Candidate Name,Candidate Email');

      // Escaped quote: Alice "Tech" Doe -> "Alice ""Tech"" Doe"
      expect(csv).toContain('"Alice ""Tech"" Doe"');

      // Escaped comma: Acme Systems, Inc. -> "Acme Systems, Inc."
      expect(csv).toContain('"Acme Systems, Inc."');

      // Escaped comma in job title
      expect(csv).toContain('"Lead Architect, Core Platform"');

      expect(csv).toContain('2400000');
    });
  });

  // =========================================================================
  // 5. END-TO-END APPLICATION PIPELINE & ACCESS CONTROL (Integration Tests)
  // =========================================================================
  describe('5. End-to-End Application Pipeline & Access Control', () => {
    let createdApplicationId: string;

    it('Student can apply to a published open job using an approved resume version (Req #1, #3)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/applications')
        .set('Cookie', student1Cookie)
        .send({
          jobId: openJob1._id.toString(),
          resumeId: student1ApprovedResume._id.toString(),
          coverLetter: 'I am excited about this distributed systems position.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application.currentStatus).toBe('APPLIED');
      expect(res.body.data.application.resumeVersion).toBe(1);
      expect(res.body.data.application.resumeSnapshot.title).toBe(student1ApprovedResume.title);

      // Initial history recorded
      expect(res.body.data.history).toHaveLength(1);
      expect(res.body.data.history[0].toStatus).toBe('APPLIED');
      expect(res.body.data.history[0].changedByRole).toBe('student');

      createdApplicationId = res.body.data.application._id;
    });

    it('PREVENTS duplicate application to the same job (Req #2)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/applications')
        .set('Cookie', student1Cookie)
        .send({
          jobId: openJob1._id.toString(),
          resumeId: student1ApprovedResume._id.toString(),
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toContain('already applied');
    });

    it('PREVENTS application to duplicate job pointing to the same canonical posting (Req #2)', async () => {
      if (!dbAvailable) return;

      // Student 1 already applied to openJob1. Attempting to apply to duplicateJob1 (duplicateOf: openJob1)
      const res = await request(app)
        .post('/api/applications')
        .set('Cookie', student1Cookie)
        .send({
          jobId: duplicateJob1._id.toString(),
          resumeId: student1ApprovedResume._id.toString(),
        });

      // Must be rejected as duplicate or as non-open job
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('PREVENTS applying with an unapproved draft resume version (Req #1, #3)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/applications')
        .set('Cookie', student1Cookie)
        .send({
          jobId: company2Job._id.toString(),
          resumeId: student1DraftResume._id.toString(), // Draft status!
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toContain('approved/generated resume');
    });

    it('Student 2 can apply to company2Job with verified resume version', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/applications')
        .set('Cookie', student2Cookie)
        .send({
          jobId: company2Job._id.toString(),
          resumeId: student2ApprovedResume._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('PREVENTS applying to an archived/closed job (Req #1, #10)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/applications')
        .set('Cookie', student1Cookie)
        .send({
          jobId: archivedJob._id.toString(), // Status is archived!
          resumeId: student1ApprovedResume._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toContain('not accepting applications');
    });

    it('PRESERVES applications even if the associated job is subsequently archived (Req #10)', async () => {
      if (!dbAvailable) return;

      // Archive openJob1
      await Job.findByIdAndUpdate(openJob1._id, { status: 'archived' });

      // Student can still view their submitted application
      const res = await request(app)
        .get(`/api/applications/${createdApplicationId}`)
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application._id).toBe(createdApplicationId);
      expect(res.body.data.application.job.status).toBe('archived');

      // Restore openJob1 for remaining tests
      await Job.findByIdAndUpdate(openJob1._id, { status: 'open' });
    });

    it('PRESERVES submitted resume version even if the student updates their resume later (Req #3)', async () => {
      if (!dbAvailable) return;

      // Student updates resume version to 3 and modifies title
      await Resume.findByIdAndUpdate(student1ApprovedResume._id, {
        version: 3,
        title: 'Updated Senior Architect Resume v3',
      });

      const res = await request(app)
        .get(`/api/applications/${createdApplicationId}`)
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(200);
      // Stored application resumeVersion remains 1
      expect(res.body.data.application.resumeVersion).toBe(1);
      // Snapshot remains exact copy from submission time
      expect(res.body.data.application.resumeSnapshot.version).toBe(1);
      expect(res.body.data.application.resumeSnapshot.title).toBe('Full Stack Engineer Resume');

      // Revert resume title
      await Resume.findByIdAndUpdate(student1ApprovedResume._id, {
        version: 1,
        title: 'Full Stack Engineer Resume',
      });
    });

    it('PREVENTS student from advancing own status to INTERVIEW or OFFER (Req #7)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .set('Cookie', student1Cookie)
        .send({ status: 'INTERVIEW' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toContain('forbidden');
    });

    it('PREVENTS unauthorized recruiter from viewing or updating applications for other companies (Req #6)', async () => {
      if (!dbAvailable) return;

      // Recruiter 2 (Horizon Biotech) tries to view application for Company 1 (Apex Systems)
      const viewRes = await request(app)
        .get(`/api/applications/${createdApplicationId}`)
        .set('Cookie', recruiter2Cookie);

      expect(viewRes.status).toBe(403);
      expect(viewRes.body.success).toBe(false);

      // Recruiter 2 tries to update status of application for Company 1
      const updateRes = await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .set('Cookie', recruiter2Cookie)
        .send({ status: 'UNDER_REVIEW' });

      expect(updateRes.status).toBe(403);
      expect(updateRes.body.success).toBe(false);
    });

    it('Permits authorized recruiter to move application to UNDER_REVIEW and records history (Req #5, #6, #8)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .set('Cookie', recruiter1Cookie)
        .send({
          status: 'UNDER_REVIEW',
          notes: 'Candidate meets all backend requirements.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application.currentStatus).toBe('UNDER_REVIEW');
      expect(res.body.data.history.fromStatus).toBe('APPLIED');
      expect(res.body.data.history.toStatus).toBe('UNDER_REVIEW');
      expect(res.body.data.history.changedByRole).toBe('recruiter');
    });

    it('Permits authorized placement officer to schedule INTERVIEW with interview details (Req #5, #8, #9)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/interview`)
        .set('Cookie', officerCookie)
        .send({
          round: 1,
          interviewType: 'technical',
          scheduledAt: '2026-11-15T10:00:00.000Z',
          location: 'Virtual - Meet',
          meetingLink: 'https://meet.google.com/xyz-abcd-efg',
          interviewerName: 'Sarah Connor',
          interviewerEmail: 'sarah@apexsystems.com',
          notes: 'Round 1 System Design and Data Structures',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application.currentStatus).toBe('INTERVIEW');
      expect(res.body.data.application.interviewDetails.round).toBe(1);
      expect(res.body.data.application.interviewDetails.meetingLink).toBe('https://meet.google.com/xyz-abcd-efg');
      expect(res.body.data.history.fromStatus).toBe('UNDER_REVIEW');
      expect(res.body.data.history.toStatus).toBe('INTERVIEW');
      expect(res.body.data.history.changedByRole).toBe('placement_officer');
    });

    it('Permits authorized recruiter to issue OFFER with offer details (Req #5, #8, #9)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/offer`)
        .set('Cookie', recruiter1Cookie)
        .send({
          offeredCtc: 2100000,
          currency: 'INR',
          baseSalary: 1800000,
          bonus: 300000,
          designation: 'Software Development Engineer - I',
          joiningDate: '2026-07-01T00:00:00.000Z',
          deadline: '2026-06-15T00:00:00.000Z',
          notes: 'Congratulations! Official offer package enclosed.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application.currentStatus).toBe('OFFER');
      expect(res.body.data.application.offerDetails.offeredCtc).toBe(2100000);
      expect(res.body.data.history.fromStatus).toBe('INTERVIEW');
      expect(res.body.data.history.toStatus).toBe('OFFER');
      expect(res.body.data.history.changedByRole).toBe('recruiter');
    });

    it('REJECTS invalid workflow transition via API (e.g. OFFER -> APPLIED)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/status`)
        .set('Cookie', officerCookie)
        .send({ status: 'APPLIED' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toContain('Invalid status transition');
    });

    it('Permits student to withdraw active application (Req #4, #5)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/withdraw`)
        .set('Cookie', student1Cookie)
        .send({ notes: 'Accepted higher study opportunity.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application.currentStatus).toBe('WITHDRAWN');
      expect(res.body.data.history.toStatus).toBe('WITHDRAWN');
      expect(res.body.data.history.changedByRole).toBe('student');
    });

    it('PREVENTS withdrawing an already WITHDRAWN application', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/applications/${createdApplicationId}/withdraw`)
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toContain('already been withdrawn');
    });

    it('Lists and filters applications for placement officer with pagination (Req #11)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/applications?page=1&limit=10')
        .set('Cookie', officerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applications.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('Exports applications to RFC 4180 CSV (Req #11)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/applications/export/csv')
        .set('Cookie', officerCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Application ID,Roll Number,Candidate Name');
      expect(res.text).toContain('WITHDRAWN');
    });

    it('Calculates student pipeline statistics from actual database records (Req #12)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/applications/stats/student')
        .set('Cookie', student1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.totalApplications).toBeGreaterThanOrEqual(1);
      expect(res.body.data.metrics.byStatus.WITHDRAWN).toBeGreaterThanOrEqual(1);
      expect(res.body.data.recentApplications).toBeDefined();
    });

    it('Calculates aggregate placement pipeline statistics from actual database records (Req #12)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/applications/stats/placement')
        .set('Cookie', officerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.totalApplications).toBeGreaterThanOrEqual(1);
      expect(res.body.data.metrics.uniqueApplicants).toBeGreaterThanOrEqual(1);
      expect(res.body.data.recentTransitions).toBeDefined();
    });
  });
});
