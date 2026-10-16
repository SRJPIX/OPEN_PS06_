# Evidra — AI-Powered Placement Intelligence Platform

Evidra is an AI-powered placement intelligence platform designed to bridge students, recruiters, and placement officers with intelligent matching, resume intelligence, and real-time placement analytics.

---

## Tech Stack

| Domain             | Technologies                                            |
| :----------------- | :------------------------------------------------------ |
| **Frontend**       | React 19, Vite, TypeScript, Tailwind CSS                |
| **Backend**        | Node.js, Express, TypeScript, Zod, Rate Limiter, Helmet |
| **Database**       | MongoDB Atlas, Mongoose ODM                             |
| **Authentication** | JWT stored in secure HTTP-only cookies, bcryptjs        |
| **Deployment**     | Vercel (Frontend SPA) & Render (Backend API Service)    |
| **Tooling**        | ESLint, Prettier, Concurrently, tsx, Vitest, Supertest  |

---

## Monorepo Architecture

```
evidra/
├── client/                     # Frontend Single Page Application
│   ├── public/                 # Static assets & favicon
│   ├── src/                    # React + TypeScript components & styles
│   │   ├── App.tsx             # Main application & health check dashboard
│   │   ├── main.tsx            # React root mount
│   │   └── index.css           # Tailwind CSS imports & base styles
│   ├── index.html              # HTML shell
│   ├── package.json            # Client dependencies & scripts
│   ├── tsconfig.json           # Client TypeScript configuration
│   ├── vercel.json             # Vercel deployment rewrites
│   ├── vite.config.ts          # Vite configuration with proxy
│   └── .env.example            # Client environment template
├── server/                     # Backend REST API Service
│   ├── src/
│   │   ├── config/             # DB, environment & cookie configuration
│   │   │   ├── cookie.ts       # Secure HTTP-only cookie configuration
│   │   │   ├── db.ts           # MongoDB connection lifecycle & readiness
│   │   │   └── env.ts          # Zod startup environment validation
│   │   ├── controllers/        # Route controllers
│   │   │   └── auth.controller.ts # Registration, login, logout, session restoration
│   │   ├── middleware/         # Express middlewares
│   │   │   ├── auth.middleware.ts # JWT authentication & role-based guards
│   │   │   ├── error.middleware.ts # Centralised error & 404 handlers
│   │   │   ├── rateLimiter.ts  # General and auth rate limiting
│   │   │   └── validate.middleware.ts # Zod request body validation
│   │   ├── models/             # Mongoose Domain Models
│   │   │   ├── User.ts         # User auth & role accounts
│   │   │   ├── StudentProfile.ts # Student academic identity & links
│   │   │   ├── Company.ts      # Recruiter company entities
│   │   │   ├── Skill.ts        # Canonical skill dictionary
│   │   │   ├── StudentSkill.ts # Student-to-skill junction & proficiency
│   │   │   ├── Evidence.ts     # Verifiable proof artifacts
│   │   │   ├── Project.ts      # Student portfolio projects
│   │   │   ├── Assessment.ts   # Skill assessments & scores
│   │   │   ├── Job.ts          # Placement job listings
│   │   │   ├── JobSource.ts    # Placement drives & referral channels
│   │   │   ├── Resume.ts       # Student resumes & versions
│   │   │   ├── ResumeClaim.ts  # Verified claims extracted on resumes
│   │   │   ├── Application.ts  # Student job applications
│   │   │   ├── ApplicationStatusHistory.ts # Application status audit trail
│   │   │   ├── AuditLog.ts     # System-wide compliance & security log
│   │   │   └── index.ts        # Models barrel exporter
│   │   ├── routes/             # Express API routes
│   │   │   ├── auth.routes.ts  # Authentication & role verification endpoints
│   │   │   └── health.routes.ts # Health (liveness) & ready (readiness) routes
│   │   ├── scripts/            # CLI utilities
│   │   │   └── seed.ts         # Development demo accounts seeder
│   │   ├── utils/              # API helpers
│   │   │   ├── apiError.ts     # Operational ApiError class
│   │   │   ├── apiResponse.ts  # Standardised JSON response envelope
│   │   │   ├── password.ts     # Bcrypt password hashing & comparison
│   │   │   ├── seed.ts         # Demo user seeding logic
│   │   │   └── token.ts        # JWT token generation & verification
│   │   ├── validators/         # Zod request validators
│   │   │   └── auth.validator.ts # Register and login schemas
│   │   ├── app.ts              # Express application factory & middleware
│   │   └── index.ts            # Server entrypoint & graceful shutdown
│   ├── test/                   # Vitest & Supertest test suite
│   │   ├── auth.test.ts        # Authentication & RBAC integration tests
│   │   ├── db.test.ts          # DB connection lifecycle tests
│   │   ├── env.test.ts         # Environment validation tests
│   │   ├── error.test.ts       # Centralised error handling tests
│   │   ├── health.test.ts      # Health & readiness probe tests
│   │   └── models.test.ts      # Mongoose models schema & enum tests
│   ├── package.json            # Server dependencies & scripts
│   ├── tsconfig.json           # Server TypeScript configuration
│   └── .env.example            # Server environment template
├── .env.example                # Unified root environment variables
├── .gitignore                  # Git ignore rules for monorepo
├── .prettierrc                 # Code formatting rules
├── .prettierignore             # Prettier ignore targets
├── eslint.config.mjs           # Unified ESLint configuration
├── package.json                # Root package configuration & workspaces
└── README.md                   # Project documentation
```

