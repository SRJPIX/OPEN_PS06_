# Evidra — AI-Powered Placement Intelligence Platform

Evidra is an AI-powered placement intelligence platform designed to bridge students, recruiters, and placement officers with intelligent matching, resume intelligence, and real-time placement analytics.

---

## Tech Stack

| Domain             | Technologies                                            |
| :----------------- | :------------------------------------------------------ |
| **Frontend**       | React 19, Vite, TypeScript, Tailwind CSS                |
| **Backend**        | Node.js, Express, TypeScript, Zod, Rate Limiter, Helmet |
| **Database**       | MongoDB Atlas, Mongoose ODM                             |
| **Authentication** | JWT stored in secure HTTP-only cookies                  |
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
│   │   ├── config/             # DB & environment configuration
│   │   │   ├── db.ts           # MongoDB connection lifecycle & readiness
│   │   │   └── env.ts          # Zod startup environment validation
│   │   ├── middleware/         # Express middlewares
│   │   │   ├── error.middleware.ts # Centralised error & 404 handlers
│   │   │   └── rateLimiter.ts  # Express rate limiting
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
│   │   │   └── health.routes.ts # Health (liveness) & ready (readiness) routes
│   │   ├── utils/              # API helpers
│   │   │   ├── apiError.ts     # Operational ApiError class
│   │   │   └── apiResponse.ts  # Standardised JSON response envelope
│   │   ├── app.ts              # Express application factory & middleware
│   │   └── index.ts            # Server entrypoint & graceful shutdown
│   ├── test/                   # Vitest & Supertest test suite
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
```

**Key Environment Variables (`client/.env`):**

```env
VITE_API_URL=http://localhost:5000
```

> **Note**: For initial health check testing, MongoDB credentials are not mandatory. If `MONGODB_URI` is omitted or unconfigured, the server logs an informative warning and operates in offline mode without crashing.

---

## Development Scripts

| Command                | Description                                                               |
| :--------------------- | :------------------------------------------------------------------------ |
| `npm run dev`          | Runs both backend and frontend concurrently                               |
| `npm run dev:server`   | Starts Express backend in watch mode via `tsx` on `http://localhost:5000` |
| `npm run dev:client`   | Starts Vite dev server on `http://localhost:5173`                         |
| `npm test`             | Runs backend test suite via Vitest                                        |
| `npm run build`        | Compiles both backend (`tsc`) and frontend (`vite build`)                 |
| `npm run build:server` | Compiles TypeScript backend into `server/dist`                            |
| `npm run build:client` | Compiles Vite frontend into `client/dist`                                 |
| `npm run start`        | Runs the compiled backend server (`node server/dist/index.js`)            |
| `npm run lint`         | Runs ESLint across the entire monorepo                                    |
| `npm run format`       | Formats all code with Prettier                                            |
| `npm run format:check` | Verifies code formatting with Prettier                                    |
| `npm run typecheck`    | Runs TypeScript type checking for client and server                       |

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

- When MongoDB is connected (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "ready": true,
      "checks": {
        "database": "connected"
      }
    },
    "message": "Service is ready to receive traffic"
  }
  ```
- When MongoDB is disconnected (`503 Service Unavailable`):
  ```json
  {
    "success": false,
    "error": {
      "code": "SERVICE_NOT_READY",
      "message": "Service is not ready to receive traffic: database is not connected",
      "details": {
        "ready": false,
        "checks": {
          "database": "disconnected"
        }
      }
    }
  }
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
