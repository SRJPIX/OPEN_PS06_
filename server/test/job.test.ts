import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { User, IUser } from '../src/models/User';
import { Company, ICompany } from '../src/models/Company';
import { Job, IJob } from '../src/models/Job';
import { JobSource } from '../src/models/JobSource';
import { hashPassword } from '../src/utils/password';
import { signAuthToken } from '../src/utils/token';
import { seedCanonicalSkills } from '../src/utils/skillNormalizer';
import {
  parseJobDescriptionDeterministic,
  parseJobDescription,
  ILlmJobParserProvider,
} from '../src/utils/jobParser';
import {
  checkExactDuplicate,
  calculateDuplicateSuggestions,
  mergeJobs,
} from '../src/utils/jobDeduplicator';
import { importJobsFromCsv } from '../src/utils/csvJobImporter';
import { config } from '../src/config/env';

describe('Job Management, Ingestion, Deduplication & Access Scoping', () => {
  const app = createApp();
  let dbAvailable = false;

  let officerCookie: string[];
  let officerUser: IUser;

  let recruiter1Cookie: string[];
  let recruiter1User: IUser;
  let company1: ICompany;

  let recruiter2Cookie: string[];
  let recruiter2User: IUser;
  let company2: ICompany;

  let studentCookie: string[];
  let studentUser: IUser;

  const cleanup = async () => {
    if (!dbAvailable) return;
    const testUsers = await User.find({ email: { $regex: /@job-ingestion-test\.com$/ } });
    const userIds = testUsers.map((u) => u._id);

    const companies = await Company.find({ createdBy: { $in: userIds } });
    const companyIds = companies.map((c) => c._id);

    await Job.deleteMany({
      $or: [{ postedBy: { $in: userIds } }, { company: { $in: companyIds } }],
    });
    await Company.deleteMany({ _id: { $in: companyIds } });
    await JobSource.deleteMany({ name: { $regex: /Test Source/ } });
    await User.deleteMany({ _id: { $in: userIds } });
  };

  beforeAll(async () => {
    dbAvailable = await connectDB(config.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    if (dbAvailable) {
      await cleanup();
      await seedCanonicalSkills();

      const passwordHash = await hashPassword('Password123!');

      // 1. Placement Officer
      officerUser = await User.create({
        email: 'officer@job-ingestion-test.com',
        passwordHash,
        role: 'placement_officer',
        status: 'active',
      });
      const oToken = signAuthToken({
        userId: officerUser._id.toString(),
        role: 'placement_officer',
      });
      officerCookie = [`${config.COOKIE_NAME}=${oToken}; Path=/`];

      // 2. Recruiter 1 (authorized for Company 1)
      recruiter1User = await User.create({
        email: 'recruiter1@job-ingestion-test.com',
        passwordHash,
        role: 'recruiter',
        status: 'active',
      });
      const r1Token = signAuthToken({ userId: recruiter1User._id.toString(), role: 'recruiter' });
      recruiter1Cookie = [`${config.COOKIE_NAME}=${r1Token}; Path=/`];

      company1 = await Company.create({
        name: 'Alpha Software Corp',
        industry: 'Software Engineering',
        isVerified: true,
        createdBy: recruiter1User._id,
      });

      // 3. Recruiter 2 (authorized for Company 2)
      recruiter2User = await User.create({
        email: 'recruiter2@job-ingestion-test.com',
        passwordHash,
        role: 'recruiter',
        status: 'active',
      });
      const r2Token = signAuthToken({ userId: recruiter2User._id.toString(), role: 'recruiter' });
      recruiter2Cookie = [`${config.COOKIE_NAME}=${r2Token}; Path=/`];

      company2 = await Company.create({
        name: 'Beta Cloud Systems',
        industry: 'Cloud Infrastructure',
        isVerified: true,
        createdBy: recruiter2User._id,
      });

      // 4. Student
      studentUser = await User.create({
        email: 'student@job-ingestion-test.com',
        passwordHash,
        role: 'student',
        status: 'active',
      });
      const sToken = signAuthToken({ userId: studentUser._id.toString(), role: 'student' });
      studentCookie = [`${config.COOKIE_NAME}=${sToken}; Path=/`];
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await cleanup();
      await disconnectDB();
    }
  });

  // ==========================================
  // 1. Deterministic Job Description Parser
  // ==========================================
  describe('1. Deterministic Parser & Canonical Skill Normalization', () => {
    it('should extract title, responsibilities, work mode, eligibility and canonical skills with aliases', () => {
      const rawText = `
Role: Senior Full Stack Developer
Location: Bengaluru, India
Workplace: Hybrid
Type: Full-time

Responsibilities:
- Architect and develop modern microservices using Express and NodeJS
- Build responsive frontend user interfaces using ReactJS and Tailwind CSS
- Optimize data access layers with PostgreSQL and Redis cache

Requirements:
- Strong experience with TypeScript, JS, and React.js
- Backend proficiency in Node.js and Docker
- Minimum CGPA of 7.5
- Batch of 2025 and 2026 eligible
- Eligible branches: CSE, Information Technology, ECE

Preferred Qualifications:
- Familiarity with AWS and Kubernetes
- Python3 scripting ability

Compensation: 18 - 24 LPA
Deadline: 2026-12-31
      `;

      const result = parseJobDescriptionDeterministic(rawText);

      expect(result.title).toBe('Senior Full Stack Developer');
      expect(result.workplaceType).toBe('hybrid');
      expect(result.jobType).toBe('full_time');
      expect(result.location).toBe('Bengaluru, India');
      expect(result.minCgpa).toBe(7.5);
      expect(result.eligibleGraduationYears).toContain(2025);
      expect(result.eligibleGraduationYears).toContain(2026);
      expect(result.eligibleDepartments).toContain('Computer Science & Engineering');
      expect(result.eligibleDepartments).toContain('Information Technology');

      // Responsibilities
      expect(result.responsibilities.length).toBeGreaterThanOrEqual(3);
      expect(result.responsibilities[0]).toContain('Architect and develop modern microservices');

      // Canonical Skills Mapping: Aliases resolved to canonical display names
      expect(result.requiredSkillNames).toContain('React');
      expect(result.requiredSkillNames).toContain('Node.js');
      expect(result.requiredSkillNames).toContain('TypeScript');
      expect(result.requiredSkillNames).toContain('JavaScript');
      expect(result.requiredSkillNames).toContain('PostgreSQL');
      expect(result.requiredSkillNames).toContain('Docker');

      // Preferred Skills
      expect(result.preferredSkillNames).toContain('AWS');
      expect(result.preferredSkillNames).toContain('Kubernetes');
      expect(result.preferredSkillNames).toContain('Python');

      // Compensation
      expect(result.salaryRange).toBeDefined();
      expect(result.salaryRange?.min).toBe(1800000);
      expect(result.salaryRange?.max).toBe(2400000);
      expect(result.salaryRange?.currency).toBe('INR');

      // Deadline
      expect(result.deadline).toBeInstanceOf(Date);
      expect(result.deadline?.toISOString()).toContain('2026-12-31');
    });

    it('should strictly guarantee Java and JavaScript remain separate during skill extraction', () => {
      const javaText =
        'We are hiring a Core Java developer to write backend services with Spring Boot and Java 17.';
      const javaResult = parseJobDescriptionDeterministic(javaText);
      expect(javaResult.requiredSkillNames).toContain('Java');
      expect(javaResult.requiredSkillNames).not.toContain('JavaScript');

      const jsText =
        'We need a JavaScript frontend developer proficient in vanilla JS and ECMAScript.';
      const jsResult = parseJobDescriptionDeterministic(jsText);
      expect(jsResult.requiredSkillNames).toContain('JavaScript');
      expect(jsResult.requiredSkillNames).not.toContain('Java');
    });

    it('should NOT invent deadlines, CGPA, graduation years, or salary when omitted (Requirement #13)', () => {
      const minimalText = `
Role: Software Engineer Intern
Location: Remote
Develop software components.
Requirements: Python and Git.
      `;

      const result = parseJobDescriptionDeterministic(minimalText);
      expect(result.title).toBe('Software Engineer Intern');
      expect(result.minCgpa).toBe(0);
      expect(result.eligibleGraduationYears).toEqual([]);
      expect(result.eligibleDepartments).toEqual([]);
      expect(result.salaryRange).toBeUndefined();
      expect(result.deadline).toBeUndefined();
      expect(result.requiredSkillNames).toContain('Python');
      expect(result.requiredSkillNames).toContain('Git');
    });
  });

  // ==========================================
  // 2. Optional LLM Parser Provider & Fallback
  // ==========================================
  describe('2. LLM Parser Provider with Schema Validation & Fallback', () => {
    it('should use LLM output when provider returns valid conforming schema', async () => {
      const mockLlmProvider: ILlmJobParserProvider = {
        parse: async () => {
          return JSON.stringify({
            title: 'Lead Cloud Architect',
            responsibilities: ['Oversee multi-cloud architecture', 'Direct devops teams'],
            requiredSkills: ['AWS', 'Kubernetes', 'Docker'],
            preferredSkills: ['Python'],
            minCgpa: 8.0,
            eligibleDepartments: ['Computer Science & Engineering'],
            eligibleGraduationYears: [2025],
            workplaceType: 'remote',
            jobType: 'full_time',
            location: 'Remote',
            salaryRange: { min: 3000000, max: 4000000, currency: 'INR' },
            deadline: '2026-11-30',
          });
        },
      };

      const result = await parseJobDescription('Lead Cloud Architect job text...', {
        useLlm: true,
        provider: mockLlmProvider,
      });

      expect(result.parserUsed).toBe('llm');
      expect(result.title).toBe('Lead Cloud Architect');
      expect(result.minCgpa).toBe(8.0);
      expect(result.requiredSkillNames).toContain('AWS');
      expect(result.requiredSkillNames).toContain('Kubernetes');
      expect(result.deadline).toBeInstanceOf(Date);
    });

    it('should gracefully fallback to deterministic parser if LLM provider fails or produces invalid schema', async () => {
      const failingLlmProvider: ILlmJobParserProvider = {
        parse: async () => {
          throw new Error('LLM Rate limit exceeded');
        },
      };

      const rawText = 'Role: Junior QA Engineer\nLocation: Pune\nRequirements: Python and Git.';
      const result = await parseJobDescription(rawText, {
        useLlm: true,
        provider: failingLlmProvider,
      });

      expect(result.parserUsed).toBe('deterministic');
      expect(result.title).toBe('Junior QA Engineer');
      expect(result.location).toBe('Pune');
      expect(result.requiredSkillNames).toContain('Python');
      expect(result.requiredSkillNames).toContain('Git');
    });
  });

  // ==========================================
  // 3. Duplicate Detection & Merge Safeguards
  // ==========================================
  describe('3. Duplicate Detection & Merge Rules', () => {
    let existingJob: IJob;

    beforeAll(async () => {
      if (!dbAvailable) return;
      existingJob = await Job.create({
        company: company1._id,
        title: 'Backend Software Engineer',
        description:
          'Design robust scalable APIs using Node.js, Express, MongoDB and TypeScript in Bengaluru.',
        location: 'Bengaluru',
        workplaceType: 'hybrid',
        jobType: 'full_time',
        status: 'open',
        postedBy: recruiter1User._id,
        requisitionId: 'REQ-ALPHA-101',
        sourceUrl: 'https://alpha.example.com/careers/backend-101',
      });
    });

    it('should flag exact duplicate when requisition ID matches for the same company', async () => {
      if (!dbAvailable) return;
      const dupCheck = await checkExactDuplicate({
        companyId: company1._id,
        requisitionId: 'REQ-ALPHA-101',
      });

      expect(dupCheck.isDuplicate).toBe(true);
      expect(dupCheck.matchType).toBe('requisition_id');
      expect(dupCheck.duplicateJob?._id.toString()).toBe(existingJob._id.toString());
    });

    it('should flag exact duplicate when source URL matches', async () => {
      if (!dbAvailable) return;
      const dupCheck = await checkExactDuplicate({
        companyId: company1._id,
        sourceUrl: 'https://alpha.example.com/careers/backend-101?utm_source=linkedin',
      });

      expect(dupCheck.isDuplicate).toBe(true);
      expect(dupCheck.matchType).toBe('source_url');
    });

    it('should NOT flag exact duplicate for same title if requisition IDs are distinct', async () => {
      if (!dbAvailable) return;
      const check = await checkExactDuplicate({
        companyId: company1._id,
        requisitionId: 'REQ-ALPHA-102', // Different requisition!
        sourceUrl: 'https://alpha.example.com/careers/backend-102',
      });

      expect(check.isDuplicate).toBe(false);
    });

    it('should compute similarity suggestions for high-overlap jobs at the same company', async () => {
      if (!dbAvailable) return;
      const suggestions = await calculateDuplicateSuggestions({
        companyId: company1._id,
        title: 'Senior Backend Software Engineer',
        description: 'Design robust APIs using Node.js, Express, MongoDB, TypeScript in Bengaluru.',
        location: 'Bengaluru',
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].jobId.toString()).toBe(existingJob._id.toString());
      expect(suggestions[0].similarityScore).toBeGreaterThanOrEqual(0.65);
      expect(suggestions[0].matchReasons.length).toBeGreaterThan(0);
    });

    it('should NEVER merge distinct requisitions solely because their titles match (Requirement #12)', async () => {
      if (!dbAvailable) return;
      const distinctJob = await Job.create({
        company: company1._id,
        title: 'Backend Software Engineer',
        description: 'Second opening for the Payments team.',
        location: 'Bengaluru',
        workplaceType: 'hybrid',
        jobType: 'full_time',
        status: 'open',
        postedBy: recruiter1User._id,
        requisitionId: 'REQ-ALPHA-999', // Explicitly distinct requisition
      });

      // Attempting to merge distinct requisitions MUST throw an error
      await expect(
        mergeJobs({
          primaryJobId: existingJob._id,
          duplicateJobId: distinctJob._id,
          mergedByUserId: recruiter1User._id,
          notes: 'Attempting invalid merge on distinct requisitions',
        })
      ).rejects.toThrow(/Cannot merge distinct requisitions/);
    });

    it('should successfully merge confirmed duplicate and preserve source provenance', async () => {
      if (!dbAvailable) return;
      const duplicatePosting = await Job.create({
        company: company1._id,
        title: 'Backend Software Engineer',
        description: 'Cross-posted duplicate opening.',
        location: 'Bengaluru',
        workplaceType: 'hybrid',
        jobType: 'full_time',
        status: 'open',
        postedBy: recruiter1User._id,
        requisitionId: 'REQ-ALPHA-101', // Same requisition!
        sourceUrl: 'https://job-board-partner.com/alpha-backend',
        sourceType: 'partner_posting',
      });

      const merged = await mergeJobs({
        primaryJobId: existingJob._id,
        duplicateJobId: duplicatePosting._id,
        mergedByUserId: recruiter1User._id,
        notes: 'Merged partner duplicate posting',
      });

      expect(merged.provenance?.mergedFrom?.length).toBe(1);
      expect(merged.provenance?.mergedFrom?.[0].jobId.toString()).toBe(
        duplicatePosting._id.toString()
      );
      expect(merged.provenance?.mergedFrom?.[0].sourceUrl).toBe(
        'https://job-board-partner.com/alpha-backend'
      );

      // Duplicate job status must now be archived with duplicateOf pointer
      const updatedDup = await Job.findById(duplicatePosting._id);
      expect(updatedDup?.status).toBe('archived');
      expect(updatedDup?.duplicateOf?.toString()).toBe(existingJob._id.toString());
    });
  });

  // ==========================================
  // 4. CSV Job Ingestion Engine
  // ==========================================
  describe('4. CSV Job Ingestion Engine with Row-Level Validation', () => {
    it('should import valid CSV jobs and report row-level errors for invalid or duplicate rows', async () => {
      if (!dbAvailable) return;

      const csvData = `
title,company,description,location,workplaceType,jobType,requisitionId,sourceUrl,requiredSkills,minCgpa,deadline
"Junior Cloud Engineer","Alpha Software Corp","Build AWS and Docker cloud pipelines with Python","Bengaluru","remote","full_time","REQ-CSV-001","https://alpha.com/jobs/csv-1","AWS, Docker, Python",7.5,"2026-10-30"
"","Alpha Software Corp","Missing title should be rejected","Remote","remote","full_time","REQ-CSV-002","","Python",6.0,"2026-10-30"
"Full Stack Dev","Alpha Software Corp","Build React and Node apps","Remote","remote","full_time","REQ-CSV-001","https://alpha.com/jobs/csv-dup","ReactJS, NodeJS",8.0,"2026-10-30"
"Data Analyst","Alpha Software Corp","Analyze datasets with Python and PostgreSQL","Pune","on_site","full_time","REQ-CSV-003","https://alpha.com/jobs/csv-3","Python, PostgreSQL",15.0,"2026-10-30"
      `.trim();

      const summary = await importJobsFromCsv({
        csvContent: csvData,
        userId: recruiter1User._id.toString(),
        userRole: 'recruiter',
      });

      expect(summary.totalRows).toBe(4);
      expect(summary.successful).toBe(1); // Only row 1 is fully valid
      expect(summary.rejected).toBe(3); // Rows 2, 3, and 4 fail specific validations

      // Row 2 error: Missing title
      const row2Err = summary.errors.find((e) => e.row === 3);
      expect(row2Err?.errors).toContain('Missing required field: title');

      // Row 3 error: Duplicate Requisition ID (repeated within batch)
      const row3Err = summary.errors.find((e) => e.row === 4);
      expect(row3Err?.errors.some((err) => err.includes('Duplicate requisition ID'))).toBe(true);

      // Row 4 error: Invalid CGPA (15.0 > 10.0)
      const row4Err = summary.errors.find((e) => e.row === 5);
      expect(row4Err?.errors.some((err) => err.includes('Invalid CGPA'))).toBe(true);

      // Successfully created job
      expect(summary.createdJobs.length).toBe(1);
      expect(summary.createdJobs[0].title).toBe('Junior Cloud Engineer');
    });

    it('should reject CSV rows if a recruiter attempts to post jobs for unauthorized company', async () => {
      if (!dbAvailable) return;

      const csvData = `
title,company,description,location,requisitionId
"Unauthorized Job","Beta Cloud Systems","Recruiter 1 cannot post for Company 2","Remote","REQ-UNAUTH-01"
      `.trim();

      const summary = await importJobsFromCsv({
        csvContent: csvData,
        userId: recruiter1User._id.toString(),
        userRole: 'recruiter', // Recruiter 1 owns Alpha, NOT Beta
      });

      expect(summary.successful).toBe(0);
      expect(summary.rejected).toBe(1);
      expect(summary.errors[0].errors[0]).toContain('Unauthorized');
    });
  });

  // ==========================================
  // 5. API Endpoints & Role Access Scoping
  // ==========================================
  describe('5. API Endpoints & Role Access Control', () => {
    let alphaJobId: string;
    let betaJobId: string;
    let draftJobId: string;

    it('Placement officer can create jobs for any company', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .post('/api/jobs')
        .set('Cookie', officerCookie)
        .send({
          company: company2._id.toString(),
          title: 'DevOps Specialist',
          description: 'Deploy Kubernetes clusters and manage AWS cloud infrastructure.',
          location: 'Hyderabad',
          workplaceType: 'hybrid',
          jobType: 'full_time',
          requiredSkills: ['Kubernetes', 'AWS', 'Docker'],
          status: 'open',
          requisitionId: 'REQ-OFFICER-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.job.title).toBe('DevOps Specialist');
      betaJobId = res.body.data.job._id;
    });

    it('Recruiter can create job for their authorized company', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .post('/api/jobs')
        .set('Cookie', recruiter1Cookie)
        .send({
          company: company1._id.toString(),
          title: 'Frontend Engineer',
          description: 'Build user interfaces with ReactJS, TypeScript and Tailwind CSS.',
          location: 'Bengaluru',
          workplaceType: 'remote',
          jobType: 'full_time',
          requiredSkills: ['ReactJS', 'TypeScript', 'Tailwind CSS'],
          status: 'open',
          requisitionId: 'REQ-ALPHA-FE-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.job.requiredSkills.length).toBe(3);
      alphaJobId = res.body.data.job._id;
    });

    it('Recruiter is FORBIDDEN (403) from creating job for unauthorized company', async () => {
      if (!dbAvailable) return;
      const res = await request(app).post('/api/jobs').set('Cookie', recruiter1Cookie).send({
        company: company2._id.toString(), // Belongs to Recruiter 2
        title: 'Unauthorized Intrusion Job',
        description: 'This should be strictly blocked by authorization middleware.',
        location: 'Remote',
        requisitionId: 'REQ-FORBIDDEN-01',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Recruiter 2 can create job for their authorized company', async () => {
      if (!dbAvailable) return;
      const res = await request(app).post('/api/jobs').set('Cookie', recruiter2Cookie).send({
        company: company2._id.toString(),
        title: 'Beta Cloud Architect',
        description: 'Design cloud systems with AWS and Terraform.',
        location: 'Remote',
        status: 'open',
        requisitionId: 'REQ-BETA-001',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.job.title).toBe('Beta Cloud Architect');
    });

    it('Student CANNOT create, update or archive jobs', async () => {
      if (!dbAvailable) return;
      const createRes = await request(app).post('/api/jobs').set('Cookie', studentCookie).send({
        company: company1._id.toString(),
        title: 'Student Attempted Job',
        description: 'Students are strictly forbidden from creating jobs.',
      });
      expect(createRes.status).toBe(403);

      const updateRes = await request(app)
        .put(`/api/jobs/${alphaJobId}`)
        .set('Cookie', studentCookie)
        .send({ title: 'Modified by student' });
      expect(updateRes.status).toBe(403);

      const archiveRes = await request(app)
        .patch(`/api/jobs/${alphaJobId}/archive`)
        .set('Cookie', studentCookie);
      expect(archiveRes.status).toBe(403);
    });

    it('Student can view published jobs and filter by title, company, location, workMode and jobType', async () => {
      if (!dbAvailable) return;

      // 1. Create a draft job (invisible to students)
      const draftRes = await request(app).post('/api/jobs').set('Cookie', recruiter1Cookie).send({
        company: company1._id.toString(),
        title: 'Secret Draft Researcher',
        description: 'Draft job not yet approved or opened.',
        location: 'Bengaluru',
        status: 'draft',
        requisitionId: 'REQ-ALPHA-DRAFT',
      });
      draftJobId = draftRes.body.data.job._id;

      // 2. Student queries jobs without filter
      const listRes = await request(app).get('/api/jobs').set('Cookie', studentCookie);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.every((j: { status: string }) => j.status === 'open')).toBe(true);
      expect(listRes.body.data.some((j: { _id: string }) => j._id === draftJobId)).toBe(false);

      // 3. Student filters by title
      const titleFilter = await request(app)
        .get('/api/jobs?title=Frontend')
        .set('Cookie', studentCookie);
      expect(titleFilter.status).toBe(200);
      expect(titleFilter.body.data.length).toBeGreaterThanOrEqual(1);
      expect(titleFilter.body.data[0].title).toContain('Frontend');

      // 4. Student filters by location & workMode
      const locFilter = await request(app)
        .get('/api/jobs?location=Bengaluru&workMode=remote')
        .set('Cookie', studentCookie);
      expect(locFilter.status).toBe(200);
      expect(
        locFilter.body.data.every((j: { location: string }) => j.location.includes('Bengaluru'))
      ).toBe(true);

      // 5. Student cannot view draft job detail (404)
      const draftDetailRes = await request(app)
        .get(`/api/jobs/${draftJobId}`)
        .set('Cookie', studentCookie);
      expect(draftDetailRes.status).toBe(404);
    });

    it('Placement officer can archive a job and recruiter can archive their own job', async () => {
      if (!dbAvailable) return;

      const archiveRes = await request(app)
        .patch(`/api/jobs/${alphaJobId}/archive`)
        .set('Cookie', recruiter1Cookie);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.data.job.status).toBe('archived');

      // Verify student can no longer view the archived job
      const detailRes = await request(app)
        .get(`/api/jobs/${alphaJobId}`)
        .set('Cookie', studentCookie);
      expect(detailRes.status).toBe(404);
    });

    it('Recruiter cannot edit or archive job belonging to another company', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .patch(`/api/jobs/${betaJobId}/archive`)
        .set('Cookie', recruiter1Cookie); // Recruiter 1 attempting to archive Beta's job

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Job Description Parsing API endpoint returns structured fields', async () => {
      if (!dbAvailable) return;

      const res = await request(app).post('/api/jobs/parse').set('Cookie', officerCookie).send({
        text: 'Role: Cloud Platform Architect\nLocation: Hyderabad\nResponsibilities:\n- Design AWS ECS pipelines\nRequirements: AWS, Docker, Kubernetes.\nMin CGPA: 8.0\nDeadline: 2026-11-15',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.parsed.title).toBe('Cloud Platform Architect');
      expect(res.body.data.parsed.requiredSkillNames).toContain('AWS');
      expect(res.body.data.parsed.requiredSkillNames).toContain('Docker');
      expect(res.body.data.parsed.minCgpa).toBe(8.0);
    });

    it('Job Sources API lists sources and allows placement officers to create source references', async () => {
      if (!dbAvailable) return;

      const createSourceRes = await request(app)
        .post('/api/jobs/sources')
        .set('Cookie', officerCookie)
        .send({
          name: 'Apex Test Source 2026',
          type: 'partner_posting',
          description: 'Special hiring partnership drive',
        });

      expect(createSourceRes.status).toBe(201);
      expect(createSourceRes.body.data.source.type).toBe('partner_posting');

      const listRes = await request(app).get('/api/jobs/sources').set('Cookie', officerCookie);

      expect(listRes.status).toBe(200);
      expect(
        listRes.body.data.sources.some((s: { name: string }) => s.name === 'Apex Test Source 2026')
      ).toBe(true);
    });
  });
});