---

## Prerequisites

Ensure the following tools are installed on your machine:

- **Node.js**: `v20.x` or higher (tested with `v24.x`)
- **npm**: `v10.x` or higher (tested with `v11.x`)
- **MongoDB**: An active MongoDB Atlas cluster URI or local MongoDB instance (tested with `mongodb://localhost:27017/evidra`)

---

## Getting Started

### 1. Clone & Install Dependencies

From the repository root, install dependencies for all workspaces with a single command:

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env` files from their respective `.env.example` templates:

```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

**Key Environment Variables (`server/.env`):**

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/evidra?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_EXPIRES_IN=7d
COOKIE_NAME=evidra_token

# Development-Only Demo Seeding (Disabled in production)
SEED_DEMO_USERS=false
DEMO_USER_PASSWORD=EvidraDemo123!
```

---

## Development Scripts

| Command                           | Description                                                               |
| :-------------------------------- | :------------------------------------------------------------------------ |
| `npm run dev`                     | Runs both backend and frontend concurrently                               |
| `npm run dev:server`              | Starts Express backend in watch mode via `tsx` on `http://localhost:5000` |
| `npm run dev:client`              | Starts Vite dev server on `http://localhost:5173`                         |
| `npm test`                        | Runs backend test suite via Vitest                                        |
| `npm run seed --workspace=server` | Seeds development demo accounts (Student, Recruiter, Officer, Admin)      |
| `npm run build`                   | Compiles both backend (`tsc`) and frontend (`vite build`)                 |
| `npm run build:server`            | Compiles TypeScript backend into `server/dist`                            |
| `npm run build:client`            | Compiles Vite frontend into `client/dist`                                 |
| `npm run start`                   | Runs the compiled backend server (`node server/dist/index.js`)            |
| `npm run lint`                    | Runs ESLint across the entire monorepo                                    |
| `npm run format`                  | Formats all code with Prettier                                            |
| `npm run format:check`            | Verifies code formatting with Prettier                                    |
| `npm run typecheck`               | Runs TypeScript type checking for client and server                       |

---

## Authentication & Authorization API

All authentication uses **JWTs stored in secure HTTP-only cookies** (`SameSite: Lax` in development, `SameSite: None; Secure` in production for cross-site Vercel <-> Render deployments). Tokens are never exposed to JavaScript or stored in `localStorage`.

### Endpoints

