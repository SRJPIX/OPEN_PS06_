import { Types } from 'mongoose';
import { User } from '../models/User';
import { StudentProfile } from '../models/StudentProfile';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { Skill } from '../models/Skill';
import { StudentSkill } from '../models/StudentSkill';
import { Evidence } from '../models/Evidence';
import { Application } from '../models/Application';
import { Resume } from '../models/Resume';
import { hashPassword } from './password';
import { seedCanonicalSkills } from './skillNormalizer';
import { seedDemoJobs } from './demoJobsSeed';
import { config } from '../config/env';

/**
 * Safe, idempotent development seed script.
 * Never deletes or overwrites existing user data.
 * Populates missing jobs, evidence, and applications so recruiter and student workflows are fully functional.
 */
export const runSafeSeed = async (): Promise<{
  jobsCount: number;
  applicationsCount: number;
  evidenceCount: number;
}> => {
  console.log('[SafeSeed] Ensuring canonical skills are seeded...');
  await seedCanonicalSkills();

  const defaultPassword = config.DEMO_USER_PASSWORD || 'EvidraDemo123!';
  const passwordHash = await hashPassword(defaultPassword);

  // 1. Ensure Recruiter User Exists
  let recruiterUser = await User.findOne({ email: 'recruiter@evidra.dev' });
  if (!recruiterUser) {
    console.log('[SafeSeed] Creating recruiter@evidra.dev...');
    recruiterUser = await User.create({
      email: 'recruiter@evidra.dev',
      passwordHash,
      role: 'recruiter',
      status: 'active',
      isEmailVerified: true,
    });
  }

  // 2. Ensure Recruiter's Company Exists and is Authorized
  let company = await Company.findOne({
    $or: [
      { createdBy: recruiterUser._id },
      { authorizedRecruiters: recruiterUser._id },
    ],
  });

  if (!company) {
    console.log('[SafeSeed] Creating company for recruiter...');
    company = await Company.create({
      name: 'Evidra Partner Labs [DEMO]',
      industry: 'Enterprise Software & Distributed Systems',
      website: 'https://partnerlabs.demo.evidra.dev',
      description: 'Pioneering high-throughput distributed architectures, verifiable talent evaluation, and enterprise cloud systems.',
      isVerified: true,
      createdBy: recruiterUser._id,
      authorizedRecruiters: [recruiterUser._id as Types.ObjectId],
    });
  } else {
    // Ensure recruiterUser is in authorizedRecruiters
    if (!company.authorizedRecruiters?.some((id) => id.toString() === recruiterUser!._id.toString())) {
      company.authorizedRecruiters = company.authorizedRecruiters || [];
      company.authorizedRecruiters.push(recruiterUser._id as Types.ObjectId);
      await company.save();
    }
  }

  // 3. Resolve canonical skills for job postings
  const nodeSkill = await Skill.findOne({ slug: 'nodejs' }) || await Skill.findOne({ slug: 'node-js' });
  const reactSkill = await Skill.findOne({ slug: 'react' });
  const tsSkill = await Skill.findOne({ slug: 'typescript' });
  const jsSkill = await Skill.findOne({ slug: 'javascript' });
  const htmlSkill = await Skill.findOne({ slug: 'html5' }) || await Skill.findOne({ slug: 'html' });
  const mongoSkill = await Skill.findOne({ slug: 'mongodb' });

  // 4. Ensure Company Has Active Published Jobs
  let companyJobs = await Job.find({ company: company._id });
  if (companyJobs.length === 0) {
    console.log('[SafeSeed] Creating published requisitions for recruiter company...');
    const job1 = await Job.create({
      company: company._id,
      title: 'Associate Fullstack Engineer [DEMO]',
      description: 'Join our enterprise platform engineering team. Build robust, scalable web services with Node.js, Express, React, and MongoDB with deterministic type safety.',
      responsibilities: [
        'Design and implement RESTful APIs and real-time backend microservices',
        'Build accessible, performant React frontend user interfaces',
        'Participate in peer code reviews and architectural system design sessions',
      ],
      location: 'Bengaluru / Hybrid',
      workplaceType: 'hybrid',
      jobType: 'full_time',
      requiredSkills: [nodeSkill?._id, reactSkill?._id, jsSkill?._id].filter(Boolean),
      preferredSkills: [tsSkill?._id, mongoSkill?._id].filter(Boolean),
      minCgpa: 6.5,
      eligibleDepartments: [
        'Computer Science & Engineering',
        'Information Technology',
        'Artificial Intelligence & Data Science',
      ],
      eligibleGraduationYears: [2025, 2026, 2027],
      salaryRange: { min: 1200000, max: 1800000, currency: 'INR' },
      status: 'open',
      postedBy: recruiterUser._id,
      sourceType: 'manual_submission',
      requisitionId: 'REQ-EPL-FS-101',
    });

    const job2 = await Job.create({
      company: company._id,
      title: 'Frontend React Developer [DEMO]',
      description: 'Develop responsive, accessible, and high-performance user interfaces in React, TypeScript, and Tailwind CSS for distributed analytics dashboards.',
      responsibilities: [
        'Develop modular, reusable React components with clean state management',
        'Ensure WCAG 2.1 accessibility and cross-browser compatibility',
      ],
      location: 'Remote',
      workplaceType: 'remote',
      jobType: 'full_time',
      requiredSkills: [reactSkill?._id, jsSkill?._id, htmlSkill?._id].filter(Boolean),
      preferredSkills: [tsSkill?._id].filter(Boolean),
      minCgpa: 6.0,
      eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
      eligibleGraduationYears: [2025, 2026, 2027],
      salaryRange: { min: 1000000, max: 1500000, currency: 'INR' },
      status: 'open',
      postedBy: recruiterUser._id,
      sourceType: 'manual_submission',
      requisitionId: 'REQ-EPL-FE-102',
    });

    companyJobs = [job1, job2];
  }

  // 5. Check all students in DB and ensure they have evidence and applications
  const allStudents = await StudentProfile.find().populate('user');
  let evidenceCreated = 0;
  let applicationsCreated = 0;

  for (const student of allStudents) {
    const studentSkills = await StudentSkill.find({ student: student._id });

    // If student has skills with no evidence, create submitted evidence items
    for (const ss of studentSkills) {
      const existingEvidence = await Evidence.findOne({
        student: student._id,
        skills: ss.skill,
      });

      if (!existingEvidence) {
        const skillDoc = await Skill.findById(ss.skill);
        const skillName = skillDoc?.name || 'Technical Skill';
        const ev = await Evidence.create({
          student: student._id,
          skills: [ss.skill],
          type: 'evaluated_project',
          title: `${skillName} Production Project [DEMO]`,
          description: `Comprehensive implementation and architectural review demonstrating proficiency in ${skillName}. Includes unit testing, clean modular design, and documentation.`,
          url: `https://github.com/evidra-demo/${skillDoc?.slug || 'project'}-showcase`,
          status: 'submitted', // SUBMITTED: ready for recruiter review!
          isVerified: false,
          score: 88,
          maxScore: 100,
          auditHistory: [],
        });

        ss.status = 'submitted';
        ss.isVerified = false;
        if (!ss.evidence) ss.evidence = [];
        ss.evidence.push(ev._id as Types.ObjectId);
        await ss.save();
        evidenceCreated++;
      }
    }

    // Ensure student has applied to at least one job from this company
    const primaryJob = companyJobs[0];
    const existingApp = await Application.findOne({
      student: student._id,
      job: primaryJob._id,
    });

    if (!existingApp) {
      console.log(`[SafeSeed] Creating candidate application for student roll: ${student.rollNumber}...`);
      let resume = await Resume.findOne({ student: student._id });
      if (!resume) {
        resume = await Resume.create({
          student: student._id,
          title: 'Campus Verified ATS Resume [DEMO]',
          version: 1,
          validationStatus: 'PARTIALLY_VERIFIED',
          bullets: [
            {
              bulletId: 'b-1',
              section: 'skills',
              text: 'Proficient in modern fullstack web technologies and responsive design',
              validationStatus: 'SUPPORTED',
              confidenceScore: 90,
              evidenceIds: [],
              skillIds: [],
            },
          ],
          isPrimary: true,
          status: 'generated',
        });
      }

      await Application.create({
        student: student._id,
        job: primaryJob._id,
        resume: resume._id,
        resumeVersion: resume.version || 1,
        currentStatus: 'APPLIED',
        appliedAt: new Date(Date.now() - 86400000 * 2),
      });
      applicationsCreated++;
    }
  }

  // 7. Seed 30 realistic demo jobs across 10 companies and 12 categories
  console.log('[SafeSeed] Seeding 30 realistic demo job requisitions...');
  await seedDemoJobs();

  const finalJobs = await Job.find({ company: company._id });
  const finalApps = await Application.find({ job: { $in: finalJobs.map((j) => j._id) } });

  console.log(`[SafeSeed] Complete: ${finalJobs.length} primary company jobs, ${finalApps.length} candidates in shortlist.`);
  return {
    jobsCount: finalJobs.length,
    applicationsCount: finalApps.length,
    evidenceCount: evidenceCreated,
  };
};
