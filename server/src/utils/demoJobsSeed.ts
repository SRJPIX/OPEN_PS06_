import { Types } from 'mongoose';
import { Job, WorkplaceType, JobType } from '../models/Job';
import { Company, ICompany } from '../models/Company';
import { Skill, ISkill } from '../models/Skill';
import { User } from '../models/User';
import { seedCanonicalSkills, resolveSkillDocument } from './skillNormalizer';
import { checkExactDuplicate } from './jobDeduplicator';
import { config } from '../config/env';
import { isDatabaseConnected } from '../config/db';

export interface SeedJobsResult {
  createdCount: number;
  skippedCount: number;
  totalActiveDemoJobs: number;
}

interface DemoJobSpec {
  requisitionId: string;
  title: string;
  companyKey: string;
  categoryRole: string; // for internal verification: SDE, Frontend, Backend, etc.
  description: string;
  responsibilities: string[];
  location: string;
  workplaceType: WorkplaceType;
  jobType: JobType;
  requiredSkillNames: string[];
  preferredSkillNames: string[];
  minCgpa: number;
  eligibleDepartments: string[];
  eligibleGraduationYears: number[];
  salaryRange: { min: number; max: number; currency: string };
  deadlineDays: number;
}

// 10 Distinct Demo Companies
const DEMO_COMPANIES = [
  {
    key: 'evidra_labs',
    name: 'Evidra Partner Labs [DEMO]',
    industry: 'Artificial Intelligence & Software',
    website: 'https://evidra.dev/demo-labs',
    description: '[NOTE: DEMO DATA] Platform engineering and verifiable skill intelligence incubator.',
  },
  {
    key: 'nexus_cloud',
    name: 'NexusTech Cloud Labs [DEMO]',
    industry: 'Cloud Computing & Infrastructure',
    website: 'https://nexustech.demo.evidra.dev',
    description: '[NOTE: DEMO DATA] Next-generation hybrid cloud orchestration and enterprise microservices.',
  },
  {
    key: 'finedge_banking',
    name: 'FinEdge Core Banking Solutions [DEMO]',
    industry: 'FinTech & Banking Systems',
    website: 'https://finedge.demo.evidra.dev',
    description: '[NOTE: DEMO DATA] High-availability core payment rails and financial fraud mitigation systems.',
  },
  {
    key: 'cyberpulse_security',
    name: 'CyberPulse Security Systems [DEMO]',
    industry: 'Cybersecurity & Threat Intelligence',
    website: 'https://cyberpulse.demo.evidra.dev',
    description: '[NOTE: DEMO DATA] Automated zero-trust endpoint protection and identity access infrastructure.',
  },
  {
    key: 'innowave_analytics',
    name: 'InnoWave Analytics [DEMO]',
    industry: 'Enterprise Business Intelligence & Analytics',
    website: 'https://innowave.demo.evidra.dev',
    description: '[NOTE: DEMO DATA] Real-time business intelligence pipelines and predictive market analytics.',
  },
  {
    key: 'algorhythm_ai',
    name: 'Algorhythm AI Research [DEMO]',
    industry: 'Artificial Intelligence & Machine Learning',
    website: 'https://algorhythm.demo.evidra.dev',
    description: '[NOTE: DEMO DATA] Applied machine learning, multimodal computer vision, and NLP research.',
  },
  {
    key: 'omniretail_commerce',
    name: 'OmniRetail Commerce Systems [DEMO]',
    industry: 'E-Commerce & Supply Chain Platforms',
    website: 'https://omniretail.demo.evidra.dev',
    description: '[NOTE: DEMO DATA] Omnichannel e-commerce engine powering global inventory and storefront logistics.',
  },
  {
    key: 'healthsync_digital',
    name: 'HealthSync Digital [DEMO]',
    industry: 'Digital Health & MedTech Platforms',
    website: 'https://healthsync.demo.evidra.dev',
    description: '[NOTE: DEMO DATA] HIPAA-compliant medical telemetry, hospital analytics, and digital care platforms.',
  },
  {
    key: 'quantscale_systems',
    name: 'QuantScale Enterprise Systems [DEMO]',
    industry: 'High-Frequency Distributed Systems',
    website: 'https://quantscale.demo.evidra.dev',
    description: '[NOTE: DEMO DATA] Ultra-low-latency distributed data feeds and high-throughput order matching.',
  },
  {
    key: 'aerometrics_systems',
    name: 'AeroMetrics Systems [DEMO]',
    industry: 'Aerospace Systems & Embedded IoT',
    website: 'https://aerometrics.demo.evidra.dev',
    description: '[NOTE: DEMO DATA] Embedded avionics software, real-time sensor processing, and IoT telemetry.',
  },
];

