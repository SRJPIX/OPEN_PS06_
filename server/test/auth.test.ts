import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { User } from '../src/models/User';
import { StudentProfile } from '../src/models/StudentProfile';
import { Company } from '../src/models/Company';
import { hashPassword } from '../src/utils/password';
import { signAuthToken } from '../src/utils/token';
import { config } from '../src/config/env';

describe('Authentication & Role-Based Authorization Flow', () => {
  const app = createApp();
  let dbAvailable = false;

  const cleanup = async () => {
    if (!dbAvailable) return;
    const users = await User.find({ email: { $regex: /@(test-auth\.com|test-provision\.com)$/ } });
    const userIds = users.map((u) => u._id);
    await StudentProfile.deleteMany({ user: { $in: userIds } });
    await StudentProfile.deleteMany({ rollNumber: { $regex: /^CS2026/ } });
    await Company.deleteMany({ name: { $in: ['Acme Partner Labs', 'Partner Tech Inc'] } });
    await User.deleteMany({ email: { $regex: /@(test-auth\.com|test-provision\.com)$/ } });
  };

  beforeAll(async () => {
    // Attempt connection to configured MONGODB_URI (defaults to local MongoDB)
    dbAvailable = await connectDB(config.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    if (dbAvailable) {
      await cleanup();
    } else {
      console.warn(
        '[Test Notice] MongoDB is not running or unreachable at MONGODB_URI. Integration tests requiring DB persistence will be safely skipped.'
      );
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await cleanup();
      await disconnectDB();
    }
  });

  describe('1. Student Public Registration', () => {
    it('should register a student successfully with HTTP-only cookie', async () => {
      if (!dbAvailable) return;

      const payload = {
        email: 'student1@test-auth.com',
        password: 'Password123!',
        rollNumber: 'CS2026001',
        department: 'Computer Science',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.5,
      };

      const res = await request(app).post('/api/auth/register').send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data.user).toMatchObject({
        email: 'student1@test-auth.com',
        role: 'student',
        status: 'active',
      });
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.profile).toMatchObject({
        rollNumber: 'CS2026001',
        department: 'Computer Science',
      });

      // Verify HTTP-only cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(config.COOKIE_NAME);
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('should disallow client privilege escalation (ignoring client-supplied role)', async () => {
      if (!dbAvailable) return;

      const payload = {
        email: 'hacker@test-auth.com',
        password: 'Password123!',
        role: 'admin', // Malicious attempt to self-assign admin
        rollNumber: 'CS2026002',
        department: 'Computer Science',
        graduationYear: 2026,
        cgpa: 7.5,
      };

      const res = await request(app).post('/api/auth/register').send(payload);

      expect(res.status).toBe(201);
      // Must be forced to 'student'
      expect(res.body.data.user.role).toBe('student');

      const savedUser = await User.findOne({ email: 'hacker@test-auth.com' });
      expect(savedUser?.role).toBe('student');
    });

    it('should reject registration with duplicate email with 409 Conflict', async () => {
      if (!dbAvailable) return;

      const duplicatePayload = {
        email: 'student1@test-auth.com', // Already registered
        password: 'Password123!',
        rollNumber: 'CS2026003',
        department: 'Computer Science',
        graduationYear: 2026,
      };

      const res = await request(app).post('/api/auth/register').send(duplicatePayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already exists');
    });

    it('should reject registration with validation errors (status 422)', async () => {
      const invalidPayload = {
        email: 'invalid-email',
        password: '123', // Too short (< 8)
        rollNumber: 'A', // Too short (< 2)
      };

      const res = await request(app).post('/api/auth/register').send(invalidPayload);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });
  });

  describe('2. Login Flow & Credentials Security', () => {
    it('should login valid student and return HTTP-only cookie', async () => {
      if (!dbAvailable) return;

      const res = await request(app).post('/api/auth/login').send({
        email: 'student1@test-auth.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('student1@test-auth.com');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');

      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toContain(config.COOKIE_NAME);
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('should reject wrong password with generic 401 error', async () => {
      if (!dbAvailable) return;

      const res = await request(app).post('/api/auth/login').send({
        email: 'student1@test-auth.com',
        password: 'WrongPassword999!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('should reject non-existent email with generic 401 error', async () => {
      if (!dbAvailable) return;

      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@test-auth.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('should reject suspended user with 403 Forbidden', async () => {
      if (!dbAvailable) return;

      const passwordHash = await hashPassword('Password123!');
      await User.create({
        email: 'suspended@test-auth.com',
        passwordHash,
        role: 'student',
        status: 'suspended',
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'suspended@test-auth.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('suspended');
    });
  });

  describe('3. Session Restoration (GET /api/auth/me)', () => {
    it('should restore session with valid auth cookie', async () => {
      if (!dbAvailable) return;

      // Login first to get cookie
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'student1@test-auth.com',
        password: 'Password123!',
      });

      const authCookie = loginRes.headers['set-cookie'];

      const meRes = await request(app).get('/api/auth/me').set('Cookie', authCookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.user.email).toBe('student1@test-auth.com');
      expect(meRes.body.data.profile.rollNumber).toBe('CS2026001');
    });

    it('should reject session request when cookie is missing', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request when token is invalid or corrupted', async () => {
      const corruptedCookie = [`${config.COOKIE_NAME}=corrupted.invalid.jwt; Path=/`];
      const res = await request(app).get('/api/auth/me').set('Cookie', corruptedCookie);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('4. Logout Flow', () => {
    it('should clear the auth cookie upon logout', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      // Cookie is cleared by setting expires in the past or maxAge=0
      expect(cookies[0]).toMatch(/Max-Age=0|expires=Thu, 01 Jan 1970/i);
    });
  });

  describe('5. Role-Based Access Control Middleware', () => {
    let studentCookie: string[];
    let adminCookie: string[];
    let officerCookie: string[];
    let recruiterCookie: string[];

    beforeAll(async () => {
      if (!dbAvailable) return;

      const passwordHash = await hashPassword('Password123!');

      // Create admin user
      const admin = await User.create({
        email: 'admin@test-auth.com',
        passwordHash,
        role: 'admin',
        status: 'active',
      });
      const adminToken = signAuthToken({
        userId: admin._id.toString(),
        role: 'admin',
      });
      adminCookie = [`${config.COOKIE_NAME}=${adminToken}; Path=/`];

      // Create placement officer
      const officer = await User.create({
        email: 'officer@test-auth.com',
        passwordHash,
        role: 'placement_officer',
        status: 'active',
      });
      const officerToken = signAuthToken({
        userId: officer._id.toString(),
        role: 'placement_officer',
      });
      officerCookie = [`${config.COOKIE_NAME}=${officerToken}; Path=/`];

      // Create recruiter
      const recruiter = await User.create({
        email: 'recruiter@test-auth.com',
        passwordHash,
        role: 'recruiter',
        status: 'active',
      });
      const recruiterToken = signAuthToken({
        userId: recruiter._id.toString(),
        role: 'recruiter',
      });
      recruiterCookie = [`${config.COOKIE_NAME}=${recruiterToken}; Path=/`];

      // Student token
      const student = await User.findOne({ email: 'student1@test-auth.com' });
      if (student) {
        const studentToken = signAuthToken({
          userId: student._id.toString(),
          role: 'student',
        });
        studentCookie = [`${config.COOKIE_NAME}=${studentToken}; Path=/`];
      }
    });

    it('should permit student on student-only route and deny on officer route', async () => {
      if (!dbAvailable) return;

      // Student accessing student route -> 200
      const okRes = await request(app)
        .get('/api/auth/role-check/student')
        .set('Cookie', studentCookie);
      expect(okRes.status).toBe(200);
      expect(okRes.body.data.role).toBe('student');

      // Student accessing placement officer route -> 403 Forbidden
      const deniedRes = await request(app)
        .get('/api/auth/role-check/placement-officer')
        .set('Cookie', studentCookie);
      expect(deniedRes.status).toBe(403);
      expect(deniedRes.body.error.code).toBe('FORBIDDEN');
    });

    it('should permit placement officer on officer route and deny on recruiter route', async () => {
      if (!dbAvailable) return;

      const okRes = await request(app)
        .get('/api/auth/role-check/placement-officer')
        .set('Cookie', officerCookie);
      expect(okRes.status).toBe(200);
      expect(okRes.body.data.role).toBe('placement_officer');

      const deniedRes = await request(app)
        .get('/api/auth/role-check/recruiter')
        .set('Cookie', officerCookie);
      expect(deniedRes.status).toBe(403);
    });

    it('should permit recruiter on recruiter route and deny on officer route', async () => {
      if (!dbAvailable) return;

      const okRes = await request(app)
        .get('/api/auth/role-check/recruiter')
        .set('Cookie', recruiterCookie);
      expect(okRes.status).toBe(200);
      expect(okRes.body.data.role).toBe('recruiter');

      const deniedRes = await request(app)
        .get('/api/auth/role-check/placement-officer')
        .set('Cookie', recruiterCookie);
      expect(deniedRes.status).toBe(403);
    });

    describe('6. Secure Privileged Account Provisioning (Officers & Recruiters)', () => {
      it('should reject unauthenticated request to POST /api/auth/users with 401', async () => {
        const res = await request(app)
          .post('/api/auth/users')
          .send({
            email: 'unauth@test-provision.com',
            password: 'Password123!',
            role: 'recruiter',
          });
        expect(res.status).toBe(401);
      });

      it('should reject student attempting to call POST /api/auth/users with 403 Forbidden', async () => {
        if (!dbAvailable) return;

        const res = await request(app)
          .post('/api/auth/users')
          .set('Cookie', studentCookie)
          .send({
            email: 'badactor@test-provision.com',
            password: 'Password123!',
            role: 'placement_officer',
          });
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('should allow admin to provision a placement_officer account', async () => {
        if (!dbAvailable) return;

        const res = await request(app)
          .post('/api/auth/users')
          .set('Cookie', adminCookie)
          .send({
            email: 'officer.new@test-provision.com',
            password: 'SecurePassword123!',
            role: 'placement_officer',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user).toMatchObject({
          email: 'officer.new@test-provision.com',
          role: 'placement_officer',
          status: 'active',
        });
        expect(res.body.data.user).not.toHaveProperty('passwordHash');

        // Verify account can log in and receives the correct role
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'officer.new@test-provision.com',
            password: 'SecurePassword123!',
          });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.data.user.role).toBe('placement_officer');
      });

      it('should allow admin to provision a recruiter account with linked company', async () => {
        if (!dbAvailable) return;

        const res = await request(app)
          .post('/api/auth/users')
          .set('Cookie', adminCookie)
          .send({
            email: 'recruiter.new@test-provision.com',
            password: 'SecurePassword123!',
            role: 'recruiter',
            companyName: 'Acme Partner Labs',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user).toMatchObject({
          email: 'recruiter.new@test-provision.com',
          role: 'recruiter',
        });
        expect(res.body.data.company).toBeDefined();

        // Verify login returns recruiter role
        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'recruiter.new@test-provision.com',
            password: 'SecurePassword123!',
          });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.data.user.role).toBe('recruiter');
      });

      it('should allow placement_officer to provision a recruiter account for campus hiring partner', async () => {
        if (!dbAvailable) return;

        const res = await request(app)
          .post('/api/auth/users')
          .set('Cookie', officerCookie)
          .send({
            email: 'partner.recruiter@test-provision.com',
            password: 'SecurePassword123!',
            role: 'recruiter',
            companyName: 'Partner Tech Inc',
          });

        expect(res.status).toBe(201);
        expect(res.body.data.user.role).toBe('recruiter');
      });

      it('should reject placement_officer attempting to provision another placement_officer or admin with 403 Forbidden', async () => {
        if (!dbAvailable) return;

        // Attempting to create admin
        const adminAttempt = await request(app)
          .post('/api/auth/users')
          .set('Cookie', officerCookie)
          .send({
            email: 'fake.admin@test-provision.com',
            password: 'SecurePassword123!',
            role: 'admin',
          });
        expect(adminAttempt.status).toBe(403);
        expect(adminAttempt.body.error.message).toContain('only authorized to provision recruiter accounts');

        // Attempting to create placement officer
        const officerAttempt = await request(app)
          .post('/api/auth/users')
          .set('Cookie', officerCookie)
          .send({
            email: 'fake.officer@test-provision.com',
            password: 'SecurePassword123!',
            role: 'placement_officer',
          });
        expect(officerAttempt.status).toBe(403);
      });

      it('should reject duplicate email during provisioning with 409 Conflict', async () => {
        if (!dbAvailable) return;

        const res = await request(app)
          .post('/api/auth/users')
          .set('Cookie', adminCookie)
          .send({
            email: 'officer.new@test-provision.com', // Already provisioned
            password: 'SecurePassword123!',
            role: 'recruiter',
          });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('CONFLICT');
      });
    });
  });
});
