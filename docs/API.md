# Evidra — Complete REST API Reference

Evidra's backend exposes an authenticated, typed REST API designed for high-integrity campus recruitment, verified student evidence, deterministic matching, and truthful resume intelligence.

---

## Global Standards & Conventions

### Response Envelope
Every endpoint returns a predictable JSON envelope:

#### Successful Response (`2xx`)
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

#### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasMore": true
    }
  }
}
```

#### Operational Error Response (`4xx` / `5xx`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request payload contains validation errors",
    "details": [
      { "field": "email", "message": "Please enter a valid email address" }
    ]
  }
}
```

---

## 1. System Health & Probes

| Method | Endpoint | Access | Description |
| :----- | :------- | :----- | :---------- |
| `GET` | `/api/health` (alias `/health`) | Public | Liveness probe: returns process uptime, version, and MongoDB connection status. |
| `GET` | `/api/ready` (alias `/ready`) | Public | Readiness probe: returns `200` if database connection is active; `503` if disconnected. |
| `GET` | `/` | Public | Welcome banner and directory of available root API namespaces. |

---

## 2. Authentication & Session Management (`/api/auth`)

All authentication uses **JWTs stored inside secure HTTP-only cookies** (`SameSite: None; Secure` in production; `SameSite: Lax` in local development).

| Method | Endpoint | Access | Description |
| :----- | :------- | :----- | :---------- |
| `POST` | `/api/auth/register` | Public | Register a student account & create initial `StudentProfile`. Role is strictly forced to `student`. |
| `POST` | `/api/auth/login` | Public | Authenticates credentials and sets HTTP-only `evidra_token` cookie. |
| `POST` | `/api/auth/logout` | Public | Clears the `evidra_token` cookie. |
| `GET` | `/api/auth/me` | Authenticated | Session restoration: returns current user and linked profile/role details. |
| `GET` | `/api/auth/role-check/:role` | Authenticated | Validates that current user holds specified role (`student`, `placement_officer`, `recruiter`, `admin`). |

---

## 3. Student Profile & Evidence Vault (`/api/students` & `/api/evidence`)

### Student Endpoints (`/api/students`)

| Method | Endpoint | Access | Description |
| :----- | :------- | :----- | :---------- |
| `GET` | `/api/students/me` | Student | Retrieve own detailed student profile. |
| `PUT` | `/api/students/me` | Student | Update personal profile details (bio, links, preferred roles). |
| `GET` | `/api/students/me/skills` | Student | List verified and self-reported skills associated with student. |
| `POST` | `/api/students/me/skills` | Student | Add a skill claim to student profile. |
| `DELETE`| `/api/students/me/skills/:id` | Student | Remove a skill claim from profile. |
| `GET` | `/api/students/directory` | Placement Officer, Admin | Server-side paginated directory of all enrolled students with search & batch filters. |
| `GET` | `/api/students/:id` | Placement Officer, Admin | View deep student dossier including verified evidence, assessments, and projects. |

### Evidence Vault (`/api/evidence`)

| Method | Endpoint | Access | Description |
| :----- | :------- | :----- | :---------- |
| `GET` | `/api/evidence/my` | Student | List all uploaded evidence submissions and their verification statuses. |
| `POST` | `/api/evidence` | Student | Submit new evidence (assessment report, GitHub repository, project report, certification). |
| `GET` | `/api/evidence/pending` | Placement Officer, Admin | Review queue of unverified evidence items. |
| `POST` | `/api/evidence/:id/review` | Placement Officer, Admin | Record approval (`verified`) or rejection with structured feedback. |

---

## 4. Skills & Canonical Dictionary (`/api/skills`)

| Method | Endpoint | Access | Description |
| :----- | :------- | :----- | :---------- |
| `GET` | `/api/skills` | Public / Authenticated | Search or list canonical skills in Evidra's normalized dictionary. |
| `POST` | `/api/skills` | Placement Officer, Admin | Register a new canonical skill definition with aliases and category. |

---

## 5. Job Management, Ingestion & Deduplication (`/api/jobs`)

| Method | Endpoint | Access | Description |
| :----- | :------- | :----- | :---------- |
| `GET` | `/api/jobs` | Public / All | Browse jobs. Students see published `open` jobs; Recruiters see company jobs; Officers see all. |
| `GET` | `/api/jobs/:id` | Public / All | Get detailed job opening including required/preferred skills, company, and provenance. |
| `POST` | `/api/jobs` | Placement Officer, Recruiter, Admin | Create a new job opening. Recruiters are restricted to authorized companies. |
| `PUT` | `/api/jobs/:id` | Placement Officer, Recruiter, Admin | Update existing job posting details and criteria. |
| `PATCH`| `/api/jobs/:id/archive` | Placement Officer, Recruiter, Admin | Archive a job posting, removing it from active discovery. |
| `POST` | `/api/jobs/parse` | Placement Officer, Recruiter, Admin | Parse raw JD text into structured JSON fields (skills, CGPA, location, package). |
| `POST` | `/api/jobs/import/csv` | Placement Officer, Admin | Ingest RFC 4180 CSV job file with row-level validation and deduplication. |
| `GET` | `/api/jobs/:id/duplicates` | Placement Officer, Admin | Query similarity-based duplicate suggestions ($\ge 0.65$ score) for a posting. |
| `POST` | `/api/jobs/merge` | Placement Officer, Admin | Merge duplicate posting into primary job, preserving provenance trail. |
| `GET` | `/api/jobs/sources` | Authenticated | List all registered job source channels. |
| `POST` | `/api/jobs/sources` | Placement Officer, Admin | Create a new job source channel. |

