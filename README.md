# Evidra — AI-Powered Placement Intelligence Platform

Every skill. Proven.

Evidra is an institutional placement intelligence platform designed to eliminate resume embellishment, provide explainable evidence-based matching, and empower students, placement officers, and enterprise recruiters with truthful talent intelligence.

---

## Documentation Navigation

- 🚀 **[Production Deployment Guide](docs/DEPLOYMENT.md)** — Step-by-step instructions for Vercel, Render, and MongoDB Atlas.
- 📡 **[REST API Reference](docs/API.md)** — Exhaustive documentation of all endpoints, parameters, and response schemas.
- 🏗️ **[System Architecture](docs/ARCHITECTURE.md)** — Architecture topology, sequence diagrams, ERD, and security clearance matrix.
- 🎯 **[Evaluation & Demo Guide](docs/DEMO_GUIDE.md)** — End-to-end evaluation journeys for Students, Placement Officers, and Recruiters.

---

## Tech Stack

| Domain | Technologies |
| :----- | :----------- |
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query |
| **Backend** | Node.js, Express, TypeScript, Zod, Rate Limiter, Helmet, PDFKit, pdf-parse |
| **Database** | MongoDB Atlas / Local MongoDB, Mongoose ODM |
| **Authentication** | JWT stored in secure HTTP-only cookies (`SameSite: None; Secure` in production) |
| **Deployment** | Vercel (Frontend SPA) & Render (Backend API Service) |
| **Tooling** | ESLint, Prettier, Concurrently, tsx, Vitest, Supertest |

---

## Monorepo Architecture

```
evidra/
├── client/                     # Frontend Single Page Application (React 19 + Vite)
│   ├── public/                 # Static assets & icons
│   ├── src/                    # React + TypeScript components & pages
│   │   ├── components/         # Design system (ui/, layout/)
│   │   ├── context/            # AuthContext, ToastContext
│   │   ├── lib/                # api.ts, queryClient.ts, utils.ts
│   │   ├── pages/              # student/, officer/, recruiter/, public/
│   │   ├── App.tsx             # Route definitions & guards
│   │   └── main.tsx            # React root mount
│   ├── package.json            # Client dependencies
│   ├── tsconfig.json           # Client TypeScript configuration
│   └── vercel.json             # Vercel deployment & SPA rewrites
├── server/                     # Backend REST API Service (Node.js + Express)
│   ├── src/
│   │   ├── config/             # DB, environment & cookie configuration
│   │   ├── controllers/        # Route handlers
│   │   ├── middleware/         # Auth, RBAC, error, rate limiting, validation
│   │   ├── models/             # Mongoose schemas & domain models
│   │   ├── routes/             # Express API routers
│   │   ├── utils/              # PDF generator, claim auditor, matching engine, seed
│   │   ├── validators/         # Zod schemas
│   │   ├── app.ts              # Express application factory
│   │   └── index.ts            # Server entrypoint & graceful shutdown
│   ├── test/                   # Vitest integration test suite (120+ tests)
│   ├── package.json            # Server dependencies
│   └── tsconfig.json           # Server TypeScript configuration
├── docs/                       # Comprehensive documentation
│   ├── DEPLOYMENT.md           # Production deployment guide
│   ├── API.md                  # REST API reference
│   ├── ARCHITECTURE.md         # System architecture & diagrams
│   └── DEMO_GUIDE.md           # End-to-end evaluation & demo journeys
├── render.yaml                 # Render Blueprint specification
├── vercel.json                 # Root Vercel project configuration
├── .env.example                # Unified root environment variables
├── package.json                # Root workspace configuration
└── README.md                   # Project overview & quickstart
```

---

## Prerequisites

- **Node.js**: `v20.x` or higher (tested with `v24.x`)
- **npm**: `v10.x` or higher (tested with `v11.x`)
- **MongoDB**: Active MongoDB Atlas cluster URI or local MongoDB instance (`mongodb://localhost:27017/evidra`)

---

## Quickstart & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