| Method | Endpoint                                 | Access            | Description                                                                   |
| :----- | :--------------------------------------- | :---------------- | :---------------------------------------------------------------------------- |
| `POST` | `/api/auth/register`                     | Public            | Registers a new student account & profile (role strictly forced to `student`) |
| `POST` | `/api/auth/login`                        | Public            | Authenticates credentials and issues secure HTTP-only cookie                  |
| `POST` | `/api/auth/logout`                       | Public            | Clears authentication cookie                                                  |
| `GET`  | `/api/auth/me`                           | Authenticated     | Session restoration: returns current user and linked profile                  |
| `GET`  | `/api/auth/role-check/student`           | Student           | Verifies student role access                                                  |
| `GET`  | `/api/auth/role-check/placement-officer` | Placement Officer | Verifies placement officer role access                                        |
| `GET`  | `/api/auth/role-check/recruiter`         | Recruiter         | Verifies recruiter role access                                                |

### Demo Accounts for Development

When running locally, you can populate demo accounts via:

```bash
npm run seed --workspace=server
```

| Role                  | Email                  | Password         |
| :-------------------- | :--------------------- | :--------------- |
| **Student**           | `student@evidra.dev`   | `EvidraDemo123!` |
| **Recruiter**         | `recruiter@evidra.dev` | `EvidraDemo123!` |
| **Placement Officer** | `officer@evidra.dev`   | `EvidraDemo123!` |
| **Admin**             | `admin@evidra.dev`     | `EvidraDemo123!` |

> **Security Note**: The seed mechanism is strictly forbidden in production mode (`NODE_ENV=production`) and is not exposed as a public HTTP endpoint.

---

## Health & Readiness Verification

### Backend Liveness Probe (`GET /api/health`)

Verifies that the Express API process is running:

```bash
curl http://localhost:5000/api/health
```

Expected response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-10-16T12:23:41.581Z",
    "uptime": 12,
    "service": "evidra-api",
    "version": "0.1.0",
    "environment": "development",
    "database": "connected"
  },
  "message": "Service is healthy"
}
```

### Backend Readiness Probe (`GET /api/ready`)

Verifies that dependencies (MongoDB) are ready to accept traffic:

```bash
curl http://localhost:5000/api/ready
```

---

## Deployment Architecture

### Frontend (Vercel)

- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_URL`: Your Render backend production URL (e.g., `https://evidra-api.onrender.com`)
- The included `client/vercel.json` ensures all client-side routes route correctly to `index.html`.

### Backend (Render)

- **Root Directory**: `server` (or repository root with build command)
- **Environment**: Node
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**:
  - `PORT`: `5000` (or provided dynamically by Render)
  - `NODE_ENV`: `production`
  - `CLIENT_URL`: Your Vercel frontend URL (e.g., `https://evidra.vercel.app`)
  - `MONGODB_URI`: Your MongoDB Atlas production connection URI
  - `JWT_SECRET`: Secure cryptographic secret (32+ characters)
  - `COOKIE_NAME`: `evidra_token`

---

## Job Management & Ingestion System

Evidra supports end-to-end job ingestion, structured parsing, RFC 4180 CSV batch importing, exact and similarity duplicate detection, and source provenance tracking.

### API Endpoints

