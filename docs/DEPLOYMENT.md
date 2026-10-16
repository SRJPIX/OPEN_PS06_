# Evidra — Production Deployment Guide

This document provides exhaustive, step-by-step instructions for deploying Evidra to production using **Vercel** (Frontend SPA), **Render** (Backend API), and **MongoDB Atlas** (Managed Database).

---

## Architecture Topology

```
┌────────────────────────────────────────────────────────┐
│                   End-User Browser                     │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       HTTPS Requests            API Requests with
       (Static Assets)          HTTP-only Cookies
                │                        │
                ▼                        ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│       Vercel Edge         │  │     Render Web Service    │
│  (Frontend React 19 SPA)  │  │   (Node.js Express API)   │
│   https://evidra.app      │  │  https://api.evidra.app    │
└───────────────────────────┘  └─────────────┬─────────────┘
                                             │
                                   TLS MongoDB Connection
                                    (mongodb+srv://...)
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │       MongoDB Atlas       │
                               │   (M0/M10 Database Cluster│
                               │       Multi-Region)       │
                               └───────────────────────────┘
```

---

## 1. MongoDB Atlas Configuration

Evidra requires MongoDB 6.0+ with replica set support (standard on Atlas) for transactional integrity and index operations.

### Step 1.1: Create an Atlas Cluster
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Click **Create** to deploy a new database:
   - **Tier**: M0 Free Tier (evaluation) or M10 Dedicated (production).
   - **Cloud Provider & Region**: Choose a region near your Render API service (e.g., `AWS / us-east-1` or `Frankfurt`).
   - **Cluster Name**: `evidra-prod`.

