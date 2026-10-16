import { config } from '../config/env';
import { User } from '../models/User';
import { StudentProfile } from '../models/StudentProfile';
import { Company } from '../models/Company';
import { hashPassword } from './password';

export interface SeedResult {
  student: string;
  recruiter: string;
  officer: string;
  admin: string;
}

/**
 * Development-only seed mechanism.
 * Strictly forbidden and disabled in production environments.
 */
export const seedDemoUsers = async (): Promise<SeedResult> => {
  if (config.NODE_ENV === 'production') {
    throw new Error('[Seed Error] Demo user seeding is strictly prohibited in production mode.');
  }

  console.log('[Seed] Seeding development demo accounts...');
  const defaultPassword = config.DEMO_USER_PASSWORD;
  const passwordHash = await hashPassword(defaultPassword);

  // 1. Demo Student
  let studentUser = await User.findOne({ email: 'student@evidra.dev' });
  if (!studentUser) {
    studentUser = await User.create({
      email: 'student@evidra.dev',
      passwordHash,
      role: 'student',
      status: 'active',
      isEmailVerified: true,
    });
  } else {
    studentUser.passwordHash = passwordHash;
    await studentUser.save();
  }

  let studentProfile = await StudentProfile.findOne({ user: studentUser._id });
  if (!studentProfile) {
    studentProfile = await StudentProfile.create({
      user: studentUser._id,
      rollNumber: 'CS2024001',
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      graduationYear: 2026,
      cgpa: 8.85,
      phone: '+91 9876543210',
      bio: 'Pre-final year CSE student interested in Fullstack & Distributed Systems.',
      links: {
        github: 'https://github.com/evidra-student',
        linkedin: 'https://linkedin.com/in/evidra-student',
      },
    });
  }

  // 2. Demo Recruiter
  let recruiterUser = await User.findOne({ email: 'recruiter@evidra.dev' });
  if (!recruiterUser) {
    recruiterUser = await User.create({
      email: 'recruiter@evidra.dev',
      passwordHash,
      role: 'recruiter',
      status: 'active',
      isEmailVerified: true,
    });
  } else {
    recruiterUser.passwordHash = passwordHash;
    await recruiterUser.save();
  }

  let company = await Company.findOne({ name: 'Evidra Partner Labs' });
  if (!company) {
    company = await Company.create({
      name: 'Evidra Partner Labs',
      industry: 'Artificial Intelligence & Software',
      website: 'https://evidra.dev',
      description: 'Engineering cutting-edge AI placement intelligence solutions.',
      isVerified: true,
      createdBy: recruiterUser._id,
    });
  }

  // 3. Demo Placement Officer
  let officerUser = await User.findOne({ email: 'officer@evidra.dev' });
  if (!officerUser) {
    officerUser = await User.create({
      email: 'officer@evidra.dev',
      passwordHash,
      role: 'placement_officer',
      status: 'active',
      isEmailVerified: true,
    });
  } else {
    officerUser.passwordHash = passwordHash;
    await officerUser.save();
  }

  // 4. Demo Admin
  let adminUser = await User.findOne({ email: 'admin@evidra.dev' });
  if (!adminUser) {
    adminUser = await User.create({
      email: 'admin@evidra.dev',
      passwordHash,
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
    });
  } else {
    adminUser.passwordHash = passwordHash;
    await adminUser.save();
  }

  console.log('[Seed] Demo accounts ready:');
  console.log(`  - Student:          student@evidra.dev   / ${defaultPassword}`);
  console.log(`  - Recruiter:        recruiter@evidra.dev / ${defaultPassword}`);
  console.log(`  - Placement Officer: officer@evidra.dev   / ${defaultPassword}`);
  console.log(`  - Admin:            admin@evidra.dev     / ${defaultPassword}`);

  return {
    student: studentUser.email,
    recruiter: recruiterUser.email,
    officer: officerUser.email,
    admin: adminUser.email,
  };
};
