# Evidra — End-to-End Functionality Audit & Verification Matrix

**Audit Date:** October 17, 2026  
**Auditor:** DeepMind Antigravity Agentic Assistant  
**Repository:** `c:\Users\patel\OneDrive\Desktop\evidra`  
**Git Branch:** `main` (Preserving all uncommitted changes)  
**Database:** MongoDB (`mongodb://localhost:27017/evidra`)  
**Status:** 225 Automated Tests Passing (15/15 test files)

---

## 1. Executive Summary

This comprehensive audit evaluates the Evidra platform across all user roles: **Student**, **Placement Officer**, **Recruiter**, and **Platform Admin**. Evidra is an institutional placement intelligence system with verifiable credentials, ATS resume generation, deterministic job matching, and duplicate job reconciliation.

Overall, the core architecture is well-structured with strong TypeScript safety, robust Mongoose schemas, and comprehensive role-based access control. However, several critical integration gaps, schema mismatches, and seed dataset deficiencies were identified that impair the end-user demonstration and operational workflows.

---

## 2. Functionality Matrix

### Classification Legend:
- 🟢 **Working and verified**: Fully functional, backed by MongoDB persistence and verified via tests/endpoints.
- 🟡 **Partially working**: Functional, but missing complete data, secondary capabilities, or edge-case handling.
- 🔴 **Broken**: UI or API exists, but fails with runtime, schema, or route errors.
- ⚪ **UI exists but backend missing**: Frontend component rendered, but API endpoint does not exist.
- 🔘 **Cannot verify**: Missing credentials, external service keys, or third-party environment variables.

---

### Category A: Public Landing & Authentication

| Feature / Action | Component / Route | Classification | Notes & Details |
| :--------------- | :---------------- | :------------- | :-------------- |
| Public Landing Page | `client/src/pages/LandingPage.tsx` | 🟢 Working and verified | Responsive hero, pillars, role showcase, and demo credential pills. |
| Student Public Registration | `POST /api/auth/register` | 🟢 Working and verified | Public registration strictly forces `role: 'student'`; prevents privilege escalation. |
| Role-Aware Login | `POST /api/auth/login` | 🟢 Working and verified | Issues HTTP-only JWT cookies; redirects users to their role-specific dashboard. |
| Session Me Endpoint | `GET /api/auth/me` | 🟢 Working and verified | Restores authenticated session and user profile on page reloads. |
| Logout & Cookie Clearance | `POST /api/auth/logout` | 🟢 Working and verified | Clears authentication cookie and resets client state. |
| Admin Account Provisioning | `POST /api/auth/users` | 🟢 Working and verified | Allows admins/officers to securely provision recruiter and officer accounts with linked companies. |
| Password Change | `PUT /api/auth/password` | 🟢 Working and verified | Verifies existing password before hashing and updating new credentials. |

---

### Category B: Student Experience