**Key Server Environment Variables (`server/.env`):**
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/evidra
JWT_SECRET=super_secret_development_jwt_key_min_32_characters_long
JWT_EXPIRES_IN=7d
COOKIE_NAME=evidra_token
SEED_DEMO_USERS=true
DEMO_USER_PASSWORD=EvidraDemo123!
```

### 3. Seed Demo Dataset
```bash
npm run seed --workspace=server
```

### 4. Start Development Servers
```bash
# Starts both frontend (http://localhost:5173) and backend (http://localhost:5000)
npm run dev
```

---

## Demo Accounts

All pre-configured demo accounts share the password: `EvidraDemo123!`

| Role | Email | Password | Scope & Mission |
| :--- | :---- | :------- | :-------------- |
| **Student** | `student@evidra.dev` | `EvidraDemo123!` | Explore jobs, build truthful ATS resumes, audit PDF claims, track applications. |
| **Placement Officer** | `officer@evidra.dev` | `EvidraDemo123!` | Command center: review evidence deliverables, batch match candidates, manage jobs. |
| **Recruiter** | `recruiter@evidra.dev` | `EvidraDemo123!` | Post requisitions, inspect candidate evidence provenance, manage shortlists. |
| **Platform Admin** | `admin@evidra.dev` | `EvidraDemo123!` | System governance, global audit logs, institutional settings. |

---

## Core Pillars & Innovations

### 1. Evidra Resume — Truthful Resume Generator
- **Zero Hallucination Guarantee**: Resumes are synthesized strictly from verified evidence deliverables and evaluated projects.
- **Evidence Provenance Traceability**: Every factual statement generated in a resume bullet points to verified `evidenceIds` and `skillIds`.
- **Selectable-Text ATS Output**: Generates clean, standard typography rendered via PDFKit with selectable text rather than rasterized images.
- **Exclusion Transparency**: Any unsupported skill or claim is omitted and listed under `excludedItems` with an honest rationale.

### 2. Uploaded Resume Claim Auditor
- **PDF Text Stream Extraction**: Accepts uploaded resume PDFs or pasted text and securely parses raw content.
- **Evidence Cross-Referencing**: Audits claims against the student's verified evidence vault.
- **Four-Tier Classification**: Classifies claims into `SUPPORTED`, `NEEDS_REVIEW`, `UNSUPPORTED`, or `CONTRADICTED`.
- **Officer Review Workflow**: Enables students to reconcile claims by submitting supporting proof or requesting officer verification.

### 3. Explainable Evidence-Based Matching Engine
$$\text{Fit Score} = 100 \times \frac{\sum (w_i \times e_i)}{\sum w_i}$$
- Evaluates verified evidence artifacts (assessments, repositories, projects, certifications) rather than self-reported assertions.
- Evaluates academic cut-offs (CGPA, department, graduation year) strictly independently from skill fit scores.
- Implements a 6-tier deterministic tie-breaking hierarchy guaranteeing 100% reproducible rankings.

---

## Development Scripts

| Command | Description |
| :------ | :---------- |
| `npm run dev` | Runs backend and frontend concurrently in watch mode. |
| `npm run dev:server` | Starts Express backend in watch mode via `tsx` on `http://localhost:5000`. |
| `npm run dev:client` | Starts Vite dev server on `http://localhost:5173`. |
| `npm test` | Runs the entire backend test suite via Vitest. |
| `npm run seed --workspace=server` | Seeds comprehensive demo dataset for all roles. |
| `npm run build` | Compiles both backend (`tsc`) and frontend (`vite build`). |
| `npm run build:server` | Compiles TypeScript backend into `server/dist`. |
| `npm run build:client` | Compiles Vite frontend into `client/dist`. |
| `npm run start` | Runs compiled backend server (`node server/dist/index.js`). |
| `npm run typecheck` | Runs TypeScript type checking across client and server. |
| `npm run lint` | Runs ESLint across the entire monorepo. |
| `npm run format:check` | Verifies code formatting via Prettier. |

---

## Health & Readiness Verification

### Backend Liveness Probe (`GET /api/health` or `/health`)
```bash
curl http://localhost:5000/api/health
```

Expected response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 45,
    "service": "evidra-api",
    "version": "0.1.0",
    "environment": "development",
    "database": "connected"
  },
  "message": "Service is healthy"
}
```

### Backend Readiness Probe (`GET /api/ready` or `/ready`)
```bash
curl http://localhost:5000/api/ready
```
Returns `200 OK` when the database connection is active, or `503 Service Unavailable` if database connectivity is down.

---

## License

MIT © Evidra Team