---

## 6. Deterministic Matching Engine (`/api/matching`)

| Method | Endpoint | Access | Description |
| :----- | :------- | :----- | :---------- |
| `GET` | `/api/matching/jobs/:jobId/rank` | Placement Officer, Recruiter, Admin | Run batch matching for a job and return ranked candidate list with fit scores and skill gaps. |
| `GET` | `/api/matching/jobs/:jobId/export/csv` | Placement Officer, Recruiter, Admin | Export batch rankings to downloadable RFC 4180 CSV file. |
| `GET` | `/api/matching/jobs/:jobId/students/:studentId` | Placement Officer, Recruiter, Admin | Deep match analysis explaining evidence breakdown for every required skill. |
| `GET` | `/api/matching/jobs/:jobId/my-fit` | Student | Inspect personal fit score, missing skills, and eligibility for a published job. |

---

## 7. Truthful Resume Generator & Validator (`/api/resumes`)

| Method | Endpoint | Access | Description |
| :----- | :------- | :----- | :---------- |
| `GET` | `/api/resumes/me` | Student | Retrieve all versioned resumes generated or uploaded by authenticated student. |
| `POST` | `/api/resumes/generate` | Student | Generate a truthful, 1-page ATS-friendly resume tailored to a target job with evidence provenance. |
| `GET` | `/api/resumes/:id` | Student, Placement Officer, Recruiter | Retrieve resume metadata, formatted sections, and bullets. |
| `GET` | `/api/resumes/:id/pdf` | Student, Placement Officer, Recruiter | Download or stream selectable-text ATS resume PDF document. |
| `GET` | `/api/resumes/:id/provenance` | Student, Placement Officer, Recruiter | Fetch verifiable evidence provenance for every factual bullet in the resume. |
| `POST` | `/api/resumes/upload-and-analyze` | Student | Upload an external PDF resume to extract and audit claims against student's evidence vault. |
| `GET` | `/api/resumes/claims` | Placement Officer, Admin | Review queue of unverified or flagged resume claims. |
| `POST` | `/api/resumes/claims/:id/verify` | Placement Officer, Admin | Approve or reject a flagged resume claim. |
| `PATCH`| `/api/resumes/claims/:id` | Student | Correct or edit an extracted claim. |
| `POST` | `/api/resumes/claims/:id/link-evidence` | Student | Associate supporting evidence ID to an unverified claim. |
| `DELETE`| `/api/resumes/claims/:id` | Student | Delete an extracted resume claim. |
| `DELETE`| `/api/resumes/:id` | Student, Admin | Soft-delete a versioned resume record. |

---

## 8. Application Tracking & Status Workflow (`/api/applications`)

| Method | Endpoint | Access | Description |
| :----- | :------- | :----- | :---------- |
| `GET` | `/api/applications/my` | Student | List applications submitted by authenticated student with live status badges. |
| `POST` | `/api/applications` | Student | Submit an application for an active job with chosen resume version. |
| `GET` | `/api/applications/job/:jobId` | Placement Officer, Recruiter, Admin | List all applications for a job opening with candidate details. |
| `PATCH`| `/api/applications/:id/status` | Placement Officer, Recruiter, Admin | Advance application through authoritative backend status state machine. |
| `GET` | `/api/applications/:id/history` | Placement Officer, Recruiter, Admin | View full audit trail of status transitions for an application. |

---

## 9. Placement Officer Command & Governance (`/api/officer`)

| Method | Endpoint | Access | Description |
| :----- | :------- | :----- | :---------- |
| `GET` | `/api/officer/dashboard` | Placement Officer, Admin | Aggregate metrics: placement rate, active openings, pending reviews, drive stats. |
| `GET` | `/api/officer/analytics` | Placement Officer, Admin | Batch-wise and department-wise placement analytics, salary distributions, conversion rates. |
| `GET` | `/api/officer/audit-logs` | Placement Officer, Admin | System-wide audit logs tracking compliance and permissioned mutations. |
| `GET` | `/api/officer/settings` | Placement Officer, Admin | Retrieve institutional placement settings and matching weights. |
| `PUT` | `/api/officer/settings` | Placement Officer, Admin | Update institutional placement rules and eligibility policies. |