| Feature / Action | Component / Route | Classification | Notes & Details |
| :--------------- | :---------------- | :------------- | :-------------- |
| Student Dashboard Statistics | `client/src/pages/student/StudentDashboard.tsx`<br>`GET /api/students/dashboard/stats` | 🟢 Working and verified | Fetches live database metrics for available jobs, applications, interviews, offers, and skills. |
| Profile & Academics | `client/src/pages/student/ProfilePage.tsx`<br>`GET /api/students/profile/me`<br>`PUT /api/students/profile/me` | 🟢 Working and verified | Profile viewing and updates for CGPA, department, graduation year, links, and education entries. |
| Skills & Evidence Vault | `client/src/pages/student/SkillsPage.tsx`<br>`GET /api/students/profile/me`<br>`POST /api/students/skills`<br>`POST /api/evidence` | 🟡 Partially working | Add skills and submit evidence works. However, demo student had 0 initial skills seeded in `safeSeed.ts`. |
| Proctored Assessments | `client/src/pages/student/AssessmentProjectEvidencePage.tsx`<br>`GET /api/students/assessments`<br>`POST /api/students/assessments` | 🟡 Partially working | API endpoints work and auto-generate linked evidence. Empty state shown because demo student had 0 initial assessments. |
| Evaluated Projects | `client/src/pages/student/AssessmentProjectEvidencePage.tsx`<br>`GET /api/students/projects`<br>`POST /api/students/projects` | 🟡 Partially working | API endpoints work and auto-generate linked evidence. Empty state shown because demo student had 0 initial projects. |
| Job Discovery & Filters | `client/src/pages/student/JobDiscoveryPage.tsx`<br>`GET /api/jobs?limit=50` | 🟢 Working and verified | 32 published demo jobs across India with filtering by title, department, location, and workplace mode. |
| Job Details & Fit Explanation | `client/src/pages/student/JobDetailsPage.tsx`<br>`GET /api/jobs/:id`<br>`GET /api/matching/jobs/:jobId/my-fit` | 🟢 Working and verified | Displays job specifics, deterministic fit score (0–100), supported skills, gaps, and academic eligibility. |
| Apply with Approved Resume | `client/src/pages/student/JobDetailsPage.tsx`<br>`POST /api/applications` | 🟢 Working and verified | Enforces application only via generated/approved resume versions; rejects duplicates. |
| ATS Tailored Resume Builder | `client/src/pages/student/ResumeBuilderPage.tsx`<br>`POST /api/resumes/generate`<br>`GET /api/resumes/me`<br>`GET /api/resumes/:id/pdf` | 🟢 Working and verified | Synthesizes truthful ATS resumes from verified evidence; generates selectable-text PDFs via PDFKit. |
| Uploaded Resume PDF Audit | `client/src/pages/student/UploadedResumeAnalysisPage.tsx`<br>`POST /api/resumes/upload-and-analyze` | 🟢 Working and verified | Parses PDF text stream with pdf-parse and classifies claims into SUPPORTED / NEEDS_REVIEW / UNSUPPORTED. |
| Claim Evidence Linking | `client/src/pages/student/UploadedResumeAnalysisPage.tsx`<br>`GET /api/evidence/me` | 🔴 Broken | Calling `/evidence/me` matches `GET /api/evidence/:id` with `id='me'`, causing Mongoose CastError. |
| Application Status Tracking | `client/src/pages/student/ApplicationsPage.tsx`<br>`GET /api/applications/me` | 🟢 Working and verified | Shows real database applications, stage badges, and chronological history timeline. |
| Application Withdrawal | `client/src/pages/student/ApplicationsPage.tsx`<br>`PATCH /api/applications/:id/withdraw` | 🟢 Working and verified | Student can safely withdraw an active application with optional audit reason. |
| Interview Prep Blueprint | `client/src/pages/student/InterviewPrepPage.tsx`<br>`GET /api/matching/jobs/:jobId/interview-prep` | 🟢 Working and verified | Generates targeted technical interview questions based on matched strengths and missing gaps. |
| Question Bank & Experiences | `client/src/pages/student/InterviewPrepPage.tsx`<br>`GET /api/interviews/questions`<br>`GET /api/interviews/experiences` | 🟡 Partially working | Endpoints work, but `interviewreports` collection has 0 seeded records; question bank is empty. |
| Alumni Directory & Referrals | `client/src/pages/student/AlumniDirectoryPage.tsx`<br>`GET /api/alumni`<br>`POST /api/alumni/:id/request-referral` | 🟡 Partially working | Working endpoints, but only 1 alumni record exists in database. |
| Account & Security Settings | `client/src/pages/student/SettingsPage.tsx`<br>`PUT /api/auth/password` | 🟢 Working and verified | Allows password updates and authenticated logout. |

---

### Category C: Placement Officer Experience

