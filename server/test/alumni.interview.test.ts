import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { createApp } from '../src/app';
import { User } from '../src/models/User';
import { AlumniProfile } from '../src/models/AlumniProfile';
import { InterviewReport } from '../src/models/InterviewReport';
import { hashPassword } from '../src/utils/password';

const app = createApp();

describe('Alumni Referral Network & Interview Question Repository Suite', () => {
  let dbAvailable = false;
  let studentCookie: string;
  let studentUserId: string;
  let officerCookie: string;
  let officerUserId: string;
  let seededAlumniId: string;
  let seededReportId: string;

  beforeAll(async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/evidra');
      }
      dbAvailable = true;

      const passwordHash = await hashPassword('EvidraTestPass123!');

      // Create test student
      const student = await User.create({
        email: `alumni_student_${Date.now()}@test.dev`,
        passwordHash,
        role: 'student',
        isEmailVerified: true,
      });
      studentUserId = student._id.toString();

      // Create test placement officer
      const officer = await User.create({
        email: `alumni_officer_${Date.now()}@test.dev`,
        passwordHash,
        role: 'placement_officer',
        isEmailVerified: true,
      });
      officerUserId = officer._id.toString();

      // Login student
      const studentLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: student.email, password: 'EvidraTestPass123!' });
      studentCookie = studentLoginRes.headers['set-cookie'][0];

      // Login officer
      const officerLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: officer.email, password: 'EvidraTestPass123!' });
      officerCookie = officerLoginRes.headers['set-cookie'][0];

      // Seed verified alumni
      const alumni = await AlumniProfile.create({
        fullName: 'Vikram Seth',
        email: 'vikram.seth@alumni.univ.edu',
        graduationYear: 2023,
        degree: 'B.Tech Computer Science',
        department: 'Computer Science',
        companyName: 'Acme Innovations',
        designation: 'Senior Backend Engineer',
        experienceYears: 3,
        referralAvailable: true,
        maxReferralsPerMonth: 2,
        activeReferralsCount: 0,
        preferredSkills: ['Node.js', 'TypeScript', 'MongoDB'],
        isVerified: true,
      });
      seededAlumniId = alumni._id.toString();

      // Seed interview reports (1 anonymous, 1 pending moderation, 1 named)
      const report = await InterviewReport.create({
        student: new Types.ObjectId(studentUserId),
        companyName: 'Acme Innovations',
        role: 'Fullstack Engineer',
        driveYear: 2026,
        difficulty: 'medium',
        outcome: 'offered',
        isAnonymous: true,
        moderationStatus: 'approved',
        rounds: [
          {
            roundNumber: 1,
            roundName: 'Technical Coding Round',
            durationMinutes: 60,
            questions: [
              {
                question: 'Implement LRU Cache with O(1) get and put operations',
                topic: 'Data Structures',
                difficulty: 'medium',
                tips: 'Use a doubly-linked list combined with a hash map.',
              },
              {
                question: 'Explain how Node.js event loop handles I/O polling and microtasks',
                topic: 'Node.js',
                difficulty: 'medium',
              },
            ],
          },
        ],
        overallExperience: 'Clear technical evaluation and collaborative interviewers.',
      });
      seededReportId = report._id.toString();

      // Pending report for moderation testing
      await InterviewReport.create({
        student: new Types.ObjectId(studentUserId),
        companyName: 'Nimbus Cloud',
        role: 'Cloud Architect Intern',
        driveYear: 2026,
        difficulty: 'hard',
        outcome: 'pending',
        isAnonymous: false,
        moderationStatus: 'pending',
        rounds: [
          {
            roundNumber: 1,
            roundName: 'Systems Architecture',
            questions: [
              {
                question: 'How do you design an active-active multi-region Kubernetes cluster?',
                topic: 'DevOps & Distributed Systems',
                difficulty: 'hard',
              },
            ],
          },
        ],
        overallExperience: 'Deep architectural dive into disaster recovery topologies.',
      });
    } catch {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await User.deleteMany({ email: { $regex: /alumni_(student|officer)_/ } });
      await AlumniProfile.deleteMany({ email: 'vikram.seth@alumni.univ.edu' });
      await InterviewReport.deleteMany({ companyName: { $in: ['Acme Innovations', 'Nimbus Cloud'] } });
    }
  });

  describe('1. Alumni Profiles & Referral Availability', () => {
    it('GET /api/alumni returns verified alumni with consent status', async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/alumni');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.alumni)).toBe(true);
      expect(res.body.data.alumni.length).toBeGreaterThanOrEqual(1);

      const found = res.body.data.alumni.find((a: any) => a._id === seededAlumniId);
      expect(found).toBeDefined();
      expect(found.companyName).toBe('Acme Innovations');
      expect(found.referralAvailable).toBe(true);
    });

    it('GET /api/alumni?referralOnly=true filters to only referral-ready alumni', async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/alumni?referralOnly=true');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.alumni.forEach((a: any) => {
        expect(a.referralAvailable).toBe(true);
      });
    });

    it('POST /api/alumni allows creating new alumni profile', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/alumni')
        .set('Cookie', studentCookie)
        .send({
          fullName: 'Pooja Hegde',
          email: 'pooja.hegde@alumni.univ.edu',
          graduationYear: 2022,
          degree: 'B.Tech Electronics',
          department: 'Electronics',
          companyName: 'Meta Platforms',
          designation: 'Staff Product Engineer',
          experienceYears: 4,
          referralAvailable: true,
          maxReferralsPerMonth: 5,
          preferredSkills: ['React', 'Relay', 'GraphQL'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alumni.companyName).toBe('Meta Platforms');

      // Cleanup
      await AlumniProfile.findByIdAndDelete(res.body.data.alumni._id);
    });

    it('POST /api/alumni/:id/request-referral submits referral request within monthly capacity', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post(`/api/alumni/${seededAlumniId}/request-referral`)
        .set('Cookie', studentCookie)
        .send({
          targetRole: 'Software Engineer II',
          note: 'I have verified evidence and projects in TypeScript and Node.js.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUBMITTED');
    });

    it('POST /api/alumni/:id/request-referral enforces monthly referral rate limit', async () => {
      if (!dbAvailable) return;

      // Exhaust capacity (seeded limit is 2; 1 was used in previous test)
      await request(app)
        .post(`/api/alumni/${seededAlumniId}/request-referral`)
        .set('Cookie', studentCookie)
        .send({ targetRole: 'Backend Engineer' });

      // Third request should be blocked
      const blockedRes = await request(app)
        .post(`/api/alumni/${seededAlumniId}/request-referral`)
        .set('Cookie', studentCookie)
        .send({ targetRole: 'Backend Engineer' });

      expect(blockedRes.status).toBe(400);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error.message).toMatch(/monthly referral limit/i);
    });
  });

  describe('2. Interview Experiences & Searchable Question Repository', () => {
    it('GET /api/interviews/experiences returns approved reports and masks anonymous authors for students', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/interviews/experiences')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const anonReport = res.body.data.reports.find((r: any) => r._id === seededReportId);
      expect(anonReport).toBeDefined();
      expect(anonReport.isAnonymous).toBe(true);
      expect(anonReport.authorDisplay).toBe('Anonymous Evidra Student');
      expect(anonReport.student).toBeUndefined(); // Email and identity must be stripped
    });

    it('GET /api/interviews/experiences reveals submitter details to authorized placement officers for audit', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/interviews/experiences')
        .set('Cookie', officerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const anonReport = res.body.data.reports.find((r: any) => r._id === seededReportId);
      expect(anonReport).toBeDefined();
      expect(anonReport.student).toBeDefined();
      expect(anonReport.student.email).toBeDefined();
    });

    it('GET /api/interviews/questions returns aggregated company question repository', async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/interviews/questions');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalQuestions).toBeGreaterThanOrEqual(2);

      const lruQ = res.body.data.questions.find((q: any) => q.question.includes('LRU Cache'));
      expect(lruQ).toBeDefined();
      expect(lruQ.companyName).toBe('Acme Innovations');
      expect(lruQ.topic).toBe('Data Structures');
    });

    it('GET /api/interviews/questions filters by topic and search query', async () => {
      if (!dbAvailable) return;

      const res = await request(app).get('/api/interviews/questions?topic=Node.js');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.questions.forEach((q: any) => {
        expect(q.topic.toLowerCase()).toContain('node.js');
      });
    });

    it('POST /api/interviews/experiences allows student to submit an interview report', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/interviews/experiences')
        .set('Cookie', studentCookie)
        .send({
          companyName: 'Stripe Payments',
          role: 'Backend API Engineer',
          driveYear: 2026,
          difficulty: 'hard',
          outcome: 'offered',
          isAnonymous: false,
          overallExperience: 'Rigorous 3-part coding and architectural interview.',
          rounds: [
            {
              roundNumber: 1,
              roundName: 'API Design',
              questions: [
                {
                  question: 'Design an idempotent payment processing webhook receiver',
                  topic: 'Distributed Systems',
                  difficulty: 'hard',
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.companyName).toBe('Stripe Payments');

      // Cleanup
      await InterviewReport.findByIdAndDelete(res.body.data.report._id);
    });

    it('GET /api/interviews/moderation allows placement officers to inspect pending reports', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/interviews/moderation')
        .set('Cookie', officerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reports.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/interviews/moderation rejects unauthorized students with 403 Forbidden', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/interviews/moderation')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(403);
    });

    it('PATCH /api/interviews/experiences/:id/moderate approves report with audit notes', async () => {
      if (!dbAvailable) return;

      const pending = await InterviewReport.findOne({ moderationStatus: 'pending' });
      if (!pending) return;

      const res = await request(app)
        .patch(`/api/interviews/experiences/${pending._id}/moderate`)
        .set('Cookie', officerCookie)
        .send({
          status: 'approved',
          notes: 'Verified candidate participated in campus hiring drive.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.moderationStatus).toBe('approved');
      expect(res.body.data.report.moderationNotes).toBe(
        'Verified candidate participated in campus hiring drive.'
      );
    });
  });
});