// 30 Realistic Demo Jobs covering all 12 requested categories
const DEMO_JOB_SPECS: DemoJobSpec[] = [
  // -------------------------------------------------------------
  // Category 1: Software Development Engineer / SDE Intern (4)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-SDE-001',
    title: 'Software Development Engineer I (SDE I) [DEMO]',
    companyKey: 'nexus_cloud',
    categoryRole: 'Software Development Engineer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nNexusTech is seeking an agile Software Development Engineer I to join our core cloud platform team. You will design, build, and deploy high-throughput microservices, collaborate on low-latency architectural patterns, and contribute to production services handling millions of API calls daily.',
    responsibilities: [
      'Implement scalable backend microservices and RESTful API endpoints',
      'Write comprehensive unit and integration tests with deterministic test coverage',
      'Participate in agile sprint rituals, design reviews, and automated CI/CD deployments',
      'Optimize database queries and cache access patterns for sub-10ms response latencies',
    ],
    location: 'Bengaluru, Karnataka',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkillNames: ['Java', 'C++', 'Git', 'SQL'],
    preferredSkillNames: ['Docker', 'PostgreSQL', 'Linux'],
    minCgpa: 7.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Electronics & Telecommunication'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1400000, max: 2000000, currency: 'INR' },
    deadlineDays: 60,
  },
  {
    requisitionId: 'DEMO-REQ-SDE-002',
    title: 'Software Development Engineer Intern (SDE Intern) [DEMO]',
    companyKey: 'evidra_labs',
    categoryRole: 'SDE Intern',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nEvidra Partner Labs invites passionate computer science students to join our 6-month Software Engineering Internship. You will work alongside senior software architects on real engineering problems, implementing deterministic data models and building reliable distributed services.',
    responsibilities: [
      'Develop core features in collaboration with mentor software engineers',
      'Write clean, maintainable code adhering to standard algorithmic complexity benchmarks',
      'Debug distributed tracing logs and optimize system memory utilization',
      'Document technical design specifications and code repository guides',
    ],
    location: 'Hyderabad, Telangana',
    workplaceType: 'on_site',
    jobType: 'internship',
    requiredSkillNames: ['C++', 'Python', 'Git'],
    preferredSkillNames: ['Linux', 'SQL', 'Data Analysis'],
    minCgpa: 7.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Artificial Intelligence & Data Science'],
    eligibleGraduationYears: [2026, 2027],
    salaryRange: { min: 480000, max: 720000, currency: 'INR' },
    deadlineDays: 45,
  },
  {
    requisitionId: 'DEMO-REQ-SDE-003',
    title: 'Graduate Software Engineer (Core Systems) [DEMO]',
    companyKey: 'quantscale_systems',
    categoryRole: 'Software Development Engineer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nQuantScale Enterprise is recruiting recent university graduates for our high-frequency execution platform. This role demands deep mastery of object-oriented concepts, operating system internals, concurrent memory models, and zero-allocation architectural design.',
    responsibilities: [
      'Engineer low-latency data structures for high-volume message passing',
      'Benchmark and profile CPU cache efficiency across multi-threaded workers',
      'Automate system deployment scripts and continuous integration pipelines',
    ],
    location: 'Mumbai, Maharashtra',
    workplaceType: 'on_site',
    jobType: 'full_time',
    requiredSkillNames: ['C++', 'Java', 'Linux'],
    preferredSkillNames: ['Redis', 'Git', 'SQL'],
    minCgpa: 8.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Electronics & Telecommunication'],
    eligibleGraduationYears: [2025, 2026],
    salaryRange: { min: 1600000, max: 2400000, currency: 'INR' },
    deadlineDays: 30,
  },
  {
    requisitionId: 'DEMO-REQ-SDE-004',
    title: 'Associate Software Engineer (Platform) [DEMO]',
    companyKey: 'finedge_banking',
    categoryRole: 'Software Development Engineer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nFinEdge Banking Solutions is hiring an Associate Software Engineer to enhance transaction verification pipelines. You will collaborate on resilient database transactions, audit-compliant messaging, and secure banking protocol integrations.',
    responsibilities: [
      'Build idempotent RESTful web services compliant with financial industry regulations',
      'Construct automated integration test suites for core ledger APIs',
      'Work closely with DevOps engineers on Kubernetes container deployments',
    ],
    location: 'Pune, Maharashtra',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkillNames: ['Java', 'SQL', 'Git'],
    preferredSkillNames: ['Spring Boot', 'Docker', 'PostgreSQL'],
    minCgpa: 6.8,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1100000, max: 1500000, currency: 'INR' },
    deadlineDays: 60,
  },

  // -------------------------------------------------------------
  // Category 2: Frontend Developer (3)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-FE-005',
    title: 'Frontend Engineer (React / TypeScript) [DEMO]',
    companyKey: 'evidra_labs',
    categoryRole: 'Frontend Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nJoin Evidra Partner Labs as a Frontend Engineer dedicated to creating lightning-fast, accessible dashboard applications. You will translate complex verifiable credentials, skill evidence trees, and candidate match graphs into polished, responsive user interfaces.',
    responsibilities: [
      'Build stateful UI components in React, TypeScript, and modern Tailwind CSS',
      'Optimize client-side bundle size, initial load latency, and Core Web Vitals',
      'Integrate TanStack React Query for efficient asynchronous server-state caching',
      'Ensure WCAG 2.1 AA accessibility standards and cross-browser resilience',
    ],
    location: 'Remote',
    workplaceType: 'remote',
    jobType: 'full_time',
    requiredSkillNames: ['React', 'TypeScript', 'JavaScript', 'CSS3'],
    preferredSkillNames: ['Tailwind CSS', 'Jest', 'HTML5'],
    minCgpa: 6.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1200000, max: 1800000, currency: 'INR' },
    deadlineDays: 45,
  },
  {
    requisitionId: 'DEMO-REQ-FE-006',
    title: 'Junior Frontend Developer [DEMO]',
    companyKey: 'omniretail_commerce',
    categoryRole: 'Frontend Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nOmniRetail is looking for an enthusiastic Junior Frontend Developer to build next-generation consumer storefront interfaces. You will build checkout workflows, interactive product catalogs, and performance-tuned mobile web components.',
    responsibilities: [
      'Implement responsive layouts using clean HTML5 semantics, modern CSS3, and React',
      'Collaborate with UI/UX product designers on design tokens and interaction prototypes',
      'Fix UI layout defects, maintain cross-device rendering consistency, and write tests',
    ],
    location: 'Gurugram, Haryana',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkillNames: ['JavaScript', 'HTML5', 'CSS3', 'React'],
    preferredSkillNames: ['Tailwind CSS', 'Git'],
    minCgpa: 6.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Computer Applications'],
    eligibleGraduationYears: [2025, 2026],
    salaryRange: { min: 800000, max: 1200000, currency: 'INR' },
    deadlineDays: 60,
  },
  {
    requisitionId: 'DEMO-REQ-FE-007',
    title: 'Frontend UI/UX Engineering Intern [DEMO]',
    companyKey: 'innowave_analytics',
    categoryRole: 'Frontend Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nInnoWave Analytics offers a 6-month internship for creative frontend engineers. You will design and code interactive charting components, data visualization filters, and responsive operational consoles.',
    responsibilities: [
      'Build interactive dashboard widgets and graphical charts in React',
      'Refactor existing components to utilize Tailwind utility classes and CSS animations',
      'Write comprehensive unit tests with Jest and React Testing Library',
    ],
    location: 'Noida, Uttar Pradesh',
    workplaceType: 'remote',
    jobType: 'internship',
    requiredSkillNames: ['React', 'JavaScript', 'Tailwind CSS'],
    preferredSkillNames: ['TypeScript', 'Git', 'CSS3'],
    minCgpa: 6.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2026, 2027],
    salaryRange: { min: 360000, max: 600000, currency: 'INR' },
    deadlineDays: 30,
  },

  // -------------------------------------------------------------
  // Category 3: Backend Developer (3)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-BE-008',
    title: 'Backend Services Engineer (Node.js) [DEMO]',
    companyKey: 'evidra_labs',
    categoryRole: 'Backend Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nEvidra Partner Labs is seeking a Backend Services Engineer to power our deterministic skill matching algorithms and audit trail storage. You will architect robust REST APIs, handle MongoDB schema migrations, and secure tokenized authentication flows.',
    responsibilities: [
      'Design clean, modular Express services with strict TypeScript type-checking',
      'Implement indexing and schema optimization on high-volume MongoDB collections',
      'Write end-to-end integration tests using Vitest and Supertest',
      'Audit API endpoints for security best practices and role-based access control (RBAC)',
    ],
    location: 'Bengaluru, Karnataka',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkillNames: ['Node.js', 'Express', 'PostgreSQL', 'MongoDB'],
    preferredSkillNames: ['Redis', 'Docker', 'TypeScript'],
    minCgpa: 6.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1300000, max: 1900000, currency: 'INR' },
    deadlineDays: 60,
  },
  {
    requisitionId: 'DEMO-REQ-BE-009',
    title: 'Backend Systems Developer (Distributed Architecture) [DEMO]',
    companyKey: 'quantscale_systems',
    categoryRole: 'Backend Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nQuantScale Systems is expanding our core distributed backend team. You will build high-reliability services that ingest, validate, and broadcast real-time metrics across clustered environments.',
    responsibilities: [
      'Implement distributed locking, worker queues, and caching with Redis and PostgreSQL',
      'Profile network throughput and eliminate database bottlenecks in production',
      'Coordinate containerized rollouts with Docker and Kubernetes',
    ],
    location: 'Chennai, Tamil Nadu',
    workplaceType: 'on_site',
    jobType: 'full_time',
    requiredSkillNames: ['Node.js', 'PostgreSQL', 'Redis'],
    preferredSkillNames: ['Docker', 'Kubernetes', 'GraphQL'],
    minCgpa: 7.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1500000, max: 2200000, currency: 'INR' },
    deadlineDays: 45,
  },
  {
    requisitionId: 'DEMO-REQ-BE-010',
    title: 'Backend Developer Intern [DEMO]',
    companyKey: 'cyberpulse_security',
    categoryRole: 'Backend Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nCyberPulse Security offers an intensive 6-month backend internship. You will gain hands-on experience building defensive security APIs, event stream collectors, and cryptographic verification modules.',
    responsibilities: [
      'Write well-documented Node.js / Express microservices for event processing',
      'Construct automated unit tests for data parsing and validation routines',
      'Assist senior engineers in code reviews and CI pipeline maintenance',
    ],
    location: 'Pune, Maharashtra',
    workplaceType: 'remote',
    jobType: 'internship',
    requiredSkillNames: ['Node.js', 'MongoDB', 'Git'],
    preferredSkillNames: ['Express', 'Linux', 'SQL'],
    minCgpa: 7.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2026, 2027],
    salaryRange: { min: 420000, max: 600000, currency: 'INR' },
    deadlineDays: 30,
  },

  // -------------------------------------------------------------
  // Category 4: Full-Stack Developer (3)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-FS-011',
    title: 'Full-Stack Web Developer (MERN Stack) [DEMO]',
    companyKey: 'evidra_labs',
    categoryRole: 'Full-Stack Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nEvidra Partner Labs is hiring an end-to-end Full-Stack Engineer. You will take feature ownership from database schemas through backend REST services up to elegant React interfaces.',
    responsibilities: [
      'Design MongoDB collections, Mongoose models, and transactional validation logic',
      'Build secure, authenticated Express backend controllers and middleware',
      'Construct responsive React UI pages with TanStack Query and Tailwind CSS',
      'Enforce type safety across both frontend and backend modules',
    ],
    location: 'Bengaluru, Karnataka',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkillNames: ['React', 'Node.js', 'MongoDB', 'JavaScript'],
    preferredSkillNames: ['TypeScript', 'Express', 'Tailwind CSS'],
    minCgpa: 6.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1200000, max: 1800000, currency: 'INR' },
    deadlineDays: 60,
  },
  {
    requisitionId: 'DEMO-REQ-FS-012',
    title: 'Full-Stack TypeScript Engineer [DEMO]',
    companyKey: 'nexus_cloud',
    categoryRole: 'Full-Stack Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nNexusTech is recruiting a Full-Stack Engineer fluent in modern TypeScript. You will build cloud console interfaces, provisioning workflows, and billing management systems.',
    responsibilities: [
      'Develop end-to-end typed web applications using React and Node.js',
      'Create relational database migrations and performant SQL queries in PostgreSQL',
      'Deploy containerized services to AWS ECS and Kubernetes clusters',
    ],
    location: 'Hyderabad, Telangana',
    workplaceType: 'remote',
    jobType: 'full_time',
    requiredSkillNames: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    preferredSkillNames: ['Docker', 'AWS', 'GraphQL'],
    minCgpa: 7.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1400000, max: 2100000, currency: 'INR' },
    deadlineDays: 45,
  },
  {
    requisitionId: 'DEMO-REQ-FS-013',
    title: 'Junior Full-Stack Developer [DEMO]',
    companyKey: 'healthsync_digital',
    categoryRole: 'Full-Stack Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nHealthSync Digital is seeking a Junior Full-Stack Developer to build patient engagement portals and provider management tools. This is a tremendous opportunity to build real-world full-stack web applications with mentorship.',
    responsibilities: [
      'Assist in developing customer-facing web screens and backend API services',
      'Maintain database integrity and execute automated regression test scripts',
      'Participate in sprint standups, backlog grooming, and code reviews',
    ],
    location: 'Ahmedabad, Gujarat',
    workplaceType: 'on_site',
    jobType: 'full_time',
    requiredSkillNames: ['JavaScript', 'HTML5', 'Node.js', 'MongoDB'],
    preferredSkillNames: ['React', 'Git', 'CSS3'],
    minCgpa: 6.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Computer Applications'],
    eligibleGraduationYears: [2025, 2026],
    salaryRange: { min: 750000, max: 1100000, currency: 'INR' },
    deadlineDays: 90,
  },

  // -------------------------------------------------------------
  // Category 5: Python Developer (2)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-PY-014',
    title: 'Python Backend Developer (FastAPI / Django) [DEMO]',
    companyKey: 'innowave_analytics',
    categoryRole: 'Python Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nInnoWave Analytics is seeking a Python Backend Developer to engineer data ingestion services and REST APIs with FastAPI and Django. You will build asynchronous task queues, manage relational database access, and expose performant analytics endpoints.',
    responsibilities: [
      'Build asynchronous API services in Python using FastAPI and Pydantic validation',
      'Implement data processing tasks with Celery and Redis worker pools',
      'Optimize complex PostgreSQL relational schemas and query performance',
    ],
    location: 'Pune, Maharashtra',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkillNames: ['Python', 'FastAPI', 'PostgreSQL', 'Git'],
    preferredSkillNames: ['Docker', 'Redis', 'Linux', 'Django'],
    minCgpa: 6.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Artificial Intelligence & Data Science'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1100000, max: 1650000, currency: 'INR' },
    deadlineDays: 60,
  },
  {
    requisitionId: 'DEMO-REQ-PY-015',
    title: 'Python Software Development Engineer [DEMO]',
    companyKey: 'aerometrics_systems',
    categoryRole: 'Python Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nAeroMetrics Systems is hiring a Python Software Engineer to build mission-critical telemetry pipelines. You will develop automated validation tools, parser utilities, and distributed logging pipelines.',
    responsibilities: [
      'Develop robust Python automation scripts and data ingestion pipelines',
      'Write multi-process Python utilities for high-throughput socket streams',
      'Collaborate on embedded Linux testing environments and continuous delivery',
    ],
    location: 'Bengaluru, Karnataka',
    workplaceType: 'on_site',
    jobType: 'full_time',
    requiredSkillNames: ['Python', 'Linux', 'Git', 'SQL'],
    preferredSkillNames: ['Docker', 'C++', 'Pandas'],
    minCgpa: 7.2,
    eligibleDepartments: ['Computer Science & Engineering', 'Electronics & Telecommunication'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1300000, max: 1900000, currency: 'INR' },
    deadlineDays: 45,
  },

  // -------------------------------------------------------------
  // Category 6: Data Analyst (2)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-DA-016',
    title: 'Associate Data Analyst [DEMO]',
    companyKey: 'innowave_analytics',
    categoryRole: 'Data Analyst',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nInnoWave Analytics has an immediate opening for an Associate Data Analyst. You will partner with business stakeholders to extract business insights, build interactive Power BI executive dashboards, and write advanced analytical SQL queries.',
    responsibilities: [
      'Write complex analytical SQL queries (window functions, aggregations, CTEs) on enterprise data marts',
      'Build and maintain interactive Power BI dashboards for leadership review',
      'Conduct exploratory data analysis using Python and Pandas to uncover operational anomalies',
      'Present findings and quantitative trends to cross-functional product teams',
    ],
    location: 'Gurugram, Haryana',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkillNames: ['SQL', 'Python', 'Power BI', 'Data Analysis'],
    preferredSkillNames: ['Tableau', 'Pandas', 'PostgreSQL'],
    minCgpa: 6.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Artificial Intelligence & Data Science'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 800000, max: 1200000, currency: 'INR' },
    deadlineDays: 45,
  },
  {
    requisitionId: 'DEMO-REQ-DA-017',
    title: 'Data & Business Intelligence Analyst [DEMO]',
    companyKey: 'omniretail_commerce',
    categoryRole: 'Data Analyst',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nOmniRetail Commerce is seeking a Data & BI Analyst to optimize our retail supply chain analytics. You will evaluate fulfillment velocities, warehouse inventory turns, and customer retention metrics.',
    responsibilities: [
      'Develop interactive Tableau dashboards tracking order fulfillment and revenue KPIs',
      'Perform data cleansing and schema transformation across multiple transactional sources',
      'Translate raw database records into clear executive summaries and operational recommendations',
    ],
    location: 'Bengaluru, Karnataka',
    workplaceType: 'remote',
    jobType: 'full_time',
    requiredSkillNames: ['SQL', 'Tableau', 'Data Analysis'],
    preferredSkillNames: ['Python', 'PostgreSQL', 'Power BI'],
    minCgpa: 6.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Artificial Intelligence & Data Science'],
    eligibleGraduationYears: [2025, 2026],
    salaryRange: { min: 900000, max: 1350000, currency: 'INR' },
    deadlineDays: 60,
  },

  // -------------------------------------------------------------
  // Category 7: Data Scientist (2)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-DS-018',
    title: 'Junior Data Scientist [DEMO]',
    companyKey: 'algorhythm_ai',
    categoryRole: 'Data Scientist',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nAlgorhythm AI Research is recruiting a Junior Data Scientist to develop statistical and machine learning models. You will perform feature engineering, train predictive classifiers, and evaluate model fairness and performance benchmarks.',
    responsibilities: [
      'Design, train, and validate supervised machine learning models using Scikit-Learn and Python',
      'Perform feature extraction and statistical hypothesis testing on structured datasets',
      'Collaborate with software engineers to package models into production microservices',
    ],
    location: 'Bengaluru, Karnataka',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkillNames: ['Python', 'Machine Learning', 'Pandas', 'SQL'],
    preferredSkillNames: ['NumPy', 'Deep Learning', 'Git'],
    minCgpa: 7.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Artificial Intelligence & Data Science'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1400000, max: 2100000, currency: 'INR' },
    deadlineDays: 45,
  },
  {
    requisitionId: 'DEMO-REQ-DS-019',
    title: 'Applied Data Scientist (Analytics & Predictive Modeling) [DEMO]',
    companyKey: 'finedge_banking',
    categoryRole: 'Data Scientist',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nFinEdge Core Banking is expanding our AI decisioning team. You will build credit scoring algorithms, fraud detection classifiers, and churn prediction models grounded in rigorous statistical methodologies.',
    responsibilities: [
      'Build end-to-end predictive machine learning pipelines in Python and PostgreSQL',
      'Conduct rigorous cross-validation and hyperparameter tuning to avoid data leakage',
      'Document model explainability, feature importances, and regulatory risk assessments',
    ],
    location: 'Mumbai, Maharashtra',
    workplaceType: 'on_site',
    jobType: 'full_time',
    requiredSkillNames: ['Python', 'Machine Learning', 'PostgreSQL', 'Data Analysis'],
    preferredSkillNames: ['Docker', 'Deep Learning', 'Pandas'],
    minCgpa: 7.8,
    eligibleDepartments: ['Computer Science & Engineering', 'Artificial Intelligence & Data Science'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1550000, max: 2300000, currency: 'INR' },
    deadlineDays: 30,
  },

  // -------------------------------------------------------------
  // Category 8: Machine Learning / AI Intern (3)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-ML-020',
    title: 'Machine Learning Engineer Intern [DEMO]',
    companyKey: 'algorhythm_ai',
    categoryRole: 'Machine Learning / AI Intern',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nAlgorhythm AI offers a 6-month research internship for talented ML enthusiasts. You will benchmark state-of-the-art neural networks, perform ablation studies, and train PyTorch architectures on distributed GPU clusters.',
    responsibilities: [
      'Implement deep learning model architectures in PyTorch',
      'Preprocess large-scale unstructured training datasets and data augmentation pipelines',
      'Track model training metrics and loss curves using standard experiment logging frameworks',
    ],
    location: 'Bengaluru, Karnataka',
    workplaceType: 'hybrid',
    jobType: 'internship',
    requiredSkillNames: ['Python', 'Machine Learning', 'PyTorch'],
    preferredSkillNames: ['NumPy', 'Pandas', 'Git'],
    minCgpa: 7.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Artificial Intelligence & Data Science'],
    eligibleGraduationYears: [2026, 2027],
    salaryRange: { min: 480000, max: 720000, currency: 'INR' },
    deadlineDays: 30,
  },
  {
    requisitionId: 'DEMO-REQ-ML-021',
    title: 'Generative AI & LLM Research Intern [DEMO]',
    companyKey: 'evidra_labs',
    categoryRole: 'Machine Learning / AI Intern',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nEvidra Partner Labs is seeking an AI Intern to explore Retrieval-Augmented Generation (RAG), vector embeddings, and LLM reasoning pipelines. You will evaluate model accuracy against deterministic rubric standards.',
    responsibilities: [
      'Implement semantic embedding indexing and vector retrieval pipelines with Python',
      'Benchmark prompt engineering strategies and measure deterministic output conformity',
      'Build evaluation test suites for hallucination detection and response quality',
    ],
    location: 'Remote',
    workplaceType: 'remote',
    jobType: 'internship',
    requiredSkillNames: ['Python', 'Machine Learning', 'Deep Learning'],
    preferredSkillNames: ['PyTorch', 'TensorFlow', 'FastAPI'],
    minCgpa: 7.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Artificial Intelligence & Data Science'],
    eligibleGraduationYears: [2025, 2026, 2027],
    salaryRange: { min: 540000, max: 840000, currency: 'INR' },
    deadlineDays: 45,
  },
  {
    requisitionId: 'DEMO-REQ-ML-022',
    title: 'Computer Vision & AI Intern [DEMO]',
    companyKey: 'healthsync_digital',
    categoryRole: 'Machine Learning / AI Intern',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nHealthSync Digital is offering a Computer Vision Internship focused on medical image segmentation and optical character recognition. You will work on pre-trained convolutional neural networks in TensorFlow and PyTorch.',
    responsibilities: [
      'Train image classification and object detection networks using TensorFlow',
      'Optimize edge inference performance for lightweight mobile deployment',
      'Prepare data annotation guidelines and validate labeled image datasets',
    ],
    location: 'Hyderabad, Telangana',
    workplaceType: 'on_site',
    jobType: 'internship',
    requiredSkillNames: ['Python', 'Deep Learning', 'TensorFlow'],
    preferredSkillNames: ['NumPy', 'Linux', 'PyTorch'],
    minCgpa: 7.2,
    eligibleDepartments: ['Computer Science & Engineering', 'Artificial Intelligence & Data Science', 'Electronics & Telecommunication'],
    eligibleGraduationYears: [2026, 2027],
    salaryRange: { min: 420000, max: 600000, currency: 'INR' },
    deadlineDays: 60,
  },

  // -------------------------------------------------------------
  // Category 9: Java Developer (2)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-JAVA-023',
    title: 'Enterprise Java Developer (Spring Boot) [DEMO]',
    companyKey: 'finedge_banking',
    categoryRole: 'Java Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nFinEdge Banking is hiring a Java Developer with strong Spring Boot capabilities. You will develop distributed enterprise services, configure Hibernate ORM mappings, and ensure resilient database connection pooling.',
    responsibilities: [
      'Design and implement microservices utilizing Spring Boot, Spring Security, and JPA',
      'Build robust relational database transactions and schema migrations in PostgreSQL',
      'Write comprehensive unit tests with JUnit and Mockito to achieve >85% code coverage',
      'Participate in code reviews, technical spike investigations, and architectural reviews',
    ],
    location: 'Pune, Maharashtra',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkillNames: ['Java', 'Spring Boot', 'PostgreSQL', 'Git'],
    preferredSkillNames: ['Docker', 'Redis', 'CI/CD'],
    minCgpa: 6.8,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1200000, max: 1800000, currency: 'INR' },
    deadlineDays: 60,
  },
  {
    requisitionId: 'DEMO-REQ-JAVA-024',
    title: 'Java Microservices Software Engineer [DEMO]',
    companyKey: 'quantscale_systems',
    categoryRole: 'Java Developer',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nQuantScale Systems is seeking a Java Microservices Engineer to develop mission-critical real-time services. You will build asynchronous messaging listeners, implement circuit breaker patterns, and optimize Java memory garbage collection.',
    responsibilities: [
      'Implement enterprise microservices in modern Java (Java 17/21) and Spring Boot',
      'Construct high-throughput messaging event streams and relational storage layers',
      'Coordinate containerized deployments via Docker and Kubernetes clusters',
    ],
    location: 'Hyderabad, Telangana',
    workplaceType: 'on_site',
    jobType: 'full_time',
    requiredSkillNames: ['Java', 'Spring Boot', 'SQL'],
    preferredSkillNames: ['Kubernetes', 'Docker', 'Redis'],
    minCgpa: 7.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 1350000, max: 2000000, currency: 'INR' },
    deadlineDays: 45,
  },

  // -------------------------------------------------------------
  // Category 10: DevOps Intern (2)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-DO-025',
    title: 'Cloud Infrastructure & DevOps Intern [DEMO]',
    companyKey: 'nexus_cloud',
    categoryRole: 'DevOps Intern',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nNexusTech Cloud Labs is offering a hands-on DevOps Internship. You will master modern Infrastructure as Code, containerization with Docker, Kubernetes cluster orchestration, and automated CI/CD pipeline authoring.',
    responsibilities: [
      'Configure automated CI/CD pipelines using GitHub Actions to lint, test, and package services',
      'Write Dockerfiles adhering to container security best practices and multi-stage builds',
      'Manage Linux server configurations, firewall rules, and SSH key rotations',
    ],
    location: 'Bengaluru, Karnataka',
    workplaceType: 'hybrid',
    jobType: 'internship',
    requiredSkillNames: ['Linux', 'Docker', 'AWS', 'Git'],
    preferredSkillNames: ['Kubernetes', 'CI/CD'],
    minCgpa: 7.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2026, 2027],
    salaryRange: { min: 420000, max: 660000, currency: 'INR' },
    deadlineDays: 30,
  },
  {
    requisitionId: 'DEMO-REQ-DO-026',
    title: 'Site Reliability & Container Platform Intern [DEMO]',
    companyKey: 'cyberpulse_security',
    categoryRole: 'DevOps Intern',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nCyberPulse Security is hiring a Site Reliability Engineering (SRE) & DevOps Intern. You will work on cluster monitoring, log aggregation, automated disaster recovery procedures, and container platform stability.',
    responsibilities: [
      'Deploy and monitor containerized microservices across staging environments',
      'Write shell scripts for server maintenance, backup verification, and log rotation',
      'Integrate observability metrics, error rate alarms, and latency thresholds',
    ],
    location: 'Remote',
    workplaceType: 'remote',
    jobType: 'internship',
    requiredSkillNames: ['Linux', 'Docker', 'Kubernetes'],
    preferredSkillNames: ['Python', 'CI/CD', 'Git'],
    minCgpa: 6.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2025, 2026, 2027],
    salaryRange: { min: 360000, max: 540000, currency: 'INR' },
    deadlineDays: 45,
  },

  // -------------------------------------------------------------
  // Category 11: QA / Software Testing Intern (2)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-QA-027',
    title: 'QA Automation Engineer Intern [DEMO]',
    companyKey: 'omniretail_commerce',
    categoryRole: 'QA / Software Testing Intern',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nOmniRetail Commerce is recruiting a QA Automation Intern to ensure flawless software quality across our e-commerce platforms. You will design test plans, automate web browser scenarios with Selenium, and report defects with thorough reproduction steps.',
    responsibilities: [
      'Author automated end-to-end browser test suites using Selenium WebDriver',
      'Execute exploratory manual testing on staging builds prior to production releases',
      'Document bug reports, edge cases, and automated regression results in issue trackers',
    ],
    location: 'Delhi NCR',
    workplaceType: 'hybrid',
    jobType: 'internship',
    requiredSkillNames: ['Selenium', 'Java', 'Git'],
    preferredSkillNames: ['PostgreSQL', 'CI/CD', 'SQL'],
    minCgpa: 6.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Computer Applications'],
    eligibleGraduationYears: [2026, 2027],
    salaryRange: { min: 300000, max: 480000, currency: 'INR' },
    deadlineDays: 45,
  },
  {
    requisitionId: 'DEMO-REQ-QA-028',
    title: 'Software Development Engineer in Test (SDET Intern) [DEMO]',
    companyKey: 'evidra_labs',
    categoryRole: 'QA / Software Testing Intern',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nEvidra Partner Labs is seeking an SDET Intern to automate API and frontend test harnesses. You will work on contract testing, mock API servers, and integration pipelines utilizing Jest and Cypress.',
    responsibilities: [
      'Build automated regression test suites using Jest and Cypress',
      'Perform automated API integration tests validating JSON schema conformity and error codes',
      'Maintain continuous integration test jobs and report flaky test metrics',
    ],
    location: 'Remote',
    workplaceType: 'remote',
    jobType: 'internship',
    requiredSkillNames: ['JavaScript', 'Jest', 'Cypress'],
    preferredSkillNames: ['Node.js', 'TypeScript', 'Git'],
    minCgpa: 6.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2026, 2027],
    salaryRange: { min: 360000, max: 540000, currency: 'INR' },
    deadlineDays: 30,
  },

  // -------------------------------------------------------------
  // Category 12: Business Analyst (2)
  // -------------------------------------------------------------
  {
    requisitionId: 'DEMO-REQ-BA-029',
    title: 'Associate Technical Business Analyst [DEMO]',
    companyKey: 'finedge_banking',
    categoryRole: 'Business Analyst',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nFinEdge Banking Solutions is hiring an Associate Business Analyst to bridge technical architecture and business banking workflows. You will gather business requirements, write user stories, and evaluate data models with SQL queries.',
    responsibilities: [
      'Elicit business requirements from stakeholders and translate them into detailed technical user stories',
      'Model business process workflows (BPMN) and user acceptance testing (UAT) scenarios',
      'Query relational SQL databases to validate requirements and analyze current operational metrics',
      'Facilitate agile sprint grooming and release backlog prioritization',
    ],
    location: 'Mumbai, Maharashtra',
    workplaceType: 'hybrid',
    jobType: 'full_time',
    requiredSkillNames: ['Business Analysis', 'SQL', 'Agile & Scrum'],
    preferredSkillNames: ['Power BI', 'Data Analysis'],
    minCgpa: 6.5,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Computer Applications'],
    eligibleGraduationYears: [2024, 2025, 2026],
    salaryRange: { min: 950000, max: 1400000, currency: 'INR' },
    deadlineDays: 60,
  },
  {
    requisitionId: 'DEMO-REQ-BA-030',
    title: 'Product & Operations Business Analyst [DEMO]',
    companyKey: 'innowave_analytics',
    categoryRole: 'Business Analyst',
    description:
      '[NOTE: DEMO DATA - Created for Evidra platform testing and demonstration. Not an active employer opening.]\n\nInnoWave Analytics is seeking a Product & Operations Business Analyst to optimize customer onboarding and service analytics. You will map user journeys, analyze performance funnels, and author functional specification documents.',
    responsibilities: [
      'Document functional and non-functional specifications for enterprise analytics portals',
      'Collaborate with engineering leads and product managers on feature delivery milestones',
      'Analyze usage funnels and customer drop-off metrics to propose data-backed feature improvements',
    ],
    location: 'Kolkata, West Bengal',
    workplaceType: 'on_site',
    jobType: 'full_time',
    requiredSkillNames: ['Business Analysis', 'Agile & Scrum', 'Data Analysis'],
    preferredSkillNames: ['SQL', 'Tableau', 'Power BI'],
    minCgpa: 6.0,
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    eligibleGraduationYears: [2025, 2026],
    salaryRange: { min: 850000, max: 1250000, currency: 'INR' },
    deadlineDays: 45,
  },
];