### Step 1.2: Configure Network Access (IP Whitelist)
Because Render web services use dynamic IP pools without dedicated static IPs (unless using Render's Static Outbound IP add-on), Atlas must allow traffic from any IP:
1. In the left navigation, navigate to **Security** → **Network Access**.
2. Click **Add IP Address**.
3. Choose **Allow Access from Anywhere** (`0.0.0.0/0`).
4. Set an entry comment such as `Render Web Service DynIP`.
5. Click **Confirm**.

> [!TIP]
> If your organization requires static IP whitelisting, configure a Render Private Service or subscribe to Render's Static Outbound IP feature, then whitelist those specific `/32` CIDRs in Atlas.

### Step 1.3: Create Database User
1. Navigate to **Security** → **Database Access**.
2. Click **Add New Database User**.
3. Authentication Method: **Password**.
4. Set Username: `evidra_app_user`.
5. Generate or provide a cryptographically secure password (save this safely).
6. Under **Database User Privileges**, select **Built-in Role** → **Read and write to any database** (or restrict to database `evidra`).
7. Click **Add User**.

### Step 1.4: Obtain Connection String
1. Navigate to **Deployment** → **Database** → **Clusters**.
2. Click **Connect** next to `evidra-prod`.
3. Choose **Drivers** (Node.js, version 5.5 or later).
4. Copy the connection string format:
   ```
   mongodb+srv://evidra_app_user:<password>@evidra-prod.xxxx.mongodb.net/evidra?retryWrites=true&w=majority
   ```
5. Replace `<password>` with the password created in Step 1.3 and `<cluster>` with your cluster host.

---

## 2. Backend Deployment on Render

Evidra's backend is a production-hardened Node.js/Express service containerized or run directly with Node.js on Render.

### Option A: Automatic Blueprint Deployment (`render.yaml`)
1. Fork or push the Evidra repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New** → **Blueprint**.
3. Select the Evidra repository.
4. Render automatically detects the root `render.yaml` file:
   - **Service Name**: `evidra-api`
   - **Plan**: `starter` (or `free`)
   - **Build Command**: `npm run build:server`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/api/health`
5. Fill in the required secret environment variables prompted by the Blueprint:
   - `MONGODB_URI`: Your MongoDB Atlas URI.
   - `JWT_SECRET`: Random 64-character hex string (e.g. `openssl rand -hex 32`).
   - `CLIENT_URL`: The production URL of your frontend (e.g., `https://evidra.vercel.app`).

### Option B: Manual Web Service Setup
1. In the Render Dashboard, click **New** → **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `evidra-api`
   - **Region**: Choose closest to your MongoDB Atlas cluster (e.g., `Ohio (US East)` or `Frankfurt (EU Central)`).
   - **Branch**: `main`
   - **Root Directory**: Leave blank (monorepo root).
   - **Runtime**: `Node`
   - **Build Command**: `npm run build:server`
   - **Start Command**: `npm run start`
   - **Instance Type**: `Starter` ($7/mo) or `Free`
4. Expand **Advanced**:
   - **Health Check Path**: `/api/health`
   - **Auto-Deploy**: `Yes`
5. Add Environment Variables:

| Key | Example Production Value | Purpose |
| :-- | :----------------------- | :------ |
| `NODE_ENV` | `production` | Enables prod optimizations, disables stack trace leaks |
| `PORT` | `10000` | Render assigns dynamically; Express reads `process.env.PORT` |
| `CLIENT_URL` | `https://evidra.vercel.app` | Allowed CORS origin; comma-separated for previews |
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB Atlas cluster connection |
| `JWT_SECRET` | `4f8a...` (64 chars) | Cryptographic key for signing session tokens |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `COOKIE_NAME` | `evidra_token` | HTTP-only cookie name |
| `SEED_DEMO_USERS` | `false` | Strictly disabled in production |
| `GEMINI_API_KEY` | `AIzaSy...` | Optional: for enhanced LLM parsing fallback |

6. Click **Create Web Service**. Wait for the build and deploy log to show:
   ```
   [Evidra API] HTTP Server listening on port 10000
   [Evidra API] Liveness check: http://localhost:10000/api/health
   [Evidra API] Readiness check: http://localhost:10000/api/ready
   ```

---

## 3. Frontend Deployment on Vercel

The frontend is a Vite + React 19 Single Page Application configured for single-hop deployment on Vercel Edge.

### Step 3.1: Connect Vercel Project
1. Go to [Vercel Dashboard](https://vercel.com/) and click **Add New** → **Project**.
2. Import your Evidra Git repository.
3. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client` (or leave root if using root `vercel.json`)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Step 3.2: Configure Environment Variables in Vercel
In the **Environment Variables** section, add:

| Key | Example Production Value | Purpose |
| :-- | :----------------------- | :------ |
| `VITE_API_URL` | `https://evidra-api.onrender.com` | Base URL for Render backend REST API |

> [!IMPORTANT]
> Do NOT include a trailing slash in `VITE_API_URL`. The client API client handles appending `/api` dynamically.

### Step 3.3: Deploy & Verify SPA Rewrites
1. Click **Deploy**.
2. Vercel compiles the assets and deploys to `https://<your-project>.vercel.app`.
3. Verify client-side routing: Navigate directly to deep URLs (e.g. `/student/dashboard`, `/login`, `/officer/jobs`). Both `client/vercel.json` and root `vercel.json` rewrite non-file requests to `/index.html`, preventing 404s on browser reloads.

---

## 4. Production Security, CORS & Cookie Topology

### Cross-Domain Cookie Architecture
In production, your frontend and backend run on different domains:
- Frontend: `https://evidra.vercel.app`
- Backend: `https://evidra-api.onrender.com`

Because they are cross-site, browsers require strict cookie flags:
1. **`sameSite: 'none'`**: Allows cookies to be sent across different domains.
2. **`secure: true`**: Mandatory whenever `SameSite=None` is set. Cookies are only transmitted over TLS/HTTPS.
3. **`httpOnly: true`**: Tokens are inaccessible to JavaScript, mitigating XSS attacks.
4. **`trust proxy: 1`**: Render runs behind an SSL-terminating reverse proxy. Express must trust the proxy to recognise `req.secure === true`.

Evidra's backend handles this automatically in `server/src/config/cookie.ts` and `server/src/app.ts`:
```typescript
// server/src/config/cookie.ts
export const getCookieOptions = (isProduction = config.NODE_ENV === 'production'): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
});
```

### Multi-Origin CORS Configuration
If you utilize Vercel preview branch deployments, specify comma-separated origins in `CLIENT_URL`:
```env
CLIENT_URL=https://evidra.vercel.app,https://evidra-staging.vercel.app
```
Evidra dynamically parses comma-separated origins and also permits preview URLs matching `^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$`.

---

## 5. Health Probes & Operational Smoke Tests

After deploying, verify all subsystems using standard HTTP requests:

### Liveness Probe (`GET /api/health` or `/health`)
```bash
curl -i https://evidra-api.onrender.com/api/health
```
Expected Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 142,
    "service": "evidra-api",
    "version": "0.1.0",
    "environment": "production",
    "database": "connected"
  },
  "message": "Service is healthy"
}
```

### Readiness Probe (`GET /api/ready` or `/ready`)
```bash
curl -i https://evidra-api.onrender.com/api/ready
```
Returns `200 OK` when MongoDB connection state is active (`1`), or `503 Service Unavailable` if database is reconnecting.

### Authentication & Cookie Smoke Test
1. Register a test account:
```bash
curl -i -X POST https://evidra-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke.test@evidra.dev","password":"Password123!","fullName":"Smoke Test Student","rollNumber":"ST2026001","graduationYear":2026,"department":"CSE"}'
```
2. Verify that the response includes:
   - Status: `201 Created`
   - Header: `Set-Cookie: evidra_token=...; Path=/; HttpOnly; Secure; SameSite=None`

3. Restore session:
```bash
curl -i https://evidra-api.onrender.com/api/auth/me \
  -H "Cookie: evidra_token=<token_from_step_2>"
