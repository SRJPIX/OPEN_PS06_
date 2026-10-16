import { Types } from 'mongoose';
import { config } from '../config/env';
import { User, IUser } from '../models/User';
import { StudentProfile, IStudentProfile } from '../models/StudentProfile';
import { Company, ICompany } from '../models/Company';
import { Job, IJob } from '../models/Job';
import { JobSource } from '../models/JobSource';
import { Skill, ISkill } from '../models/Skill';
import { StudentSkill } from '../models/StudentSkill';
import { Evidence } from '../models/Evidence';
import { Project } from '../models/Project';
import { Assessment } from '../models/Assessment';
import { Resume, IResume } from '../models/Resume';
import { ResumeClaim } from '../models/ResumeClaim';
import { Application, IApplication } from '../models/Application';
import { ApplicationStatusHistory } from '../models/ApplicationStatusHistory';
import { hashPassword } from './password';
import { seedCanonicalSkills } from './skillNormalizer';

export interface ComprehensiveSeedResult {
  officer: string;
  admin: string;
  recruiters: string[];
  students: string[];
  companiesCount: number;
  jobsCount: number;
  skillsCount: number;
  applicationsCount: number;
}

/**
 * Repeatable, comprehensive demonstration dataset for Evidra hackathon demonstration.
 * Strictly forbidden and disabled in production environments.
 */
