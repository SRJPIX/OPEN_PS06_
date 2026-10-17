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
import { Assessment } from '../models/Assessment';
import { Project } from '../models/Project';
import { AlumniProfile } from '../models/AlumniProfile';
import { InterviewReport } from '../models/InterviewReport';
import { PlacementSetting } from '../models/PlacementSetting';
import { hashPassword } from './password';
import { seedCanonicalSkills } from './skillNormalizer';
import { seedDemoJobs } from './demoJobsSeed';
import { config } from '../config/env';

/**
 * Safe, idempotent development seed script.
 * Never deletes or overwrites existing user data.
 * Populates missing demo accounts, skills, evidence, assessments, projects,
 * interview reports, alumni, and job applications so all workflows are fully functional.
 */
export const runSafeSeed = async (): Promise<{
  jobsCount: number;
  applicationsCount: number;
  evidenceCount: number;
}> => {
  if (config.NODE_ENV === 'production') {
    throw new Error('[SafeSeed] Cannot run in production environment.');
  }

  console.log('[SafeSeed] Ensuring canonical skills are seeded...');
  await seedCanonicalSkills();

  const defaultPassword = config.DEMO_USER_PASSWORD || 'EvidraDemo123!';
  const passwordHash = await hashPassword(defaultPassword);

  // 1. Ensure Standard Demo Accounts Exist
  console.log('[SafeSeed] Ensuring demo accounts exist...');

  // Officer
  let officerUser = await User.findOne({ email: 'officer@evidra.dev' });
  if (!officerUser) {
    officerUser = await User.create({
      email: 'officer@evidra.dev',
      passwordHash,
      role: 'placement_officer',
      status: 'active',
      isEmailVerified: true,
    });
  }

  // Admin
  let adminUser = await User.findOne({ email: 'admin@evidra.dev' });
  if (!adminUser) {
    adminUser = await User.create({
      email: 'admin@evidra.dev',
      passwordHash,
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
    });
  }

  // Recruiter
  let recruiterUser = await User.findOne({ email: 'recruiter@evidra.dev' });
  if (!recruiterUser) {
    recruiterUser = await User.create({
      email: 'recruiter@evidra.dev',
      passwordHash,
      role: 'recruiter',
      status: 'active',
      isEmailVerified: true,
    });
  }

  // Student
  let studentUser = await User.findOne({ email: 'student@evidra.dev' });
  if (!studentUser) {
    studentUser = await User.create({
      email: 'student@evidra.dev',
      passwordHash,
      role: 'student',
      status: 'active',
      isEmailVerified: true,
    });
  }

  // Student Profile
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
      bio: 'Pre-final year CSE student passionate about Fullstack Architecture, Cloud Infrastructure, and Verifiable Software Engineering.',
      links: {
        github: 'https://github.com/evidra-student',
        linkedin: 'https://linkedin.com/in/evidra-student',
        portfolio: 'https://student.demo.evidra.dev',
      },
      education: [
        {
          institution: 'Apex Institute of Technology',
          degree: 'B.Tech in Computer Science & Engineering',
          startYear: 2022,
          endYear: 2026,
          scoreOrCgpa: '8.85 / 10.0',
        },
      ],
    });
  }

  // 2. Ensure Recruiter's Primary Company Exists and is Authorized
  let company = await Company.findOne({
    $or: [
      { createdBy: recruiterUser._id },
      { authorizedRecruiters: recruiterUser._id },
      { name: 'Evidra Partner Labs [DEMO]' },
    ],
  });

  if (!company) {
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
    company.authorizedRecruiters = company.authorizedRecruiters || [];
    if (!company.authorizedRecruiters.some((id) => id.toString() === recruiterUser!._id.toString())) {
      company.authorizedRecruiters.push(recruiterUser._id as Types.ObjectId);
      await company.save();
    }
  }

  // 3. Resolve canonical skills for demo portfolio
  const reactSkill = await Skill.findOne({ slug: 'react' });
  const nodeSkill = await Skill.findOne({ slug: 'nodejs' }) || await Skill.findOne({ slug: 'node-js' });
  const jsSkill = await Skill.findOne({ slug: 'javascript' });
  const tsSkill = await Skill.findOne({ slug: 'typescript' });
  const mongoSkill = await Skill.findOne({ slug: 'mongodb' });
  const pythonSkill = await Skill.findOne({ slug: 'python' });
  const htmlSkill = await Skill.findOne({ slug: 'html5' }) || await Skill.findOne({ slug: 'html' });

  // 4. Ensure Company Has Active Published Jobs
  let companyJobs = await Job.find({ company: company._id });
  if (companyJobs.length === 0) {
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

  // 5. Ensure Student Assessments & Projects Exist
  console.log('[SafeSeed] Ensuring demo assessments & projects exist...');
  let assessment1 = await Assessment.findOne({ student: studentProfile._id, title: { $regex: /Fullstack React/ } });
  if (!assessment1 && reactSkill) {
    assessment1 = await Assessment.create({
      student: studentProfile._id,
      skill: reactSkill._id,
      title: 'Fullstack React & Node.js Proctored Assessment [DEMO]',
      provider: 'internal',
      score: 92,
      maxScore: 100,
      passed: true,
      takenAt: new Date(Date.now() - 86400000 * 15),
      certificateUrl: 'https://verify.evidra.dev/assessments/cs2024001-fs-92',
    });
  }

  let assessment2 = await Assessment.findOne({ student: studentProfile._id, title: { $regex: /Algorithms/ } });
  if (!assessment2 && jsSkill) {
    assessment2 = await Assessment.create({
      student: studentProfile._id,
      skill: jsSkill._id,
      title: 'JavaScript Algorithms & Complex Data Structures [DEMO]',
      provider: 'hackerrank',
      score: 88,
      maxScore: 100,
      passed: true,
      takenAt: new Date(Date.now() - 86400000 * 30),
      certificateUrl: 'https://hackerrank.com/certificates/demo-cs2024001-js',
    });
  }

  let project1 = await Project.findOne({ student: studentProfile._id, title: { $regex: /Distributed E-Commerce/ } });
  if (!project1 && reactSkill && nodeSkill && mongoSkill) {
    project1 = await Project.create({
      student: studentProfile._id,
      title: 'Distributed E-Commerce Microservices Engine [DEMO]',
      description: 'Built high-throughput distributed storefront backend with Node.js microservices, MongoDB horizontal scaling, and accessible React 19 UI.',
      skills: [reactSkill._id, nodeSkill._id, mongoSkill._id],
      repoUrl: 'https://github.com/evidra-student/distributed-ecommerce-demo',
      liveUrl: 'https://ecommerce.demo.evidra.dev',
      startDate: new Date('2024-01-10'),
      endDate: new Date('2024-05-20'),
      isOngoing: false,
    });
  }

  let project2 = await Project.findOne({ student: studentProfile._id, title: { $regex: /Collaborative/ } });
  if (!project2 && reactSkill && jsSkill && tsSkill) {
    project2 = await Project.create({
      student: studentProfile._id,
      title: 'Real-Time Collaborative Code Canvas [DEMO]',
      description: 'WebRTC and WebSocket-powered concurrent live coding workspace supporting Operational Transformation and deterministic linting.',
      skills: [reactSkill._id, jsSkill._id, tsSkill._id],
      repoUrl: 'https://github.com/evidra-student/collab-canvas-demo',
      liveUrl: 'https://collab.demo.evidra.dev',
      startDate: new Date('2024-06-01'),
      isOngoing: true,
    });
  }

  // 6. Ensure Student Evidence Items Exist
  let evidenceCreated = 0;
  if (reactSkill) {
    let evReact = await Evidence.findOne({ student: studentProfile._id, skills: reactSkill._id });
    if (!evReact) {
      evReact = await Evidence.create({
        student: studentProfile._id,
        skills: [reactSkill._id, jsSkill?._id].filter(Boolean),
        type: 'coding_assessment',
        title: 'React & Frontend Architecture Proctored Evaluation [DEMO]',
        description: 'Scored 92/100 on verified multi-tier component lifecycle, state normalization, and virtualized DOM performance tests.',
        url: 'https://verify.evidra.dev/assessments/cs2024001-fs-92',
        status: 'verified',
        isVerified: true,
        score: 92,
        maxScore: 100,
        evaluatorNotes: 'Demonstrated mastery of React state management, custom hook optimization, and clean functional composition.',
        evaluatedBy: officerUser?._id,
        evaluatedAt: new Date(Date.now() - 86400000 * 10),
        reviewedBy: officerUser?._id,
        reviewedAt: new Date(Date.now() - 86400000 * 10),
        reviewNotes: 'Verified via proctored institutional exam logs.',
        auditHistory: [],
      });
      evidenceCreated++;
    }

    // Link evidence to student skill
    let ssReact = await StudentSkill.findOne({ student: studentProfile._id, skill: reactSkill._id });
    if (!ssReact) {
      await StudentSkill.create({
        student: studentProfile._id,
        skill: reactSkill._id,
        proficiency: 'advanced',
        status: 'verified',
        isVerified: true,
        confidenceScore: 92,
        evidence: [evReact._id as Types.ObjectId],
      });
    }
  }

  if (nodeSkill) {
    let evNode = await Evidence.findOne({ student: studentProfile._id, skills: nodeSkill._id });
    if (!evNode) {
      evNode = await Evidence.create({
        student: studentProfile._id,
        skills: [nodeSkill._id, mongoSkill?._id].filter(Boolean),
        type: 'evaluated_project',
        title: 'Enterprise Distributed Microservices Production Repo [DEMO]',
        description: 'End-to-end backend service with Node.js, Express, connection pooling, and idempotent MongoDB ledger transactions.',
        url: 'https://github.com/evidra-student/distributed-ecommerce-demo',
        status: 'verified',
        isVerified: true,
        score: 90,
        maxScore: 100,
        evaluatorNotes: 'Full unit and integration test suite passing. Clean modular design compliant with Twelve-Factor methodology.',
        evaluatedBy: officerUser?._id,
        evaluatedAt: new Date(Date.now() - 86400000 * 8),
        reviewedBy: officerUser?._id,
        reviewedAt: new Date(Date.now() - 86400000 * 8),
        reviewNotes: 'Code repository inspected and verified.',
        auditHistory: [],
      });
      evidenceCreated++;
    }

    let ssNode = await StudentSkill.findOne({ student: studentProfile._id, skill: nodeSkill._id });
    if (!ssNode) {
      await StudentSkill.create({
        student: studentProfile._id,
        skill: nodeSkill._id,
        proficiency: 'advanced',
        status: 'verified',
        isVerified: true,
        confidenceScore: 90,
        evidence: [evNode._id as Types.ObjectId],
      });
    }
  }

  if (jsSkill) {
    let ssJs = await StudentSkill.findOne({ student: studentProfile._id, skill: jsSkill._id });
    if (!ssJs) {
      await StudentSkill.create({
        student: studentProfile._id,
        skill: jsSkill._id,
        proficiency: 'expert',
        status: 'verified',
        isVerified: true,
        confidenceScore: 88,
        evidence: [],
      });
    }
  }

  if (tsSkill) {
    let evTs = await Evidence.findOne({ student: studentProfile._id, skills: tsSkill._id });
    if (!evTs) {
      evTs = await Evidence.create({
        student: studentProfile._id,
        skills: [tsSkill._id],
        type: 'github_repo',
        title: 'TypeScript Type-Safe Micro-Framework [DEMO]',
        description: 'Zero-runtime type validation utilities and generic state machines.',
        url: 'https://github.com/evidra-student/collab-canvas-demo',
        status: 'submitted', // SUBMITTED: ready for recruiter/officer review in demo!
        isVerified: false,
        score: 85,
        maxScore: 100,
        auditHistory: [],
      });
      evidenceCreated++;
    }

    let ssTs = await StudentSkill.findOne({ student: studentProfile._id, skill: tsSkill._id });
    if (!ssTs) {
      await StudentSkill.create({
        student: studentProfile._id,
        skill: tsSkill._id,
        proficiency: 'intermediate',
        status: 'submitted',
        isVerified: false,
        confidenceScore: 60,
        evidence: [evTs._id as Types.ObjectId],
      });
    }
  }

  if (mongoSkill) {
    let ssMongo = await StudentSkill.findOne({ student: studentProfile._id, skill: mongoSkill._id });
    if (!ssMongo) {
      await StudentSkill.create({
        student: studentProfile._id,
        skill: mongoSkill._id,
        proficiency: 'intermediate',
        status: 'submitted',
        isVerified: false,
        confidenceScore: 50,
        evidence: [],
      });
    }
  }

  if (pythonSkill) {
    let ssPy = await StudentSkill.findOne({ student: studentProfile._id, skill: pythonSkill._id });
    if (!ssPy) {
      await StudentSkill.create({
        student: studentProfile._id,
        skill: pythonSkill._id,
        proficiency: 'beginner',
        status: 'self_reported',
        isVerified: false,
        confidenceScore: 20,
        evidence: [],
      });
    }
  }

  // 7. Ensure Student Resume and Applications Exist
  let applicationsCreated = 0;
  const primaryJob = companyJobs[0];
  let existingApp = await Application.findOne({
    student: studentProfile._id,
    job: primaryJob._id,
  });

  if (!existingApp) {
    let resume = await Resume.findOne({ student: studentProfile._id });
    if (!resume) {
      resume = await Resume.create({
        student: studentProfile._id,
        title: 'Campus Verified ATS Resume [DEMO]',
        version: 1,
        validationStatus: 'PARTIALLY_VERIFIED',
        bullets: [
          {
            bulletId: 'b-1',
            section: 'skills',
            text: 'Engineered high-throughput REST microservices in Node.js and React with verifiable 92% assessment benchmark score',
            validationStatus: 'SUPPORTED',
            confidenceScore: 92,
            evidenceIds: [],
            skillIds: [reactSkill?._id, nodeSkill?._id].filter(Boolean) as Types.ObjectId[],
          },
          {
            bulletId: 'b-2',
            section: 'experience',
            text: 'Designed horizontal MongoDB schema and Redis cache layers handling concurrent transactions',
            validationStatus: 'SUPPORTED',
            confidenceScore: 90,
            evidenceIds: [],
            skillIds: [mongoSkill?._id, nodeSkill?._id].filter(Boolean) as Types.ObjectId[],
          },
        ],
        isPrimary: true,
        status: 'generated',
      });
    }

    await Application.create({
      student: studentProfile._id,
      job: primaryJob._id,
      resume: resume._id,
      resumeVersion: resume.version || 1,
      currentStatus: 'APPLIED',
      appliedAt: new Date(Date.now() - 86400000 * 2),
    });
    applicationsCreated++;
  }

  // 8. Ensure Realistic Interview Reports (Question Bank & Experiences)
  console.log('[SafeSeed] Ensuring realistic interview reports and question bank exist...');
  const existingReportsCount = await InterviewReport.countDocuments();
  if (existingReportsCount === 0) {
    const demoReports = [
      {
        student: studentUser._id,
        companyName: 'NexusTech Cloud Labs [DEMO]',
        role: 'Software Development Engineer I',
        driveYear: 2026,
        difficulty: 'medium',
        outcome: 'offered',
        overallExperience: 'Structured three-round process focusing heavily on distributed data structures, concurrency handling in Node.js, and API resilience.',
        preparationTips: 'Brush up on LRU cache implementations, database indexing strategies, and event-loop microtask queues.',
        isAnonymous: false,
        moderationStatus: 'approved',
        upvotesCount: 14,
        rounds: [
          {
            roundNumber: 1,
            roundName: 'Online Coding Evaluation',
            durationMinutes: 60,
            questions: [
              {
                question: 'Implement a thread-safe rate limiter using the Token Bucket algorithm.',
                topic: 'Algorithms & Concurrency',
                difficulty: 'medium',
                tips: 'Keep track of token generation interval and burst limit. Avoid busy-waiting loops.',
              },
              {
                question: 'Find the lowest common ancestor in a binary tree with negative values.',
                topic: 'Trees & Graphs',
                difficulty: 'easy',
                tips: 'Post-order traversal allows bottom-up inspection of parent nodes.',
              },
            ],
          },
          {
            roundNumber: 2,
            roundName: 'Technical System Design Round',
            durationMinutes: 45,
            questions: [
              {
                question: 'Design an idempotent payment reconciliation service that survives worker crashes midway.',
                topic: 'System Design',
                difficulty: 'hard',
                tips: 'Use distributed two-phase commits or saga state machines with deterministic transaction IDs.',
              },
            ],
          },
        ],
      },
      {
        student: studentUser._id,
        companyName: 'FinEdge Core Banking Solutions [DEMO]',
        role: 'Backend Systems Engineer',
        driveYear: 2025,
        difficulty: 'challenging',
        outcome: 'offered',
        overallExperience: 'Very rigorous interview on ACID transactional boundaries, SQL optimization, and message broker architectures.',
        preparationTips: 'Deep dive into database isolation levels (Read Committed vs Serializable) and phantom reads.',
        isAnonymous: true,
        moderationStatus: 'approved',
        upvotesCount: 22,
        rounds: [
          {
            roundNumber: 1,
            roundName: 'Core Algorithms & Complexity',
            durationMinutes: 60,
            questions: [
              {
                question: 'Design an in-memory ledger supporting sub-millisecond range balance queries.',
                topic: 'Data Structures',
                difficulty: 'hard',
                tips: 'Segment trees or Fenwick trees provide logarithmic update and range sum latencies.',
              },
            ],
          },
          {
            roundNumber: 2,
            roundName: 'Engineering Culture & Bar Raiser',
            durationMinutes: 45,
            questions: [
              {
                question: 'Describe a production bug you diagnosed using distributed tracing and how you prevented regressions.',
                topic: 'Behavioral & Leadership',
                difficulty: 'medium',
                tips: 'Structure your response using the STAR framework with concrete latency metrics.',
              },
            ],
          },
        ],
      },
      {
        student: studentUser._id,
        companyName: 'Algorhythm AI Research [DEMO]',
        role: 'Machine Learning Engineer Intern',
        driveYear: 2026,
        difficulty: 'medium',
        outcome: 'pending',
        overallExperience: 'Focus on tensor manipulations, vector indexing algorithms, and model inference acceleration.',
        preparationTips: 'Revise NumPy broadcasting, PyTorch autograd graph mechanics, and cosine similarity indexing.',
        isAnonymous: false,
        moderationStatus: 'approved',
        upvotesCount: 9,
        rounds: [
          {
            roundNumber: 1,
            roundName: 'Applied Math & Python Coding',
            durationMinutes: 45,
            questions: [
              {
                question: 'Write a vectorized implementation of self-attention in Python using NumPy only without external libraries.',
                topic: 'Deep Learning',
                difficulty: 'medium',
                tips: 'Remember softmax numerical stability: subtract the row-wise maximum before exponentiating.',
              },
            ],
          },
        ],
      },
    ];

    for (const r of demoReports) {
      await InterviewReport.create(r);
    }
  }

  // 9. Ensure Verified Alumni Profiles with Referrals Exist
  console.log('[SafeSeed] Ensuring verified alumni directory exists...');
  const existingAlumniCount = await AlumniProfile.countDocuments();
  if (existingAlumniCount <= 1) {
    const demoAlumni = [
      {
        fullName: 'Priya Sharma',
        email: 'priya.sharma@alumni.univ.edu',
        graduationYear: 2023,
        degree: 'B.Tech in Computer Science',
        department: 'Computer Science & Engineering',
        companyName: 'NexusTech Cloud Labs [DEMO]',
        designation: 'Senior Cloud Platform Engineer',
        experienceYears: 3,
        location: 'Bengaluru, India',
        linkedinUrl: 'https://linkedin.com/in/demo-priya-sharma',
        referralAvailable: true,
        maxReferralsPerMonth: 5,
        activeReferralsCount: 1,
        preferredSkills: ['Kubernetes', 'Go', 'Distributed Systems', 'Docker'],
        referralGuidelines: 'Happy to refer CSE/IT students with solid understanding of concurrent systems and Linux internals. Attach verified projects.',
        isVerified: true,
      },
      {
        fullName: 'Rohan Patel',
        email: 'rohan.patel@alumni.univ.edu',
        graduationYear: 2022,
        degree: 'B.Tech in Information Technology',
        department: 'Information Technology',
        companyName: 'FinEdge Core Banking Solutions [DEMO]',
        designation: 'Distributed Ledger Architect',
        experienceYears: 4,
        location: 'Pune, India',
        linkedinUrl: 'https://linkedin.com/in/demo-rohan-patel',
        referralAvailable: true,
        maxReferralsPerMonth: 3,
        activeReferralsCount: 0,
        preferredSkills: ['Java', 'Spring Boot', 'SQL', 'PostgreSQL'],
        referralGuidelines: 'Looking for candidates strong in relational data models, ACID semantics, and clean API design.',
        isVerified: true,
      },
      {
        fullName: 'Ananya Deshmukh',
        email: 'ananya.deshmukh@alumni.univ.edu',
        graduationYear: 2024,
        degree: 'B.Tech in CSE',
        department: 'Computer Science & Engineering',
        companyName: 'Algorhythm AI Research [DEMO]',
        designation: 'Applied ML Research Associate',
        experienceYears: 2,
        location: 'Hyderabad, India',
        linkedinUrl: 'https://linkedin.com/in/demo-ananya-deshmukh',
        referralAvailable: true,
        maxReferralsPerMonth: 4,
        activeReferralsCount: 1,
        preferredSkills: ['Python', 'PyTorch', 'Machine Learning', 'Data Analysis'],
        referralGuidelines: 'Please share your evaluated project repositories demonstrating model fine-tuning and inference optimizations.',
        isVerified: true,
      },
      {
        fullName: 'Vikramaditya Sengupta',
        email: 'vikram.sengupta@alumni.univ.edu',
        graduationYear: 2021,
        degree: 'B.Tech in Electronics & Telecommunication',
        department: 'Electronics & Telecommunication',
        companyName: 'CyberPulse Security Systems [DEMO]',
        designation: 'Staff Security Engineer',
        experienceYears: 5,
        location: 'Mumbai, India',
        linkedinUrl: 'https://linkedin.com/in/demo-vikram-sengupta',
        referralAvailable: true,
        maxReferralsPerMonth: 2,
        activeReferralsCount: 0,
        preferredSkills: ['Linux', 'Network Protocols', 'CI/CD', 'Docker'],
        referralGuidelines: 'Open to referring enthusiastic candidates with interest in zero-trust architecture and secure SDLC.',
        isVerified: true,
      },
    ];

    for (const a of demoAlumni) {
      const exists = await AlumniProfile.findOne({ email: a.email });
      if (!exists) {
        await AlumniProfile.create(a);
      }
    }
  }

  // 10. Ensure Institutional Placement Settings Exist
  let settings = await PlacementSetting.findOne();
  if (!settings) {
    settings = await PlacementSetting.create({
      institutionName: 'Apex Institute of Technology - Placement Cell',
      defaultGraduationYear: 2026,
      minCgpaThreshold: 6.0,
      scoringWeights: {
        requiredSkillWeight: 3.0,
        preferredSkillWeight: 1.0,
        courseworkWeight: 0.2,
        verificationPenalty: 0.2,
      },
      autoArchivePastDeadlines: true,
      strictDuplicateRejection: true,
      emailAlertsEnabled: false,
      evidenceReviewSlaDays: 3,
      updatedBy: officerUser?._id,
    });
  }

  // 11. Seed 30 realistic demo jobs across 10 companies and 12 categories
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