| Method  | Endpoint                   | Allowed Roles                             | Description                                                                                     |
| ------- | -------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET`   | `/api/jobs`                | Public / All                              | Browse jobs (Students see published `open` jobs; Recruiters see company jobs; Officers see all) |
| `GET`   | `/api/jobs/:id`            | Public / All                              | View detailed job listing with populated skills, company and source                             |
| `POST`  | `/api/jobs`                | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Create job listing (recruiters restricted to authorized companies)                              |
| `PUT`   | `/api/jobs/:id`            | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Edit job listing                                                                                |
| `PATCH` | `/api/jobs/:id/archive`    | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Archive job listing                                                                             |
| `POST`  | `/api/jobs/parse`          | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Parse raw job description text into structured fields using deterministic rules or LLM          |
| `POST`  | `/api/jobs/import/csv`     | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Ingest CSV job postings with row-level validation and error logging                             |
| `GET`   | `/api/jobs/:id/duplicates` | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Fetch similarity-based duplicate suggestions for a posting                                      |
| `POST`  | `/api/jobs/merge`          | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Merge duplicate posting into primary job, preserving source provenance                          |
| `GET`   | `/api/jobs/sources`        | Authenticated                             | List registered job source channels                                                             |
| `POST`  | `/api/jobs/sources`        | `PLACEMENT_OFFICER`, `ADMIN`              | Register new job source channel                                                                 |

---

### Accepted CSV Job Import Format

The CSV importer supports RFC 4180 format (quoted fields, commas, escaped quotes, multiline descriptions). Both raw CSV content (`Content-Type: text/csv`) and JSON payloads (`{ "csvContent": "..." }`) are supported at `POST /api/jobs/import/csv`.

#### Column Headers & Supported Aliases

| Header                    | Supported Aliases                   | Required | Type / Values                                                                           | Description & Example                                                          |
| ------------------------- | ----------------------------------- | -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `title`                   | `job_title`, `position`, `role`     | **Yes**  | String                                                                                  | Job title (e.g., `"Senior Backend Engineer"`)                                  |
| `company`                 | `company_name`, `organization`      | **Yes**  | String / ObjectId                                                                       | Company name or ID (e.g., `"Google"`, `"Evidra Partner Labs"`)                 |
| `description`             | `job_description`, `details`        | **Yes**  | String                                                                                  | Full job description text (multiline supported in quotes)                      |
| `location`                | `city`, `work_location`             | No       | String (Default: `"Remote"`)                                                            | Work city or location (e.g., `"Bengaluru"`, `"Remote"`)                        |
| `workplaceType`           | `work_mode`, `workmode`             | No       | `remote`, `hybrid`, `on_site`                                                           | Workplace mode (Default: `"on_site"`)                                          |
| `jobType`                 | `job_type`, `type`                  | No       | `full_time`, `internship`, `part_time`, `contract`                                      | Job contract type (Default: `"full_time"`)                                     |
| `requisitionId`           | `requisition_id`, `req_id`, `reqid` | No       | String                                                                                  | Unique requisition ID for exact duplicate tracking (e.g., `"REQ-2026-042"`)    |
| `sourceUrl`               | `source_url`, `url`, `link`         | No       | URL String                                                                              | Canonical posting URL for exact duplicate tracking                             |
| `sourceType`              | `source_type`, `source`             | No       | `partner_posting`, `alumni_referral`, `manual_submission`, `api_source`, `campus_drive` | Provenance source category                                                     |
| `requiredSkills`          | `required_skills`, `skills`         | No       | Comma-separated Strings                                                                 | Skills mapped to canonical dictionary (e.g., `"ReactJS, Node.js, TypeScript"`) |
| `preferredSkills`         | `preferred_skills`                  | No       | Comma-separated Strings                                                                 | Preferred skills (e.g., `"Docker, AWS, Kubernetes"`)                           |
| `minCgpa`                 | `min_cgpa`, `cgpa`                  | No       | Number (0.0 to 10.0)                                                                    | Minimum CGPA cut-off requirement (e.g., `7.5`)                                 |
| `eligibleDepartments`     | `departments`, `branches`           | No       | Comma-separated Strings                                                                 | Branches eligible (e.g., `"CSE, IT, ECE"`)                                     |
| `eligibleGraduationYears` | `graduation_years`, `years`         | No       | Comma-separated Integers                                                                | Eligible graduating batches (e.g., `"2025, 2026"`)                             |
| `salaryMin`               | `salary_min`, `min_salary`          | No       | Number                                                                                  | Minimum base compensation in currency                                          |
| `salaryMax`               | `salary_max`, `max_salary`          | No       | Number                                                                                  | Maximum base compensation in currency                                          |
| `salaryCurrency`          | `salary_currency`, `currency`       | No       | String (Default: `"INR"`)                                                               | Currency code (e.g., `"INR"`, `"USD"`)                                         |
| `deadline`                | `apply_by`, `last_date`             | No       | Date (`YYYY-MM-DD`)                                                                     | Application deadline date                                                      |

#### Example CSV Payload

```csv
title,company,description,location,workplaceType,jobType,requisitionId,sourceUrl,requiredSkills,preferredSkills,minCgpa,eligibleGraduationYears,deadline
"Backend Engineer","Alpha Labs","Develop microservices in TypeScript and Node.js","Bengaluru","hybrid","full_time","REQ-001","https://alpha.dev/careers/1","NodeJS, TypeScript, Express","Docker, Redis",7.5,"2025, 2026","2026-12-31"
"Frontend Developer","Beta Corp","Build responsive dashboards with React","Remote","remote","internship","REQ-002","https://beta.dev/jobs/2","ReactJS, Tailwind CSS","Git",8.0,"2026","2026-11-30"
```

---

### Deduplication & Provenance Rules

1. **Exact Duplicate Detection**:
   - Matches identical `requisitionId` within the same company, or identical canonical `sourceUrl`.
   - Returns `409 Conflict` on single creation; rejects row with exact duplicate note in CSV import.
2. **Distinct Requisitions Safeguard**:
   - Two jobs with distinct requisition IDs (e.g., `REQ-001` vs `REQ-002`) are **never** flagged as exact duplicates or automatically merged, even if their job titles and descriptions match.
3. **Similarity Suggestions**:
   - Evaluates weighted token similarity across company, normalized title, location, and description text. Suggests candidate postings when score $\ge 0.65$.
4. **Source Provenance & Merge Tracking**:
   - Merging duplicate postings archives the duplicate, unions distinct skill requirements, and preserves full source audit trail inside `primaryJob.provenance.mergedFrom`.

---

## Explainable Evidence-Based Matching Engine

Evidra implements a transparent, deterministic matching engine operating directly on verified database records.

### Mathematical Scoring Formula

$$\text{Fit Score} = 100 \times \frac{\sum (w_i \times e_i)}{\sum w_i}$$

Where:

- $w_i$ is the skill importance weight:
  - Required skills: $w_i = 3$ (configurable)
  - Preferred skills: $w_i = 1$ (configurable)
- $e_i \in [0, 1]$ is the verified evidence match value for skill $i$.

### Evidence Contribution & Anti-Fraud Tiers

| Evidence Type                          | Verification Condition              | Proficiency Contribution ($p$)            |
| -------------------------------------- | ----------------------------------- | ----------------------------------------- |
| **Coding Assessment**                  | Score $\ge 85\%$ (Officer Reviewed) | $1.00$ (High demonstrated proficiency)    |
| **Coding Assessment**                  | Score $70\% - 84\%$                 | $0.85$                                    |
| **Coding Assessment**                  | Score $50\% - 69\%$                 | $0.65$                                    |
| **Coding Assessment**                  | Passed without numerical score      | $0.80$                                    |
| **Evaluated Project**                  | Score $\ge 80\%$ (Officer Reviewed) | $0.90$                                    |
| **Evaluated Project**                  | Score $60\% - 79\%$                 | $0.75$                                    |
| **Evaluated Project**                  | Passed without numerical score      | $0.75$                                    |
| **Technical Quiz**                     | Score ratio (Officer Reviewed)      | $\min(0.85, \max(0.40, s))$               |
| **Verified Certification**             | Officer Reviewed & Verified         | $0.75$                                    |
| **GitHub Repository**                  | Officer Reviewed & Evaluated        | $0.65$ (or evaluated score ratio)         |
| **Unreviewed Evidence / Raw Repo URL** | Any unverified submission           | **$0.00$** (Strictly excluded)            |
| **Self-Reported Skill Claim**          | Without reviewed proof              | **$0.00$** (Flagged as Unsupported Claim) |

- **Multi-Evidence Aggregation**: Multiple distinct items for a single skill combine with diminishing returns: $e_i = \min(1.0, p_1 + 0.25 p_2 + 0.1 p_3)$.
- **Anti-Duplication**: Duplicate submissions sharing identical URLs or IDs are deduplicated to prevent score inflation.

### Academic Eligibility Invariants

Eligibility criteria (CGPA, graduation year, department) are evaluated **strictly independently** from skill fit scores:

- `MET`: All mandatory job criteria satisfied.
- `NOT_MET`: One or more mandatory criteria failed (e.g. CGPA below minimum).
- `UNKNOWN`: Required student record missing.

> [!IMPORTANT]
> **Core Invariant**: A high skill fit score **never** overrides a failed mandatory criterion. Candidates failing mandatory criteria are classified as `NOT_MET`.

### Deterministic Tie-Breaking Order

1. **Eligibility Status**: `MET` > `UNKNOWN` > `NOT_MET`
2. **Fit Score**: Higher score first
3. **Supported Required Skills Count**: More verified required skills first
4. **Total Supported Skills Count**: More verified total skills first
5. **Academic CGPA**: Higher CGPA first
6. **Student Profile ID**: Lexicographical tie-breaker guaranteeing 100% deterministic, immutable ranking order.

### Matching API Endpoints

| Method | Endpoint                                        | Allowed Roles                             | Description                                                   |
| ------ | ----------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `GET`  | `/api/matching/jobs/:jobId/rank`                | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Batch-rank candidates with explanations, gaps and filters     |
| `GET`  | `/api/matching/jobs/:jobId/export/csv`          | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Export batch rankings to downloadable RFC 4180 CSV            |
| `GET`  | `/api/matching/jobs/:jobId/students/:studentId` | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Detailed candidate match analysis with evidence links         |
| `GET`  | `/api/matching/jobs/:jobId/my-fit`              | `STUDENT`                                 | Authenticated student inspects personal fit for published job |

---

## Job Management & Ingestion System

Evidra supports end-to-end job ingestion, structured parsing, RFC 4180 CSV batch importing, exact and similarity duplicate detection, and source provenance tracking.

### API Endpoints

| Method  | Endpoint                   | Allowed Roles                             | Description                                                                                     |
| ------- | -------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET`   | `/api/jobs`                | Public / All                              | Browse jobs (Students see published `open` jobs; Recruiters see company jobs; Officers see all) |
| `GET`   | `/api/jobs/:id`            | Public / All                              | View detailed job listing with populated skills, company and source                             |
| `POST`  | `/api/jobs`                | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Create job listing (recruiters restricted to authorized companies)                              |
| `PUT`   | `/api/jobs/:id`            | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Edit job listing                                                                                |
| `PATCH` | `/api/jobs/:id/archive`    | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Archive job listing                                                                             |
| `POST`  | `/api/jobs/parse`          | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Parse raw job description text into structured fields using deterministic rules or LLM          |
| `POST`  | `/api/jobs/import/csv`     | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Ingest CSV job postings with row-level validation and error logging                             |
| `GET`   | `/api/jobs/:id/duplicates` | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Fetch similarity-based duplicate suggestions for a posting                                      |
| `POST`  | `/api/jobs/merge`          | `PLACEMENT_OFFICER`, `RECRUITER`, `ADMIN` | Merge duplicate posting into primary job, preserving source provenance                          |
| `GET`   | `/api/jobs/sources`        | Authenticated                             | List registered job source channels                                                             |
| `POST`  | `/api/jobs/sources`        | `PLACEMENT_OFFICER`, `ADMIN`              | Register new job source channel                                                                 |