/**
 * Idempotently seeds 30 realistic demo jobs into MongoDB.
 * Ensures strict production guard and exact duplicate detection.
 */
export const seedDemoJobs = async (): Promise<SeedJobsResult> => {
  // 1. Production Environment Guard
  if (config.NODE_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('[SeedDemoJobs] REFUSING TO SEED DEMO DATA IN PRODUCTION ENVIRONMENT.');
  }

  // 2. Database Connection Check
  if (!isDatabaseConnected()) {
    throw new Error(
      '[SeedDemoJobs] MongoDB is not connected! Ensure MongoDB is running and MONGODB_URI is configured.'
    );
  }

  console.log('[SeedDemoJobs] Step 1: Ensuring canonical skills dictionary is seeded...');
  await seedCanonicalSkills();

  // 3. Find poster user (Admin or Recruiter)
  const posterUser =
    (await User.findOne({ role: 'admin' })) ||
    (await User.findOne({ role: 'recruiter' })) ||
    (await User.findOne());

  if (!posterUser) {
    throw new Error(
      '[SeedDemoJobs] No user found in database to assign as job poster. Please seed base users first.'
    );
  }

  // Find any recruiter users to grant company access
  const recruiterUsers = await User.find({ role: 'recruiter' }).select('_id');
  const recruiterIds = recruiterUsers.map((u) => u._id as Types.ObjectId);

  // 4. Ensure Demo Companies exist
  console.log('[SeedDemoJobs] Step 2: Ensuring demo companies exist...');
  const companyMap = new Map<string, ICompany>();

  for (const compDef of DEMO_COMPANIES) {
    let company = await Company.findOne({ name: compDef.name });
    if (!company) {
      company = await Company.create({
        name: compDef.name,
        industry: compDef.industry,
        website: compDef.website,
        description: compDef.description,
        isVerified: true,
        createdBy: posterUser._id,
        authorizedRecruiters: recruiterIds,
      });
      console.log(`[SeedDemoJobs] Created company: ${compDef.name}`);
    } else {
      // Ensure all recruiter users are authorized for this demo company
      let updated = false;
      company.authorizedRecruiters = company.authorizedRecruiters || [];
      for (const recId of recruiterIds) {
        if (!company.authorizedRecruiters.some((id) => id.toString() === recId.toString())) {
          company.authorizedRecruiters.push(recId);
          updated = true;
        }
      }
      if (updated) await company.save();
    }
    companyMap.set(compDef.key, company);
  }

  // 5. Pre-resolve skill documents
  console.log('[SeedDemoJobs] Step 3: Resolving canonical skills for demo job specs...');
  const skillCache = new Map<string, ISkill>();

  const resolveSkill = async (name: string): Promise<ISkill | null> => {
    if (skillCache.has(name)) return skillCache.get(name)!;
    const doc = await resolveSkillDocument(name);
    if (doc) skillCache.set(name, doc);
    return doc;
  };

  // 6. Idempotently insert each of the 30 demo jobs
  console.log(`[SeedDemoJobs] Step 4: Idempotently seeding ${DEMO_JOB_SPECS.length} demo jobs...`);
  let createdCount = 0;
  let skippedCount = 0;

  const now = new Date();

  for (const spec of DEMO_JOB_SPECS) {
    const company = companyMap.get(spec.companyKey);
    if (!company) {
      console.warn(`[SeedDemoJobs] Company key '${spec.companyKey}' not found, skipping job: ${spec.title}`);
      skippedCount++;
      continue;
    }

    // Check exact duplicate by requisitionId or sourceUrl
    const sourceUrl = `https://evidra.dev/demo/jobs/${spec.requisitionId.toLowerCase()}`;
    const duplicateCheck = await checkExactDuplicate({
      companyId: company._id,
      requisitionId: spec.requisitionId,
      sourceUrl,
    });

    if (duplicateCheck.isDuplicate) {
      // Already exists, skip to maintain idempotency
      skippedCount++;
      continue;
    }

    // Also double check by requisitionId directly
    const existingReq = await Job.findOne({ requisitionId: spec.requisitionId });
    if (existingReq) {
      skippedCount++;
      continue;
    }

    // Resolve required and preferred skills
    const requiredSkills: Types.ObjectId[] = [];
    for (const sName of spec.requiredSkillNames) {
      const sDoc = await resolveSkill(sName);
      if (sDoc && !requiredSkills.some((id) => id.equals(sDoc._id as Types.ObjectId))) {
        requiredSkills.push(sDoc._id as Types.ObjectId);
      }
    }

    const preferredSkills: Types.ObjectId[] = [];
    for (const sName of spec.preferredSkillNames) {
      const sDoc = await resolveSkill(sName);
      if (
        sDoc &&
        !requiredSkills.some((id) => id.equals(sDoc._id as Types.ObjectId)) &&
        !preferredSkills.some((id) => id.equals(sDoc._id as Types.ObjectId))
      ) {
        preferredSkills.push(sDoc._id as Types.ObjectId);
      }
    }

    // Calculate deadline
    const deadline = new Date(now.getTime() + spec.deadlineDays * 24 * 60 * 60 * 1000);

    // Create published open job record
    await Job.create({
      company: company._id,
      title: spec.title,
      description: spec.description,
      responsibilities: spec.responsibilities,
      location: spec.location,
      workplaceType: spec.workplaceType,
      jobType: spec.jobType,
      requiredSkills,
      preferredSkills,
      minCgpa: spec.minCgpa,
      eligibleDepartments: spec.eligibleDepartments,
      eligibleGraduationYears: spec.eligibleGraduationYears,
      salaryRange: spec.salaryRange,
      status: 'open', // Published and immediately visible!
      postedBy: posterUser._id,
      sourceType: 'partner_posting',
      requisitionId: spec.requisitionId,
      sourceUrl,
      deadline,
      provenance: {
        partnerName: 'Evidra Campus Talent Network [DEMO]',
        sourceType: 'partner_posting',
        requisitionId: spec.requisitionId,
        sourceUrl,
        parserUsed: 'manual',
        ingestedAt: now,
        ingestedBy: posterUser._id,
      },
    });

    createdCount++;
  }

  const totalActiveDemoJobs = await Job.countDocuments({
    status: 'open',
    requisitionId: { $regex: /^DEMO-REQ-/ },
  });

  console.log(
    `[SeedDemoJobs] Seeding complete! Inserted: ${createdCount}, Skipped: ${skippedCount}, Total Active Demo Requisitions: ${totalActiveDemoJobs}.`
  );

  return {
    createdCount,
    skippedCount,
    totalActiveDemoJobs,
  };
};