```
Expected Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "user": {
      "email": "smoke.test@evidra.dev",
      "role": "student"
    }
  }
}
```

---

## 6. Logging, Graceful Shutdown & Disaster Recovery

### Production Logging
- In production (`NODE_ENV=production`), Morgan outputs Apache combined log format to stdout, captured by Render's native log stream.
- Stack traces are suppressed from client responses and logged solely to stderr.

### Graceful Shutdown
When Render scales down or updates a deploy, it transmits a `SIGTERM`:
1. Express stops accepting new incoming requests (`server.close()`).
2. Active requests are allowed up to 10 seconds to finish.
3. MongoDB client terminates connection gracefully (`mongoose.disconnect()`).
4. Process exits with code `0`.

---

## 7. Environment Variables Reference

### Backend (`server/.env` / Render Dashboard)

| Variable | Type | Default | Required | Description |
| :------- | :--- | :------ | :------- | :---------- |
| `PORT` | Number | `5000` | No | Port on which the HTTP server listens. |
| `NODE_ENV` | String | `development` | Yes | `production`, `development`, or `test`. |
| `CLIENT_URL` | String | `http://localhost:5173` | Yes | Allowed frontend origin(s), comma-separated. |
| `MONGODB_URI` | String | — | Yes | MongoDB Atlas replica-set connection string. |
| `JWT_SECRET` | String | — | Yes | Cryptographic secret for signing JWTs (32+ chars). |
| `JWT_EXPIRES_IN` | String | `7d` | No | JWT validity window (e.g. `7d`, `24h`). |
| `COOKIE_NAME` | String | `evidra_token` | No | HTTP-only cookie identifier. |
| `SEED_DEMO_USERS`| Boolean | `false` | No | Automatically seeds demo dataset on boot. Strictly forbidden in production. |
| `DEMO_USER_PASSWORD` | String | `EvidraDemo123!` | No | Password assigned to seeded demo users. |
| `GEMINI_API_KEY` | String | — | No | Google Gemini API key for intelligent resume parsing. |

### Frontend (`client/.env` / Vercel Dashboard)

| Variable | Type | Default | Required | Description |
| :------- | :--- | :------ | :------- | :---------- |
| `VITE_API_URL` | String | `http://localhost:5000` | Yes | Public URL of the backend API service. |

