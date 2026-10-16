import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import {
  User,
  StudentProfile,
  Company,
  Skill,
  StudentSkill,
  Evidence,
  Project,
  Assessment,
  Job,
  JobSource,
  Resume,
  ResumeClaim,
  Application,
  ApplicationStatusHistory,
  AuditLog,
} from '../src/models';

describe('Mongoose Models Schema & Validation', () => {
  describe('User Model', () => {
    it('should validate valid user document', () => {
      const user = new User({
        email: 'student@example.com',
        passwordHash: 'hashed_password_string',
        role: 'student',
      });
      const error = user.validateSync();
      expect(error).toBeUndefined();
      expect(user.role).toBe('student');
      expect(user.status).toBe('active');
      expect(user.isEmailVerified).toBe(false);
    });

    it('should fail validation if email is missing or invalid', () => {
      const user = new User({
        passwordHash: 'hashed_password_string',
        role: 'student',
      });
      const error = user.validateSync();
      expect(error?.errors.email).toBeDefined();

      const invalidEmailUser = new User({
        email: 'not-an-email',
        passwordHash: 'hashed_password_string',
        role: 'student',
      });
      const invalidEmailErr = invalidEmailUser.validateSync();
      expect(invalidEmailErr?.errors.email).toBeDefined();
    });

    it('should reject invalid role enum', () => {
      const user = new User({
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        role: 'super_hero' as unknown,
      });
      const error = user.validateSync();
      expect(error?.errors.role).toBeDefined();
    });
  });

  describe('StudentProfile Model', () => {
    it('should validate valid student profile document', () => {
      const profile = new StudentProfile({
        user: new mongoose.Types.ObjectId(),
        rollNumber: 'cs2024001',
        department: 'Computer Science & Engineering',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 8.75,
        links: {
          github: 'https://github.com/student',
        },
      });
      const error = profile.validateSync();
      expect(error).toBeUndefined();
      expect(profile.rollNumber).toBe('CS2024001'); // Uppercased by schema setter
    });

    it('should reject invalid CGPA (> 10)', () => {
      const profile = new StudentProfile({
        user: new mongoose.Types.ObjectId(),
        rollNumber: 'CS2024002',
        department: 'Information Technology',
        degree: 'B.Tech',
        graduationYear: 2026,
        cgpa: 11.5,
      });
      const error = profile.validateSync();
      expect(error?.errors.cgpa).toBeDefined();
    });
  });

  describe('Company Model', () => {
    it('should validate valid company', () => {
      const company = new Company({
        name: 'TechCorp Global',
        industry: 'Software Engineering',
        createdBy: new mongoose.Types.ObjectId(),
      });
      const error = company.validateSync();
      expect(error).toBeUndefined();
      expect(company.isVerified).toBe(false);
    });

    it('should require company name and industry', () => {
      const company = new Company({
        createdBy: new mongoose.Types.ObjectId(),
      });
      const error = company.validateSync();
      expect(error?.errors.name).toBeDefined();
      expect(error?.errors.industry).toBeDefined();
    });
  });

  describe('Skill & StudentSkill Models', () => {
    it('should validate Skill with category enum', () => {
      const skill = new Skill({
        name: 'TypeScript',
        category: 'backend',
      });
      const error = skill.validateSync();
      expect(error).toBeUndefined();
      expect(skill.name).toBe('typescript'); // lowercased by schema
    });

    it('should validate StudentSkill junction model', () => {
      const studentSkill = new StudentSkill({
        student: new mongoose.Types.ObjectId(),
        skill: new mongoose.Types.ObjectId(),
        proficiency: 'advanced',
        confidenceScore: 85,
      });
      const error = studentSkill.validateSync();
      expect(error).toBeUndefined();
      expect(studentSkill.isVerified).toBe(false);
    });
  });

  describe('Evidence & Project Models', () => {
    it('should validate Evidence document with type enum', () => {
      const evidence = new Evidence({
        student: new mongoose.Types.ObjectId(),
        type: 'github_repo',
        title: 'Fullstack Microservices System',
        url: 'https://github.com/student/microservices',
      });
      const error = evidence.validateSync();
      expect(error).toBeUndefined();
    });

    it('should validate Project with referenced skills and evidence', () => {
      const project = new Project({
        student: new mongoose.Types.ObjectId(),
        title: 'Evidra Platform',
        description: 'AI placement intelligence system',
        skills: [new mongoose.Types.ObjectId()],
      });
      const error = project.validateSync();
      expect(error).toBeUndefined();
      expect(project.isOngoing).toBe(false);
    });
  });

  describe('Assessment Model', () => {
    it('should validate Assessment document', () => {
      const assessment = new Assessment({
        student: new mongoose.Types.ObjectId(),
        title: 'Data Structures Assessment',
        provider: 'internal',
        score: 92,
        maxScore: 100,
        passed: true,
      });
      const error = assessment.validateSync();
      expect(error).toBeUndefined();
      expect(assessment.passed).toBe(true);
    });
  });

  describe('Job & JobSource Models', () => {
    it('should validate JobSource', () => {
      const source = new JobSource({
        name: 'Annual Campus Placement Drive 2026',
        type: 'campus_drive',
      });
      const error = source.validateSync();
      expect(error).toBeUndefined();
      expect(source.isActive).toBe(true);
    });

    it('should validate Job document with required enums and skills', () => {
      const job = new Job({
        company: new mongoose.Types.ObjectId(),
        title: 'Junior Software Engineer',
        description: 'Develop modern full-stack web applications',
        location: 'Bengaluru, India',
        workplaceType: 'hybrid',
        jobType: 'full_time',
        requiredSkills: [new mongoose.Types.ObjectId()],
        postedBy: new mongoose.Types.ObjectId(),
      });
      const error = job.validateSync();
      expect(error).toBeUndefined();
      expect(job.status).toBe('draft');
      expect(job.minCgpa).toBe(0);
    });
  });

  describe('Resume & ResumeClaim Models', () => {
    it('should validate Resume document', () => {
      const resume = new Resume({
        student: new mongoose.Types.ObjectId(),
        title: 'Full Stack Engineer Resume',
        targetRole: 'Full Stack Developer',
      });
      const error = resume.validateSync();
      expect(error).toBeUndefined();
      expect(resume.version).toBe(1);
      expect(resume.status).toBe('draft');
    });

    it('should validate ResumeClaim document with claim type enum', () => {
      const claim = new ResumeClaim({
        resume: new mongoose.Types.ObjectId(),
        student: new mongoose.Types.ObjectId(),
        claimType: 'skill',
        text: 'Engineered microservices using Express and TypeScript',
        confidenceScore: 90,
      });
      const error = claim.validateSync();
      expect(error).toBeUndefined();
      expect(claim.isVerified).toBe(false);
    });
  });

  describe('Application, ApplicationStatusHistory & AuditLog Models', () => {
    it('should validate Application document', () => {
      const app = new Application({
        student: new mongoose.Types.ObjectId(),
        job: new mongoose.Types.ObjectId(),
        resume: new mongoose.Types.ObjectId(),
      });
      const error = app.validateSync();
      expect(error).toBeUndefined();
      expect(app.currentStatus).toBe('applied');
    });

    it('should validate ApplicationStatusHistory document', () => {
      const history = new ApplicationStatusHistory({
        application: new mongoose.Types.ObjectId(),
        fromStatus: 'applied',
        toStatus: 'screening',
        changedBy: new mongoose.Types.ObjectId(),
        notes: 'Passed initial eligibility screening',
      });
      const error = history.validateSync();
      expect(error).toBeUndefined();
    });

    it('should validate AuditLog document', () => {
      const audit = new AuditLog({
        action: 'APPLICATION_STATUS_UPDATE',
        entityType: 'Application',
        entityId: 'app_123',
        ipAddress: '127.0.0.1',
      });
      const error = audit.validateSync();
      expect(error).toBeUndefined();
    });
  });
});