| Feature / Action | Component / Route | Classification | Notes & Details |
| :--------------- | :---------------- | :------------- | :-------------- |
| Placement Dashboard | `client/src/pages/officer/PlacementDashboard.tsx`<br>`GET /api/officer/dashboard/stats` | 🟢 Working and verified | Live aggregate counts for jobs, students, pending evidence, and placement conversion rates. |
| Student Directory | `client/src/pages/officer/StudentDirectoryPage.tsx`<br>`GET /api/students` | 🟢 Working and verified | Paginated student list with CGPA, batch, department filters, and verified skill counts. |
| Student Detailed Profile | `client/src/pages/officer/StudentDetailsPage.tsx`<br>`GET /api/students/:id` | 🟢 Working and verified | Comprehensive student view: skills, evidence, projects, assessments, and applications. |
| Evidence Evaluation Queue | `client/src/pages/officer/EvidenceReviewPage.tsx`<br>`GET /api/evidence/reviews/pending`<br>`POST /api/evidence/:id/review` | 🟢 Working and verified | Faculty review queue: approve, reject, or request additional proof with score and feedback notes. |
| Job Requisitions Management | `client/src/pages/officer/JobManagementPage.tsx`<br>`GET /api/jobs`<br>`PATCH /api/jobs/:id/archive` | 🟢 Working and verified | Search, status filtering, and job archiving across all companies. |
| Manual Job Creation & Edit | `client/src/pages/officer/JobCreateEditPage.tsx`<br>`POST /api/jobs`<br>`PUT /api/jobs/:id` | 🟢 Working and verified | Create and update requisitions with auto-company resolution and canonical skill mapping. |
| Raw JD Description Parser | `client/src/pages/officer/JobCreateEditPage.tsx`<br>`POST /api/jobs/parse` | 🟢 Working and verified | Deterministic parser with canonical dictionary extraction and optional LLM provider fallback. |
| CSV Job Ingestion | `client/src/pages/officer/CsvJobImportPage.tsx`<br>`POST /api/jobs/import/csv` | 🟢 Working and verified | Bulk CSV ingestion with row-level error reporting and duplicate rejection. |
| Duplicate Requisitions Review | `client/src/pages/officer/DuplicateReviewPage.tsx`<br>`GET /api/jobs/duplicates/all`<br>`POST /api/jobs/merge` | 🟢 Working and verified | Similarity-based duplicate detection and source-preserving job merging. |
| Batch Ranking Engine | `client/src/pages/officer/BatchRankingPage.tsx`<br>`GET /api/matching/jobs/:jobId/rank`<br>`GET /api/matching/jobs/:jobId/export/csv` | 🟢 Working and verified | Deterministic scoring formula: $100 \times \frac{\sum w_i e_i}{\sum w_i}$, eligibility evaluation, tie-breaking, and CSV export. |
| Resume Claims Audit Queue | `client/src/pages/officer/ResumeClaimReviewPage.tsx`<br>`GET /api/resumes/claims`<br>`POST /api/resumes/claims/:id/verify` | 🟢 Working and verified | Audit queue for unverified resume claims from uploaded PDFs. |
| Application Pipeline Tracking | `client/src/pages/officer/ApplicationPipelinePage.tsx`<br>`GET /api/applications`<br>`GET /api/applications/:id` | 🟢 Working and verified | Lists applications with stage filtering and chronological history timeline modal. |
| Application Status Transition | `client/src/pages/officer/ApplicationPipelinePage.tsx`<br>`PATCH /api/applications/:id/status` | 🔴 Broken | Contract mismatch: UI sends `{ toStatus, notes }`, but backend validator requires `{ status }`, failing with 400. |
| Placement Analytics | `client/src/pages/officer/PlacementAnalyticsPage.tsx`<br>`GET /api/officer/analytics` | 🟢 Working and verified | Live conversion funnels, department placement metrics, and industry skill demand gaps. |
| Audit History Log | `client/src/pages/officer/AuditHistoryPage.tsx`<br>`GET /api/officer/audit-logs` | 🟢 Working and verified | Paginated institutional audit log with action filtering and JSON inspector modal. |
| Policy & Settings | `client/src/pages/officer/OfficerSettingsPage.tsx`<br>`GET /api/officer/settings`<br>`PUT /api/officer/settings` | 🟢 Working and verified | Institutional configuration for scoring weights, SLA days, and admin account provisioning. |