---

### Accepted CSV Job Import Format

The CSV importer supports RFC 4180 format (quoted fields, commas, escaped quotes, multiline descriptions). Both raw CSV content (`Content-Type: text/csv`) and JSON payloads (`{ "csvContent": "..." }`) are supported at `POST /api/jobs/import/csv`.

#### Column Headers & Supported Aliases

| Header                    | Supported Aliases                   | Required | Type / Values                                                                           | Description & Example                                                          |
| ------------------------- | ----------------------------------- | -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `title`                   | `job_title`, `position`, `role`     | **Yes**  | String                                                                                  | Job title (e.g., `"Senior Backend Engineer"`)                                  |
| `company`                 | `company_name`, `organization`      | **Yes**  | String / ObjectId                                                                       | Company name or ID (e.g., `"Google"`, `"Evidra Partner Labs"`)                 |
| `description`             | `job_description`, `details`        | **Yes**  | String                                                                                  | Full job description text (multiline supported in quotes)                      |
| `location`                | `city`, `work_location`             | No       | String (Default: `"Remote"`)                                                            | Work city or location (e.g., `"Bengaluru"`, `"Remote"`)                        |
| `workplaceType`           | `work_mode`, `workmode`             | No       | `remote`, `hybrid`, `on_site`                                                           | Workplace mode (Default: `"on_site"`)                                          |
| `jobType`                 | `job_type`, `type`                  | No       | `full_time`, `internship`, `part_time`, `contract`                                      | Job contract type (Default: `"full_time"`)                                     |
| `requisitionId`           | `requisition_id`, `req_id`, `reqid` | No       | String                                                                                  | Unique requisition ID for exact duplicate tracking (e.g., `"REQ-2026-042"`)    |
| `sourceUrl`               | `source_url`, `url`, `link`         | No       | URL String                                                                              | Canonical posting URL for exact duplicate tracking                             |
| `sourceType`              | `source_type`, `source`             | No       | `partner_posting`, `alumni_referral`, `manual_submission`, `api_source`, `campus_drive` | Provenance source category                                                     |
| `requiredSkills`          | `required_skills`, `skills`         | No       | Comma-separated Strings                                                                 | Skills mapped to canonical dictionary (e.g., `"ReactJS, Node.js, TypeScript"`) |
| `preferredSkills`         | `preferred_skills`                  | No       | Comma-separated Strings                                                                 | Preferred skills (e.g., `"Docker, AWS, Kubernetes"`)                           |
| `minCgpa`                 | `min_cgpa`, `cgpa`                  | No       | Number (0.0 to 10.0)                                                                    | Minimum CGPA cut-off requirement (e.g., `7.5`)                                 |
| `eligibleDepartments`     | `departments`, `branches`           | No       | Comma-separated Strings                                                                 | Branches eligible (e.g., `"CSE, IT, ECE"`)                                     |
| `eligibleGraduationYears` | `graduation_years`, `years`         | No       | Comma-separated Integers                                                                | Eligible graduating batches (e.g., `"2025, 2026"`)                             |
| `salaryMin`               | `salary_min`, `min_salary`          | No       | Number                                                                                  | Minimum base compensation in currency                                          |
| `salaryMax`               | `salary_max`, `max_salary`          | No       | Number                                                                                  | Maximum base compensation in currency                                          |
| `salaryCurrency`          | `salary_currency`, `currency`       | No       | String (Default: `"INR"`)                                                               | Currency code (e.g., `"INR"`, `"USD"`)                                         |
| `deadline`                | `apply_by`, `last_date`             | No       | Date (`YYYY-MM-DD`)                                                                     | Application deadline date                                                      |