export const seedDemoUsers = async (): Promise<ComprehensiveSeedResult> => {
  if (config.NODE_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('[Seed Error] Demo seeding is strictly prohibited in production mode.');
  }

  console.log('[Seed] Seeding canonical skills dictionary...');
  await seedCanonicalSkills();

  const defaultPassword = config.DEMO_USER_PASSWORD || 'EvidraDemo123!';
  const passwordHash = await hashPassword(defaultPassword);

  console.log('[Seed] Cleaning up previous demo records if present...');
  const existingDemoUsers = await User.find({
    email: { $regex: /@(evidra\.dev|evidra-demo\.dev)$/ },
  });
  const demoUserIds = existingDemoUsers.map((u) => u._id);

  const demoCompanies = await Company.find({
    $or: [{ createdBy: { $in: demoUserIds } }, { name: { $regex: /\[DEMO\]/ } }],
  });
  const demoCompanyIds = demoCompanies.map((c) => c._id);

  const demoProfiles = await StudentProfile.find({
    $or: [{ user: { $in: demoUserIds } }, { rollNumber: { $regex: /^DEMO/ } }],
  });
  const demoProfileIds = demoProfiles.map((p) => p._id);

  const demoJobs = await Job.find({
    $or: [{ company: { $in: demoCompanyIds } }, { title: { $regex: /\[DEMO\]/ } }],
  });
  const demoJobIds = demoJobs.map((j) => j._id);

  await ApplicationStatusHistory.deleteMany({
    $or: [
      { changedBy: { $in: demoUserIds } },
      {
        application: { $in: await Application.find({ job: { $in: demoJobIds } }).distinct('_id') },
      },
    ],
  });
  await Application.deleteMany({
    $or: [{ student: { $in: demoProfileIds } }, { job: { $in: demoJobIds } }],
  });
  await ResumeClaim.deleteMany({ student: { $in: demoProfileIds } });
  await Resume.deleteMany({ student: { $in: demoProfileIds } });
  await Assessment.deleteMany({ student: { $in: demoProfileIds } });
  await Project.deleteMany({ student: { $in: demoProfileIds } });
  await Evidence.deleteMany({ student: { $in: demoProfileIds } });
  await StudentSkill.deleteMany({ student: { $in: demoProfileIds } });
  await StudentProfile.deleteMany({ _id: { $in: demoProfileIds } });
  await Job.deleteMany({ _id: { $in: demoJobIds } });
  await JobSource.deleteMany({ name: { $regex: /\[DEMO\]/ } });
  await Company.deleteMany({ _id: { $in: demoCompanyIds } });
  await User.deleteMany({ _id: { $in: demoUserIds } });

  // 1. Fetch Canonical Skills
  const skillSlugs = [
    'react',
    'javascript',
    'typescript',
    'nodejs',
    'express',
    'python',
    'java',
    'mongodb',
    'postgresql',
    'docker',
    'kubernetes',
    'aws',
    'git',
    'tailwind',
    'html',
    'css',
  ];
  const skillsMap = new Map<string, ISkill>();
  for (const slug of skillSlugs) {
    const s = await Skill.findOne({ slug });
    if (s) skillsMap.set(slug, s);
  }

  // 2. Demonstration Administrative Accounts
  console.log('[Seed] Creating Placement Officer, Admin & Recruiters...');
  const officerUser = await User.create({
    email: 'officer@evidra.dev',
    passwordHash,
    role: 'placement_officer',
    status: 'active',
    isEmailVerified: true,
  });

  const adminUser = await User.create({
    email: 'admin@evidra.dev',
    passwordHash,
    role: 'admin',
    status: 'active',
    isEmailVerified: true,
  });

  const recruiter1 = await User.create({
    email: 'recruiter.acme@evidra-demo.dev',
    passwordHash,
    role: 'recruiter',
    status: 'active',
    isEmailVerified: true,
  });

  const defaultRecruiter = await User.create({
    email: 'recruiter@evidra.dev',
    passwordHash,
    role: 'recruiter',
    status: 'active',
    isEmailVerified: true,
  });

  const recruiter2 = await User.create({
    email: 'recruiter.nexus@evidra-demo.dev',
    passwordHash,
    role: 'recruiter',
    status: 'active',
    isEmailVerified: true,
  });

  const recruiter3 = await User.create({
    email: 'recruiter.quantum@evidra-demo.dev',
    passwordHash,
    role: 'recruiter',
    status: 'active',
    isEmailVerified: true,
  });

  // 3. Fictional Companies (At least 3)
  console.log('[Seed] Creating 3 Fictional Companies...');
  const company1 = await Company.create({
    name: 'Acme Innovations [DEMO]',
    industry: 'Software Engineering & AI',
    website: 'https://acme-innovations.demo.evidra.dev',
    description: 'Pioneering intelligent enterprise platforms and developer productivity suites.',
    isVerified: true,
    createdBy: recruiter1._id,
    authorizedRecruiters: [recruiter1._id as Types.ObjectId, defaultRecruiter._id as Types.ObjectId],
  });

  const company2 = await Company.create({
    name: 'Nexus Cloud Systems [DEMO]',
    industry: 'Cloud Infrastructure & Distributed Systems',
    website: 'https://nexus-cloud.demo.evidra.dev',
    description:
      'Architecting resilient Kubernetes orchestration and high-availability cloud meshes.',
    isVerified: true,
    createdBy: recruiter2._id,
    authorizedRecruiters: [recruiter2._id as Types.ObjectId],
  });

  const company3 = await Company.create({
    name: 'Quantum Fintech [DEMO]',
    industry: 'Financial Technology & Quantitative Analytics',
    website: 'https://quantum-fintech.demo.evidra.dev',
    description: 'High-frequency algorithmic trading and ultra-low latency settlement gateways.',
    isVerified: true,
    createdBy: recruiter3._id,
    authorizedRecruiters: [recruiter3._id as Types.ObjectId],
  });

  // 4. Job Sources
  const internalPortalSource = await JobSource.create({
    name: 'Campus Placement Portal [DEMO]',
    type: 'internal_placement',
    description: 'Direct institutional recruiter postings.',
    isActive: true,
  });

  const partnerFeedSource = await JobSource.create({
    name: 'Partner Aggregated Feed [DEMO]',
    type: 'partner_posting',
    description: 'External consortium feed synchronisation.',
    isActive: true,
  });

  // 5. Job Openings (At least 5 + duplicate)
  console.log('[Seed] Creating Job Openings & Provenance References...');
  const reactSkill = skillsMap.get('react')!._id as Types.ObjectId;
  const jsSkill = skillsMap.get('javascript')!._id as Types.ObjectId;
  const tsSkill = skillsMap.get('typescript')!._id as Types.ObjectId;
  const nodeSkill = skillsMap.get('nodejs')!._id as Types.ObjectId;
  const expressSkill = skillsMap.get('express')!._id as Types.ObjectId;
  const mongoSkill = skillsMap.get('mongodb')!._id as Types.ObjectId;
  const pgSkill = skillsMap.get('postgresql')!._id as Types.ObjectId;
  const dockerSkill = skillsMap.get('docker')!._id as Types.ObjectId;
  const k8sSkill = skillsMap.get('kubernetes')!._id as Types.ObjectId;
  const awsSkill = skillsMap.get('aws')!._id as Types.ObjectId;
  const pythonSkill = skillsMap.get('python')!._id as Types.ObjectId;
  const tailwindSkill = skillsMap.get('tailwind')!._id as Types.ObjectId;

  // Job 1: Primary Opening - Frontend Developer Intern
  const frontendJob = await Job.create({
    company: company1._id,
    title: 'Frontend Developer Intern [DEMO]',
    description:
      'Develop responsive, accessible, component-driven user interfaces in React and TypeScript.',
    responsibilities: [
      'Implement interactive design system components with Tailwind CSS',
      'Optimize Web Vitals and client-side bundle efficiency',
      'Collaborate with backend engineers to integrate RESTful endpoints',
    ],
    location: 'Bengaluru',
    workplaceType: 'hybrid',
    jobType: 'internship',
    requiredSkills: [reactSkill, jsSkill, tsSkill],
    preferredSkills: [tailwindSkill],
    minCgpa: 7.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2026],
    salaryRange: { min: 45000, max: 65000, currency: 'INR' },
    status: 'open',
    postedBy: officerUser._id,
    source: internalPortalSource._id,
    sourceType: 'internal_placement',
    requisitionId: 'REQ-ACME-FE-101',
    sourceUrl: 'https://careers.acme-innovations.demo.evidra.dev/interns/frontend-101',
    provenance: {
      sourceType: 'internal_placement',
      requisitionId: 'REQ-ACME-FE-101',
      sourceUrl: 'https://careers.acme-innovations.demo.evidra.dev/interns/frontend-101',
      parserUsed: 'manual',
      ingestedAt: new Date(),
      ingestedBy: officerUser._id as Types.ObjectId,
      mergedFrom: [],
    },
  });

  // Job 2: Duplicate Job from Second Source (Partner Aggregated Feed)
  const duplicateFrontendJob = await Job.create({
    company: company1._id,
    title: 'Frontend Developer Intern (Partner Feed) [DEMO]',
    description:
      'Cross-posted duplicate opening: Develop responsive component-driven user interfaces in React.',
    responsibilities: [
      'Implement interactive design system components with Tailwind CSS',
      'Optimize Web Vitals and client-side bundle efficiency',
    ],
    location: 'Bengaluru',
    workplaceType: 'hybrid',
    jobType: 'internship',
    requiredSkills: [reactSkill, jsSkill],
    preferredSkills: [tsSkill, tailwindSkill],
    minCgpa: 7.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2026],
    salaryRange: { min: 45000, max: 65000, currency: 'INR' },
    status: 'archived',
    postedBy: recruiter1._id,
    source: partnerFeedSource._id,
    sourceType: 'partner_posting',
    requisitionId: 'REQ-ACME-FE-101',
    sourceUrl: 'https://partner-feed.evidra.dev/jobs/acme-fe-101',
    duplicateOf: frontendJob._id,
    provenance: {
      sourceType: 'partner_posting',
      requisitionId: 'REQ-ACME-FE-101',
      sourceUrl: 'https://partner-feed.evidra.dev/jobs/acme-fe-101',
      partnerName: 'TechConsortium Ingestion',
      parserUsed: 'deterministic',
      ingestedAt: new Date(),
      ingestedBy: recruiter1._id as Types.ObjectId,
    },
  });

  // Record merged provenance on primary frontendJob
  frontendJob.provenance = {
    ...(frontendJob.provenance || {}),
    mergedFrom: [
      {
        jobId: duplicateFrontendJob._id as Types.ObjectId,
        requisitionId: 'REQ-ACME-FE-101',
        sourceUrl: 'https://partner-feed.evidra.dev/jobs/acme-fe-101',
        sourceType: 'partner_posting',
        mergedAt: new Date(),
        mergedBy: officerUser._id as Types.ObjectId,
        notes:
          'Merged duplicate posting from Partner Feed. Verified canonical provenance preserved.',
      },
    ],
  };
  await frontendJob.save();

  // Job 3: Backend Platform Engineer
  const backendJob = await Job.create({
    company: company1._id,
    title: 'Backend Platform Engineer [DEMO]',
    description:
      'Architect resilient event-driven microservices with Node.js, Express, MongoDB, and TypeScript.',
    responsibilities: [
      'Design RESTful and streaming APIs with robust idempotency guarantees',
      'Optimize query throughput on partitioned MongoDB clusters',
    ],
    location: 'Bengaluru',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkills: [nodeSkill, expressSkill, mongoSkill, tsSkill],
    preferredSkills: [dockerSkill],
    minCgpa: 7.0,
    eligibleDepartments: [
      'Computer Science & Engineering',
      'Information Technology',
      'Artificial Intelligence & Data Science',
    ],
    eligibleGraduationYears: [2026],
    salaryRange: { min: 1400000, max: 2000000, currency: 'INR' },
    status: 'open',
    postedBy: recruiter1._id,
    sourceType: 'manual_submission',
    requisitionId: 'REQ-ACME-BE-202',
  });

  // Job 4: Cloud Infrastructure & DevOps Associate
  const devopsJob = await Job.create({
    company: company2._id,
    title: 'Cloud Infrastructure & DevOps Associate [DEMO]',
    description:
      'Build automated continuous delivery pipelines, Docker containers, and Kubernetes clusters on AWS.',
    location: 'Remote',
    workplaceType: 'remote',
    jobType: 'full_time',
    requiredSkills: [dockerSkill, k8sSkill, awsSkill],
    preferredSkills: [tsSkill, pythonSkill],
    minCgpa: 7.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2026],
    salaryRange: { min: 1500000, max: 2200000, currency: 'INR' },
    status: 'open',
    postedBy: recruiter2._id,
    requisitionId: 'REQ-NEX-OPS-303',
  });

  // Job 5: Full Stack Web Specialist
  const fullstackJob = await Job.create({
    company: company2._id,
    title: 'Full Stack Web Specialist [DEMO]',
    description:
      'End-to-end fullstack engineering with React, Node.js, TypeScript, and PostgreSQL database.',
    location: 'Hyderabad',
    workplaceType: 'on_site',
    jobType: 'full_time',
    requiredSkills: [reactSkill, nodeSkill, pgSkill, tsSkill],
    preferredSkills: [dockerSkill, tailwindSkill],
    minCgpa: 7.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2026],
    salaryRange: { min: 1600000, max: 2400000, currency: 'INR' },
    status: 'open',
    postedBy: recruiter2._id,
    requisitionId: 'REQ-NEX-FS-404',
  });

  // Job 6: Quantitative Financial Algorithms Analyst
  const fintechJob = await Job.create({
    company: company3._id,
    title: 'Fintech Algorithms & Data Analyst [DEMO]',
    description:
      'Develop low-latency quantitative data analysis pipelines in Python and PostgreSQL.',
    location: 'Mumbai',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkills: [pythonSkill, pgSkill],
    preferredSkills: [dockerSkill, awsSkill],
    minCgpa: 8.0,
    eligibleDepartments: [
      'Computer Science & Engineering',
      'Information Technology',
      'Artificial Intelligence & Data Science',
    ],
    eligibleGraduationYears: [2026],
    salaryRange: { min: 1800000, max: 2600000, currency: 'INR' },
    status: 'open',
    postedBy: recruiter3._id,
    requisitionId: 'REQ-QNT-DA-505',
  });

  // Job 7: Archived Legacy Opening (Preserves submitted applications)
  const archivedLegacyJob = await Job.create({
    company: company1._id,
    title: 'Archived Systems Analyst [DEMO]',
    description: 'Legacy opening used to verify application preservation after job archiving.',
    location: 'Bengaluru',
    workplaceType: 'on_site',
    jobType: 'full_time',
    requiredSkills: [jsSkill, nodeSkill],
    minCgpa: 6.5,
    eligibleDepartments: ['Computer Science & Engineering'],
    eligibleGraduationYears: [2025, 2026],
    status: 'archived',
    postedBy: recruiter1._id,
    requisitionId: 'REQ-ACME-LEGACY-000',
  });

  // 6. Synthetic Students Setup (12+ Students with Distinct Evidence Profiles)
  console.log('[Seed] Creating 13 Synthetic Student Profiles & Evidence Records...');

  interface StudentConfig {
    email: string;
    rollNumber: string;
    name: string;
    department: string;
    graduationYear: number;
    cgpa: number;
    bio: string;
    skills: Array<{
      slug: string;
      proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
      status: 'verified' | 'submitted' | 'self_reported' | 'needs_additional_evidence' | 'rejected';
      isVerified: boolean;
      score?: number;
      maxScore?: number;
      evidenceType?: string;
      evidenceTitle?: string;
      evidenceUrl?: string;
      feedback?: string;
    }>;
    projects?: Array<{
      title: string;
      description: string;
      skills: string[];
      repoUrl: string;
      liveUrl: string;
    }>;
  }

  const studentConfigs: StudentConfig[] = [
    // Student 0: Standard Interactive Demo Student
    {
      email: 'student@evidra.dev',
      rollNumber: 'DEMO26CS000',
      name: 'Devin Sharma [DEMO]',
      department: 'Computer Science & Engineering',
      graduationYear: 2026,
      cgpa: 8.85,
      bio: 'Pre-final year CSE student. Passionate about scalable web applications and clean code.',
      skills: [
        {
          slug: 'react',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 94,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'E-Commerce React Component Library',
          evidenceUrl: 'https://github.com/evidra-demo/react-components',
          feedback: 'Verified clean component architecture and custom hooks.',
        },
        {
          slug: 'javascript',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 92,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'JavaScript ES6+ Proctored Coding Assessment',
          evidenceUrl: 'https://assessments.evidra.dev/test/js-885',
        },
        {
          slug: 'typescript',
          proficiency: 'intermediate',
          status: 'verified',
          isVerified: true,
          score: 88,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'TypeScript Distributed State Store',
          evidenceUrl: 'https://github.com/evidra-demo/ts-state-store',
        },
        {
          slug: 'nodejs',
          proficiency: 'intermediate',
          status: 'verified',
          isVerified: true,
          score: 85,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'Node.js Express API Lab',
          evidenceUrl: 'https://assessments.evidra.dev/test/node-101',
        },
      ],
      projects: [
        {
          title: 'Campus Placement Portal Frontend',
          description: 'Production React and TypeScript dashboard with real-time analytics.',
          skills: ['react', 'typescript', 'tailwind'],
          repoUrl: 'https://github.com/evidra-demo/campus-portal-ui',
          liveUrl: 'https://campus-portal.demo.evidra.dev',
        },
      ],
    },
    // Student 1: Alice Chen - High Fit, Fully Verified, Top Batch Ranker
    {
      email: 'alice.chen@evidra-demo.dev',
      rollNumber: 'DEMO26CS001',
      name: 'Alice Chen [DEMO]',
      department: 'Computer Science & Engineering',
      graduationYear: 2026,
      cgpa: 9.25,
      bio: 'Competitive programmer and full-stack engineer. 500+ solved algorithmic problems.',
      skills: [
        {
          slug: 'react',
          proficiency: 'expert',
          status: 'verified',
          isVerified: true,
          score: 98,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'Production React Micro-Frontend Shell',
          evidenceUrl: 'https://github.com/evidra-demo/alice-react-shell',
          feedback: 'Exceptional component lifecycle optimization and zero memory leaks.',
        },
        {
          slug: 'typescript',
          proficiency: 'expert',
          status: 'verified',
          isVerified: true,
          score: 96,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'Advanced TypeScript Type Gymnastics Exam',
          evidenceUrl: 'https://assessments.evidra.dev/test/alice-ts',
        },
        {
          slug: 'javascript',
          proficiency: 'expert',
          status: 'verified',
          isVerified: true,
          score: 99,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'Core JavaScript Engine Optimization Assessment',
          evidenceUrl: 'https://assessments.evidra.dev/test/alice-js',
        },
        {
          slug: 'tailwind',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 90,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'Tailwind Accessible Design System',
          evidenceUrl: 'https://github.com/evidra-demo/alice-tailwind-ds',
        },
      ],
      projects: [
        {
          title: 'Micro-Frontend Design System',
          description: 'High-performance component kit with 100% WCAG 2.1 AA compliance.',
          skills: ['react', 'typescript', 'tailwind'],
          repoUrl: 'https://github.com/evidra-demo/alice-design-system',
          liveUrl: 'https://design.alice-demo.evidra.dev',
        },
      ],
    },
    // Student 2: Bob Martinez - High Skill Fit but ELIGIBILITY FAILURE (CGPA 6.4 < 7.5 cut-off)
    {
      email: 'bob.martinez@evidra-demo.dev',
      rollNumber: 'DEMO26CS002',
      name: 'Bob Martinez [DEMO]',
      department: 'Computer Science & Engineering',
      graduationYear: 2026,
      cgpa: 6.4, // Deliberate Eligibility Failure (Cut-off is 7.5)
      bio: 'Practical hacker with great skills but struggled with academic theoretical exams.',
      skills: [
        {
          slug: 'react',
          proficiency: 'expert',
          status: 'verified',
          isVerified: true,
          score: 95,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'High-Throughput React Trading Board',
          evidenceUrl: 'https://github.com/evidra-demo/bob-react-trading',
        },
        {
          slug: 'javascript',
          proficiency: 'expert',
          status: 'verified',
          isVerified: true,
          score: 93,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'JS Architecture Proctored Assessment',
          evidenceUrl: 'https://assessments.evidra.dev/test/bob-js',
        },
        {
          slug: 'typescript',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 91,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'TypeScript Web Worker Pipeline',
          evidenceUrl: 'https://github.com/evidra-demo/bob-ts-workers',
        },
      ],
    },
    // Student 3: Charlie Patel - Mostly SELF-REPORTED Skills (No verified evidence)
    {
      email: 'charlie.patel@evidra-demo.dev',
      rollNumber: 'DEMO26IT003',
      name: 'Charlie Patel [DEMO]',
      department: 'Information Technology',
      graduationYear: 2026,
      cgpa: 8.2,
      bio: 'Self-taught developer with broad interests across web and cloud.',
      skills: [
        { slug: 'react', proficiency: 'expert', status: 'self_reported', isVerified: false },
        { slug: 'javascript', proficiency: 'advanced', status: 'self_reported', isVerified: false },
        { slug: 'typescript', proficiency: 'advanced', status: 'self_reported', isVerified: false },
        { slug: 'nodejs', proficiency: 'intermediate', status: 'self_reported', isVerified: false },
        { slug: 'aws', proficiency: 'beginner', status: 'self_reported', isVerified: false },
      ],
    },
    // Student 4: Diana Ross - Strong Project Evidence & Faculty Evaluation
    {
      email: 'diana.ross@evidra-demo.dev',
      rollNumber: 'DEMO26CS004',
      name: 'Diana Ross [DEMO]',
      department: 'Computer Science & Engineering',
      graduationYear: 2026,
      cgpa: 8.75,
      bio: 'Open source contributor and backend systems builder.',
      skills: [
        {
          slug: 'nodejs',
          proficiency: 'expert',
          status: 'verified',
          isVerified: true,
          score: 97,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'Distributed Task Queue in Node.js',
          evidenceUrl: 'https://github.com/evidra-demo/diana-task-queue',
          feedback: 'Verified multi-worker IPC message handling and Redis connection pooling.',
        },
        {
          slug: 'express',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 94,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'Express Microservices Benchmark',
          evidenceUrl: 'https://assessments.evidra.dev/test/diana-express',
        },
        {
          slug: 'mongodb',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 92,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'Multi-Tenant MongoDB Sharding Lab',
          evidenceUrl: 'https://github.com/evidra-demo/diana-mongo-sharding',
        },
      ],
      projects: [
        {
          title: 'High-Volume Logging Microservice',
          description: 'Streaming audit ingestion pipeline handling 5,000 events/second.',
          skills: ['nodejs', 'express', 'mongodb', 'docker'],
          repoUrl: 'https://github.com/evidra-demo/diana-logging-service',
          liveUrl: 'https://logs.demo.evidra.dev',
        },
      ],
    },
    // Student 5: Evan Wright - Exaggerated Resume Claim Requiring Faculty/Officer Review
    {
      email: 'evan.wright@evidra-demo.dev',
      rollNumber: 'DEMO26CS005',
      name: 'Evan Wright [DEMO]',
      department: 'Computer Science & Engineering',
      graduationYear: 2026,
      cgpa: 7.85,
      bio: 'Cloud architecture enthusiast.',
      skills: [
        {
          slug: 'kubernetes',
          proficiency: 'expert',
          status: 'needs_additional_evidence',
          isVerified: false,
          score: 40,
          maxScore: 100,
          evidenceType: 'other',
          evidenceTitle: 'Self-Claimed Global Cluster Architecture',
          evidenceUrl: 'https://medium.com/@evan-claims/my-k8s-story',
          feedback:
            'Officer note: Evidence is a personal blog post with no verifiable code repository or faculty sign-off. Please provide deployment manifests.',
        },
        {
          slug: 'docker',
          proficiency: 'intermediate',
          status: 'submitted',
          isVerified: false,
          evidenceType: 'github_repo',
          evidenceTitle: 'Docker Multi-stage Build Lab',
          evidenceUrl: 'https://github.com/evidra-demo/evan-docker',
        },
      ],
    },
    // Student 6: Fiona Gallagher - Embedded & IoT
    {
      email: 'fiona.gallagher@evidra-demo.dev',
      rollNumber: 'DEMO26ECE006',
      name: 'Fiona Gallagher [DEMO]',
      department: 'Electronics & Communication',
      graduationYear: 2026,
      cgpa: 8.4,
      bio: 'Hardware-software co-design and IoT developer.',
      skills: [
        {
          slug: 'python',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 89,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'Python Embedded Drivers Assessment',
          evidenceUrl: 'https://assessments.evidra.dev/test/fiona-py',
        },
      ],
    },
    // Student 7: George Clark - UI/UX Frontend Specialist
    {
      email: 'george.clark@evidra-demo.dev',
      rollNumber: 'DEMO26CS007',
      name: 'George Clark [DEMO]',
      department: 'Computer Science & Engineering',
      graduationYear: 2026,
      cgpa: 8.1,
      bio: 'Pixel-perfect UI engineer specializing in React and CSS animations.',
      skills: [
        {
          slug: 'react',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 91,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'Interactive Data Canvas in React',
          evidenceUrl: 'https://github.com/evidra-demo/george-react-canvas',
        },
        {
          slug: 'javascript',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 87,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'DOM Performance Assessment',
          evidenceUrl: 'https://assessments.evidra.dev/test/george-dom',
        },
      ],
    },
    // Student 8: Hannah Abbott - Database & Java Systems
    {
      email: 'hannah.abbott@evidra-demo.dev',
      rollNumber: 'DEMO26IT008',
      name: 'Hannah Abbott [DEMO]',
      department: 'Information Technology',
      graduationYear: 2026,
      cgpa: 7.9,
      bio: 'Enterprise Java and SQL query optimization.',
      skills: [
        {
          slug: 'java',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 86,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'Java Concurrency Assessment',
          evidenceUrl: 'https://assessments.evidra.dev/test/hannah-java',
        },
        {
          slug: 'postgresql',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 88,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'PostgreSQL Indexing Benchmark Suite',
          evidenceUrl: 'https://github.com/evidra-demo/hannah-postgres-benchmarks',
        },
      ],
    },
    // Student 9: Ian Somerhalder - Machine Learning & Python
    {
      email: 'ian.somerhalder@evidra-demo.dev',
      rollNumber: 'DEMO26CS009',
      name: 'Ian Somerhalder [DEMO]',
      department: 'Computer Science & Engineering',
      graduationYear: 2026,
      cgpa: 8.6,
      bio: 'Data modeling, neural nets, and high-performance Python services.',
      skills: [
        {
          slug: 'python',
          proficiency: 'expert',
          status: 'verified',
          isVerified: true,
          score: 95,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'Algorithmic Financial Predictor',
          evidenceUrl: 'https://github.com/evidra-demo/ian-ml-predictor',
        },
        {
          slug: 'postgresql',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 90,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'Time-Series Data Assessment',
          evidenceUrl: 'https://assessments.evidra.dev/test/ian-ts',
        },
      ],
    },
    // Student 10: Julia Roberts - Full Stack Web & GraphQL
    {
      email: 'julia.roberts@evidra-demo.dev',
      rollNumber: 'DEMO26IT010',
      name: 'Julia Roberts [DEMO]',
      department: 'Information Technology',
      graduationYear: 2026,
      cgpa: 8.95,
      bio: 'Fullstack web application specialist and API design enthusiast.',
      skills: [
        {
          slug: 'react',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 92,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'GraphQL Interactive Explorer UI',
          evidenceUrl: 'https://github.com/evidra-demo/julia-graphql-ui',
        },
        {
          slug: 'typescript',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 89,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'TypeScript Static Analysis Assessment',
          evidenceUrl: 'https://assessments.evidra.dev/test/julia-ts',
        },
      ],
    },
    // Student 11: Kevin Bacon - Cloud & Containers
    {
      email: 'kevin.bacon@evidra-demo.dev',
      rollNumber: 'DEMO26AIDS011',
      name: 'Kevin Bacon [DEMO]',
      department: 'Artificial Intelligence & Data Science',
      graduationYear: 2026,
      cgpa: 8.35,
      bio: 'DevOps automation and containerized ML pipelines.',
      skills: [
        {
          slug: 'docker',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 93,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'Multi-Arch Docker Images for ML',
          evidenceUrl: 'https://github.com/evidra-demo/kevin-docker-ml',
        },
        {
          slug: 'aws',
          proficiency: 'intermediate',
          status: 'verified',
          isVerified: true,
          score: 85,
          maxScore: 100,
          evidenceType: 'verified_certification',
          evidenceTitle: 'AWS Certified Cloud Practitioner',
          evidenceUrl: 'https://aws.amazon.com/verification/kevin-12345',
        },
      ],
    },
    // Student 12: Laura Croft - Security & Systems
    {
      email: 'laura.croft@evidra-demo.dev',
      rollNumber: 'DEMO26CS012',
      name: 'Laura Croft [DEMO]',
      department: 'Computer Science & Engineering',
      graduationYear: 2026,
      cgpa: 9.1,
      bio: 'Application security researcher and core systems engineer.',
      skills: [
        {
          slug: 'java',
          proficiency: 'expert',
          status: 'verified',
          isVerified: true,
          score: 96,
          maxScore: 100,
          evidenceType: 'coding_assessment',
          evidenceTitle: 'Cryptographic Protocols in Java',
          evidenceUrl: 'https://assessments.evidra.dev/test/laura-crypto',
        },
        {
          slug: 'postgresql',
          proficiency: 'advanced',
          status: 'verified',
          isVerified: true,
          score: 94,
          maxScore: 100,
          evidenceType: 'evaluated_project',
          evidenceTitle: 'Encrypted Row-Level Security in Postgres',
          evidenceUrl: 'https://github.com/evidra-demo/laura-rls-postgres',
        },
      ],
    },
  ];

  const createdStudentUsers: IUser[] = [];
  const createdProfiles: IStudentProfile[] = [];
  const createdResumes: IResume[] = [];

  for (const cfg of studentConfigs) {
    const user = await User.create({
      email: cfg.email,
      passwordHash,
      role: 'student',
      status: 'active',
      isEmailVerified: true,
    });
    createdStudentUsers.push(user);

    const profile = await StudentProfile.create({
      user: user._id,
      rollNumber: cfg.rollNumber,
      department: cfg.department,
      degree: 'B.Tech',
      graduationYear: cfg.graduationYear,
      cgpa: cfg.cgpa,
      bio: cfg.bio,
      education: [
        {
          institution: 'Apex Institute of Technology [DEMO]',
          degree: 'B.Tech',
          fieldOfStudy: cfg.department,
          startYear: 2022,
          endYear: cfg.graduationYear,
          scoreOrCgpa: `${cfg.cgpa} CGPA`,
        },
      ],
      links: {
        github: `https://github.com/evidra-demo/${cfg.rollNumber.toLowerCase()}`,
        linkedin: `https://linkedin.com/in/evidra-demo-${cfg.rollNumber.toLowerCase()}`,
      },
    });
    createdProfiles.push(profile);

    // Seed Skills & Evidence
    for (const sk of cfg.skills) {
      const skillDoc = skillsMap.get(sk.slug);
      if (!skillDoc) continue;

      let evidenceDoc = null;
      if (sk.evidenceType) {
        evidenceDoc = await Evidence.create({
          student: profile._id,
          skills: [skillDoc._id],
          type: sk.evidenceType,
          title: sk.evidenceTitle || `${sk.slug} Evidence`,
          description: `Demonstrated competency in ${skillDoc.name}`,
          url:
            sk.evidenceUrl || `https://evidence.demo.evidra.dev/${profile.rollNumber}/${sk.slug}`,
          status: sk.status,
          isVerified: sk.isVerified,
          score: sk.score,
          maxScore: sk.maxScore || 100,
          reviewedBy: sk.isVerified ? officerUser._id : undefined,
          reviewedAt: sk.isVerified ? new Date() : undefined,
          feedback: sk.feedback,
        });
      }

      await StudentSkill.create({
        student: profile._id,
        skill: skillDoc._id,
        proficiency: sk.proficiency,
        status: sk.status,
        isVerified: sk.isVerified,
        confidenceScore: sk.isVerified
          ? sk.score || 90
          : sk.status === 'needs_additional_evidence'
            ? 30
            : 20,
        evidence: evidenceDoc ? [evidenceDoc._id as Types.ObjectId] : [],
      });
    }

    // Seed Projects
    for (const proj of cfg.projects || []) {
      const projSkillIds = proj.skills
        .map((slug) => skillsMap.get(slug)?._id as Types.ObjectId)
        .filter(Boolean);

      await Project.create({
        student: profile._id,
        title: proj.title,
        description: proj.description,
        skills: projSkillIds,
        repoUrl: proj.repoUrl,
        liveUrl: proj.liveUrl,
        startDate: new Date('2024-08-01'),
        endDate: new Date('2024-12-15'),
        isOngoing: false,
      });
    }

    // Seed Tailored Resumes & Claims
    const resume = await Resume.create({
      student: profile._id,
      title: `${cfg.name.replace(' [DEMO]', '')} - Tailored Technical Resume`,
      version: 1,
      targetRole: 'Software Engineer',
      summary: `Motivated ${profile.department} student (CGPA: ${profile.cgpa}/10). Specializing in modern software engineering with verified project deliverables.`,
      status: 'generated',
      isPrimary: true,
    });
    createdResumes.push(resume);

    // Seed Resume Claim
    const primarySkill = cfg.skills[0];
    if (primarySkill) {
      const primarySkillDoc = skillsMap.get(primarySkill.slug);
      if (primarySkillDoc) {
        await ResumeClaim.create({
          resume: resume._id,
          student: profile._id,
          claimType: 'skill',
          text: `Demonstrated practical engineering proficiency in ${primarySkillDoc.name}.`,
          skill: primarySkillDoc._id,
          isVerified: primarySkill.isVerified,
          confidenceScore: primarySkill.isVerified ? 95 : 25,
        });
      }
    }
  }

  // Seed sample exaggerated resume claim for Student 5 (Evan Wright)
  const evanResume = createdResumes.find(
    (r) => r.student.toString() === createdProfiles[5]._id.toString()
  );
  if (evanResume) {
    const k8sSkillDoc = skillsMap.get('kubernetes')!;
    await ResumeClaim.create({
      resume: evanResume._id,
      student: createdProfiles[5]._id,
      claimType: 'experience',
      text: 'Architected enterprise multi-region Kubernetes distributed consensus engine for 50M concurrent users.',
      skill: k8sSkillDoc._id,
      isVerified: false,
      confidenceScore: 15, // Extremely low confidence -> Flagged for review!
    });
  }

  // 7. Seed Applications across All Statuses
  console.log('[Seed] Seeding Applications across All Pipeline Stages...');

  // Application 1: Alice Chen -> Frontend Developer Intern -> OFFER
  const app1 = await Application.create({
    student: createdProfiles[1]._id, // Alice
    job: frontendJob._id,
    resume: createdResumes[1]._id,
    resumeVersion: 1,
    resumeSnapshot: {
      resumeId: createdResumes[1]._id as Types.ObjectId,
      version: 1,
      title: createdResumes[1].title,
      submittedAt: new Date('2026-02-01'),
    },
    currentStatus: 'OFFER',
    appliedAt: new Date('2026-02-01'),
    coverLetter: 'I am excited about building world-class component systems at Acme Innovations.',
    interviewDetails: {
      round: 2,
      interviewType: 'technical',
      scheduledAt: new Date('2026-02-15'),
      interviewerName: 'Sarah Connor',
      interviewerEmail: 'sarah@acme-innovations.demo.evidra.dev',
      feedback: 'Outstanding technical performance on system design and accessibility.',
    },
    offerDetails: {
      offeredCtc: 65000,
      currency: 'INR',
      baseSalary: 65000,
      designation: 'Frontend Engineering Intern',
      joiningDate: new Date('2026-06-01'),
      deadline: new Date('2026-05-15'),
      notes: 'Monthly stipend of 65,000 INR with fast-track PPO evaluation.',
    },
  });

  await ApplicationStatusHistory.create([
    {
      application: app1._id,
      toStatus: 'APPLIED',
      changedBy: createdStudentUsers[1]._id,
      changedByRole: 'student',
      changedAt: new Date('2026-02-01'),
    },
    {
      application: app1._id,
      fromStatus: 'APPLIED',
      toStatus: 'UNDER_REVIEW',
      changedBy: recruiter1._id,
      changedByRole: 'recruiter',
      changedAt: new Date('2026-02-05'),
    },
    {
      application: app1._id,
      fromStatus: 'UNDER_REVIEW',
      toStatus: 'INTERVIEW',
      changedBy: recruiter1._id,
      changedByRole: 'recruiter',
      interviewDetails: app1.interviewDetails,
      changedAt: new Date('2026-02-12'),
    },
    {
      application: app1._id,
      fromStatus: 'INTERVIEW',
      toStatus: 'OFFER',
      changedBy: officerUser._id,
      changedByRole: 'placement_officer',
      offerDetails: app1.offerDetails,
      changedAt: new Date('2026-02-20'),
    },
  ]);

  // Application 2: George Clark -> Frontend Developer Intern -> INTERVIEW
  const app2 = await Application.create({
    student: createdProfiles[7]._id, // George
    job: frontendJob._id,
    resume: createdResumes[7]._id,
    resumeVersion: 1,
    currentStatus: 'INTERVIEW',
    appliedAt: new Date('2026-02-03'),
    interviewDetails: {
      round: 1,
      interviewType: 'technical',
      scheduledAt: new Date('2026-03-01'),
      meetingLink: 'https://meet.google.com/xyz-demo-george',
      interviewerName: 'Marcus Wright',
      notes: 'Initial React architecture assessment round.',
    },
  });

  await ApplicationStatusHistory.create([
    {
      application: app2._id,
      toStatus: 'APPLIED',
      changedBy: createdStudentUsers[7]._id,
      changedByRole: 'student',
      changedAt: new Date('2026-02-03'),
    },
    {
      application: app2._id,
      fromStatus: 'APPLIED',
      toStatus: 'UNDER_REVIEW',
      changedBy: officerUser._id,
      changedByRole: 'placement_officer',
      changedAt: new Date('2026-02-10'),
    },
    {
      application: app2._id,
      fromStatus: 'UNDER_REVIEW',
      toStatus: 'INTERVIEW',
      changedBy: recruiter1._id,
      changedByRole: 'recruiter',
      interviewDetails: app2.interviewDetails,
      changedAt: new Date('2026-02-18'),
    },
  ]);

  // Application 3: Julia Roberts -> Frontend Developer Intern -> UNDER_REVIEW
  const app3 = await Application.create({
    student: createdProfiles[10]._id, // Julia
    job: frontendJob._id,
    resume: createdResumes[10]._id,
    resumeVersion: 1,
    currentStatus: 'UNDER_REVIEW',
    appliedAt: new Date('2026-02-08'),
  });

  await ApplicationStatusHistory.create([
    {
      application: app3._id,
      toStatus: 'APPLIED',
      changedBy: createdStudentUsers[10]._id,
      changedByRole: 'student',
      changedAt: new Date('2026-02-08'),
    },
    {
      application: app3._id,
      fromStatus: 'APPLIED',
      toStatus: 'UNDER_REVIEW',
      changedBy: officerUser._id,
      changedByRole: 'placement_officer',
      changedAt: new Date('2026-02-14'),
    },
  ]);

  // Application 4: Diana Ross -> Backend Platform Engineer -> OFFER
  const app4 = await Application.create({
    student: createdProfiles[4]._id, // Diana
    job: backendJob._id,
    resume: createdResumes[4]._id,
    resumeVersion: 1,
    currentStatus: 'OFFER',
    appliedAt: new Date('2026-01-20'),
    offerDetails: {
      offeredCtc: 1850000,
      currency: 'INR',
      baseSalary: 1550000,
      bonus: 300000,
      designation: 'Backend Software Engineer - I',
      joiningDate: new Date('2026-07-01'),
      notes: 'Full-time graduate placement offer.',
    },
  });

  await ApplicationStatusHistory.create([
    {
      application: app4._id,
      toStatus: 'APPLIED',
      changedBy: createdStudentUsers[4]._id,
      changedByRole: 'student',
      changedAt: new Date('2026-01-20'),
    },
    {
      application: app4._id,
      fromStatus: 'APPLIED',
      toStatus: 'UNDER_REVIEW',
      changedBy: recruiter1._id,
      changedByRole: 'recruiter',
      changedAt: new Date('2026-01-25'),
    },
    {
      application: app4._id,
      fromStatus: 'UNDER_REVIEW',
      toStatus: 'INTERVIEW',
      changedBy: recruiter1._id,
      changedByRole: 'recruiter',
      changedAt: new Date('2026-02-02'),
    },
    {
      application: app4._id,
      fromStatus: 'INTERVIEW',
      toStatus: 'OFFER',
      changedBy: recruiter1._id,
      changedByRole: 'recruiter',
      offerDetails: app4.offerDetails,
      changedAt: new Date('2026-02-15'),
    },
  ]);

  // Application 5: Kevin Bacon -> Cloud Systems & DevOps Associate -> APPLIED
  await Application.create({
    student: createdProfiles[11]._id, // Kevin
    job: devopsJob._id,
    resume: createdResumes[11]._id,
    resumeVersion: 1,
    currentStatus: 'APPLIED',
    appliedAt: new Date('2026-02-12'),
  });

  // Application 6: Laura Croft -> Archived Systems Analyst -> PRESERVED APPLICATION (WITHDRAWN)
  await Application.create({
    student: createdProfiles[12]._id, // Laura
    job: archivedLegacyJob._id,
    resume: createdResumes[12]._id,
    resumeVersion: 1,
    currentStatus: 'WITHDRAWN',
    appliedAt: new Date('2025-11-10'),
    notes: 'Candidate accepted higher research scholarship.',
  });

  // Application 7: Charlie Patel -> Quantitative Financial Algorithms Analyst -> REJECTED
  await Application.create({
    student: createdProfiles[3]._id, // Charlie
    job: fintechJob._id,
    resume: createdResumes[3]._id,
    resumeVersion: 1,
    currentStatus: 'REJECTED',
    appliedAt: new Date('2026-01-15'),
    notes: 'Did not meet technical assessment threshold (unverified skill claims).',
  });

  console.log('[Seed] Demonstration dataset created successfully!');
  console.log('----------------------------------------------------');
  console.log('DEMO ACCOUNTS FOR HACKATHON PRESENTATION:');
  console.log(`  Placement Officer : officer@evidra.dev           / ${defaultPassword}`);
  console.log(`  Admin User        : admin@evidra.dev             / ${defaultPassword}`);
  console.log(`  Recruiter 1 (Acme): recruiter.acme@evidra-demo.dev / ${defaultPassword}`);
  console.log(`  Demo Student      : student@evidra.dev           / ${defaultPassword}`);
  console.log(`  Alice (Top Rank)  : alice.chen@evidra-demo.dev   / ${defaultPassword}`);
  console.log(`  Bob (Ineligible)  : bob.martinez@evidra-demo.dev / ${defaultPassword}`);
  console.log(`  Charlie (SelfRep) : charlie.patel@evidra-demo.dev / ${defaultPassword}`);
  console.log(`  Diana (Projects)  : diana.ross@evidra-demo.dev   / ${defaultPassword}`);
  console.log(`  Evan (ReviewClaim): evan.wright@evidra-demo.dev  / ${defaultPassword}`);
  console.log('----------------------------------------------------');

  return {
    officer: officerUser.email,
    admin: adminUser.email,
    recruiters: [defaultRecruiter.email, recruiter1.email, recruiter2.email, recruiter3.email],
    students: createdStudentUsers.map((u) => u.email),
    companiesCount: 3,
    jobsCount: 7,
    skillsCount: skillsMap.size,
    applicationsCount: 7,
  };
};