---

### Category D: Recruiter Suite

| Feature / Action | Component / Route | Classification | Notes & Details |
| :--------------- | :---------------- | :------------- | :-------------- |
| Recruiter Hub Overview | `client/src/pages/recruiter/RecruiterDashboard.tsx`<br>`GET /api/recruiter/company`<br>`GET /api/recruiter/jobs` | 🟢 Working and verified | Authorized company overview, active job stats, and application counts. |
| Job Requisitions | `client/src/pages/recruiter/RecruiterDashboard.tsx`<br>`POST /api/jobs` | 🟢 Working and verified | Post new job requisitions for authorized company; strictly scoped to prevent unauthorized postings. |
| Candidate Shortlist | `client/src/pages/recruiter/RecruiterDashboard.tsx`<br>`GET /api/recruiter/candidates?jobId=...` | 🟢 Working and verified | Candidate shortlist showing match fit scores, eligibility status, and supported vs missing skills. |
| Candidate Evidence Provenance | `client/src/pages/recruiter/RecruiterDashboard.tsx`<br>`GET /api/evidence?studentId=...` | 🟢 Working and verified | View candidate's submitted projects, code repositories, assessments, and evidence status. |
| Candidate Skill Verification | `client/src/pages/recruiter/RecruiterDashboard.tsx`<br>`POST /api/evidence/:id/review` | 🟢 Working and verified | Recruiter can review submitted evidence and verify or reject candidate skills with audit notes. |
| Interview Scheduling | `client/src/pages/recruiter/RecruiterDashboard.tsx`<br>`PATCH /api/applications/:id/interview` | 🟢 Working and verified | Schedule interview round, meeting link, timestamp, and feedback. |
| Candidate Status Transition | `client/src/pages/recruiter/RecruiterDashboard.tsx`<br>`PATCH /api/applications/:id/status` | 🟢 Working and verified | Recruiter can advance application through permitted transitions (`APPLIED` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `INTERVIEW` $\rightarrow$ `OFFER`). |

---

## 3. Confirmed Failures & Root Causes (Ordered by Severity)

### Issue 1: Broken Evidence Link Endpoint in Uploaded Resume Analysis (High Severity)
- **Component**: `client/src/pages/student/UploadedResumeAnalysisPage.tsx#L69`
- **Request**: `GET /api/evidence/me`
- **Backend Route**: `server/src/routes/evidence.routes.ts`
- **Root Cause**: The backend router does not register a `/me` alias for `getMyEvidence`. Express matches the dynamic parameter route `GET /api/evidence/:id` with `id = 'me'`. When Mongoose executes `Evidence.findById('me')`, it throws a `CastError: Cast to ObjectId failed for value "me"`.
- **Effect**: When a student audits an external resume and attempts to link evidence to an unverified claim, the modal fails to load their evidence artifacts.
- **Smallest Safe Fix**:
  1. In `server/src/routes/evidence.routes.ts`, register `router.get(['/', '/me'], getMyEvidence)` before the `/:id` route.
  2. In `client/src/pages/student/UploadedResumeAnalysisPage.tsx`, update the query to `/evidence` or `/evidence/me`.

---

### Issue 2: Contract Mismatch in Officer Application Status Transitions (High Severity)
- **Component**: `client/src/pages/officer/ApplicationPipelinePage.tsx#L100`
- **Request**: `PATCH /api/applications/:id/status`
- **Backend Validator**: `server/src/validators/application.validator.ts#L54`
- **Root Cause**: `ApplicationPipelinePage.tsx` transmits `{ toStatus, notes }`, but the backend validator `updateApplicationStatusSchema` expects `{ status, notes }`. Zod rejects the payload with `VALIDATION_ERROR: status is required`.
- **Effect**: Placement officers receive a "Transition Disallowed: Invalid state transition" error toast when attempting to move an applicant to another stage in the pipeline.
- **Smallest Safe Fix**:
  1. In `server/src/validators/application.validator.ts`, update `updateApplicationStatusSchema` to accept either `status` or `toStatus`, normalizing both to `status`.
  2. In `client/src/pages/officer/ApplicationPipelinePage.tsx`, transmit `{ status: toStatus, toStatus, notes }`.