#### Example CSV Payload

```csv
title,company,description,location,workplaceType,jobType,requisitionId,sourceUrl,requiredSkills,preferredSkills,minCgpa,eligibleGraduationYears,deadline
"Backend Engineer","Alpha Labs","Develop microservices in TypeScript and Node.js","Bengaluru","hybrid","full_time","REQ-001","https://alpha.dev/careers/1","NodeJS, TypeScript, Express","Docker, Redis",7.5,"2025, 2026","2026-12-31"
"Frontend Developer","Beta Corp","Build responsive dashboards with React","Remote","remote","internship","REQ-002","https://beta.dev/jobs/2","ReactJS, Tailwind CSS","Git",8.0,"2026","2026-11-30"
```

---

### Deduplication & Provenance Rules

1. **Exact Duplicate Detection**:
   - Matches identical `requisitionId` within the same company, or identical canonical `sourceUrl`.
   - Returns `409 Conflict` on single creation; rejects row with exact duplicate note in CSV import.
2. **Distinct Requisitions Safeguard**:
   - Two jobs with distinct requisition IDs (e.g., `REQ-001` vs `REQ-002`) are **never** flagged as exact duplicates or automatically merged, even if their job titles and descriptions match.
3. **Similarity Suggestions**:
   - Evaluates weighted token similarity across company, normalized title, location, and description text. Suggests candidate postings when score $\ge 0.65$.
4. **Source Provenance & Merge Tracking**:
   - Merging duplicate postings archives the duplicate, unions distinct skill requirements, and preserves full source audit trail inside `primaryJob.provenance.mergedFrom`.
