# Evidra — End-to-End Evaluation & Demo Guide

This guide walks evaluators and hackathon judges through key user journeys across Evidra's three primary roles: **Student**, **Placement Officer**, and **Recruiter**.

---

## Demo Credentials & Roles

All demo accounts share the standard password: `EvidraDemo123!`

| Role | Email | Password | Primary Mission |
| :--- | :---- | :------- | :-------------- |
| **Student** | `student@evidra.dev` | `EvidraDemo123!` | Build truthful resumes, submit evidence, analyze external resumes, track applications. |
| **Placement Officer** | `officer@evidra.dev` | `EvidraDemo123!` | Review evidence, batch-rank students for job drives, review unverified claims, track analytics. |
| **Recruiter** | `recruiter@evidra.dev` | `EvidraDemo123!` | Manage requisitions, evaluate shortlisted candidates, inspect evidence, advance applicants. |
| **Platform Admin** | `admin@evidra.dev` | `EvidraDemo123!` | System configuration, audit logs, compliance policies. |

> [!TIP]
> On the `/login` page, you can click any of the **Quick Demo Accounts** buttons to instantly autofill the credentials.

---

## Journey 1: Student — Truthful Resume Generation & Provenance

### Objectives:
Demonstrate how Evidra generates ATS-friendly resumes backed by verified database evidence, eliminating resume embellishment.

1. **Log in** as `student@evidra.dev` / `EvidraDemo123!`.
2. Navigate to **Resumes** (`/student/resumes`).
3. Select a target job opening from the dropdown (e.g., *Frontend Developer Intern* or *Backend Engineer*).
4. Click **Generate Truthful Resume**:
   - Notice the generation statistics: total bullet points generated, supported bullets, and verified skills linked.
   - Inspect the generated sections (Summary, Technical Skills, Verified Projects, Evaluated Assessments).
   - Click on the **Evidence Provenance Pills** attached to each factual bullet to see the exact verified evidence artifact ID and score backing that statement.
   - Expand the **Excluded Items** alert: observe which skills were omitted because the student lacks verified proof, along with clear reasons why they were excluded.
5. Click **Download ATS PDF**:
   - An authenticated PDF is generated and streamed with selectable, high-resolution text formatted specifically for ATS parsers.

---

## Journey 2: Student — Uploaded Resume Claim Auditor

### Objectives:
Demonstrate automated extraction and verification of claims from an external PDF resume against the student's evidence vault.

1. Navigate to **Resume Analysis** (`/student/resume-analysis`).
2. Upload a PDF resume or click **Paste Sample Resume Text**:
   - The sample text includes a mix of verified claims (e.g., React, TypeScript), partially supported claims, and unverified claims (e.g., Kubernetes, AWS Solutions Architect).
3. Click **Analyze Resume Claims**:
   - The system extracts individual factual assertions across Skills, Projects, and Certifications.
   - Each claim is audited and tagged:
     - 🟢 **SUPPORTED**: Backed by reviewed assessment or project in student's vault.
     - 🟡 **NEEDS_REVIEW**: Partially supported or awaiting officer sign-off.
     - ⚪ **UNSUPPORTED**: Self-reported claim with no evidence on record.
     - 🔴 **CONTRADICTED**: Claim directly conflicts with verified records (e.g., claimed 95% on assessment where official record shows 62%).
4. Click **Flag for Officer Review** or link an evidence submission to reconcile an unverified claim.

---

## Journey 3: Placement Officer — Evidence Review & Batch Ranking

### Objectives:
Demonstrate institutional governance, fraud prevention, and deterministic candidate matching.

1. **Log in** as `officer@evidra.dev` / `EvidraDemo123!`.
2. Navigate to **Dashboard** (`/officer/dashboard`):
   - Review live metrics populated from backend APIs: Active Postings, Registered Students, Verified Deliverables, and Pending Audits.
3. Navigate to **Evidence Review** (`/officer/evidence-reviews`):
   - Inspect student deliverables submitted for review (GitHub URLs, coding assessments, project reports).
   - Click **Approve** or **Reject** with feedback. Approvals instantly increase that student's proficiency weighting in the matching engine.
4. Navigate to **Batch Ranking** (`/officer/matching`):
   - Select a job opening (e.g., *Frontend Developer Intern*).
   - Select target graduation batch (e.g., `2025` or `2026`).
   - Click **Run Batch Matching**:
     - View ranked candidate table sorted strictly by deterministic tie-breaking rules.
     - Notice the **Fit Score** percentage, **Eligibility Status** (`MET` vs `NOT_MET`), and explicit **Skill Gaps** list for every candidate.
     - Click **Export CSV** to download the complete rankings list as an RFC 4180 CSV file.
5. Navigate to **Resume Claims** (`/officer/resume-claims`):
   - Review claims flagged by students from uploaded resumes and mark them verified or dismissed.

---

## Journey 4: Recruiter — Shortlist & Candidate Evaluation

### Objectives:
Demonstrate company-scoped candidate management and authorized applicant review.

1. **Log in** as `recruiter@evidra.dev` / `EvidraDemo123!`.
2. Navigate to **Recruiter Dashboard** (`/recruiter/dashboard`):
   - View assigned company requisitions and applicant counts.
3. Click on a requisition to view the **Applicant Shortlist**:
   - Inspect candidate fit scores and match breakdowns.
   - Review student resumes and evidence deliverables.
4. Update an applicant's stage in the pipeline (e.g., advance from `Shortlisted` to `Technical Interview`).
5. Verify that recruiters cannot view jobs or applicants outside their authorized company.

---

## Smoke Test Verification Checklist

| Test Item | Expected Result | Verified |
| :-------- | :-------------- | :------- |
| `GET /api/health` | Returns `200 OK` with `status: "ok"` and `database: "connected"`. | [ ] |
| `GET /api/ready` | Returns `200 OK` when MongoDB is reachable. | [ ] |
| Register Student | Issues `Set-Cookie` with `HttpOnly; SameSite=None; Secure`. | [ ] |
| Login Student | Redirects to `/student/dashboard` with active session. | [ ] |
| Generate Resume | Returns versioned resume with bullet provenance IDs and excluded items. | [ ] |
| Download PDF | Streams selectable-text PDF (`Content-Type: application/pdf`). | [ ] |
| Officer Dashboard | Loads real aggregate counts from `/api/officer/dashboard`. | [ ] |
| Batch Ranking | Ranks candidates with explainable scores and exportable CSV. | [ ] |
| Deduplication | Rejects exact duplicate postings with `409 Conflict`. | [ ] |