---

### Issue 3: Missing Demo Student Seed Data (Skills, Evidence, Assessments, Projects) (High Severity)
- **Component**: `server/src/utils/safeSeed.ts`
- **Root Cause**: `safeSeed.ts` only generates evidence for students who already possess `StudentSkill` records in MongoDB. Because `student@evidra.dev` had 0 initial skills, the loop was skipped, leaving the demo student with 0 skills, 0 evidence artifacts, 0 assessments, and 0 evaluated projects.
- **Effect**:
  - Logging in as `student@evidra.dev` exhibits an empty Skills & Evidence Vault.
  - Assessments & Projects page shows empty states.
  - Fit scores evaluate to 0% across all 32 demo job requisitions.
  - Resume Builder cannot synthesize evidence-backed bullets.
  - Recruiter candidate shortlist shows 0 fit score and 0 skills for the student.
- **Smallest Safe Fix**:
  1. In `server/src/utils/safeSeed.ts`, add an idempotent check ensuring `student@evidra.dev` has a standard verified & submitted skill portfolio (React, Node.js, TypeScript, JavaScript, MongoDB, Python), proctored assessments, and evaluated projects.

---

### Issue 4: Empty Question Bank & Interview Experiences in Repository Mode (Medium Severity)
- **Component**: `client/src/pages/student/InterviewPrepPage.tsx`
- **Request**: `GET /api/interviews/questions`, `GET /api/interviews/experiences`
- **Root Cause**: The `interviewreports` collection in MongoDB contains 0 documents. Although `seed.ts` contains seed logic, `safeSeed.ts` omitted interview report population.
- **Effect**: Switching to the "Company Question Bank & Experiences" repository view displays an empty state with zero available questions and interview reports.
- **Smallest Safe Fix**:
  1. In `server/src/utils/safeSeed.ts`, seed realistic `InterviewReport` documents across top tech employers (Google, Microsoft, Amazon, NexusTech) with interview rounds, questions, and outcomes.

---

### Issue 5: Sparse Alumni Directory (Low Severity)
- **Component**: `client/src/pages/student/AlumniDirectoryPage.tsx`
- **Request**: `GET /api/alumni`
- **Root Cause**: Only 1 alumni document was seeded.
- **Effect**: Filtering by department, graduation year, or company returns no results.
- **Smallest Safe Fix**:
  1. In `server/src/utils/safeSeed.ts`, seed 8–10 realistic verified alumni profiles across multiple engineering branches.

---

## 4. Verification & Testing History

- **Backend Test Suite**: 15 Vitest test suites, 225 individual test cases passing (100%).
- **TypeScript Static Analysis**: `npm run typecheck` passes with zero errors across both `client` and `server`.
- **Database Idempotency**: Verified multiple runs of `npm run seed` and `npm run seed:jobs` with zero duplicate records created.
- **Direct API Probing**: Verified `GET /api/jobs`, `GET /api/matching/jobs/:id/interview-prep`, `GET /api/officer/dashboard/stats`, `GET /api/recruiter/company`, and `POST /api/auth/login`.

---

## 5. Next Steps

Immediately proceed to Phase 5: Implement isolated, safe fixes for the top three critical issues:
1. Fix `/evidence/me` endpoint in backend route and frontend client.
2. Fix contract mismatch for application status transitions (`toStatus` vs `status`).
3. Enhance `safeSeed.ts` to idempotently seed the demo student's skills, assessments, projects, evidence, and interview reports.

