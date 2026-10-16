# Evidra Backend API Service

The backend REST API service for the Evidra AI-Powered Placement Intelligence Platform, built with Node.js, Express, TypeScript, and Mongoose for MongoDB Atlas.

## Features

- **Express & TypeScript**: Type-safe REST API server.
- **MongoDB Atlas & Mongoose**: Object modeling and persistent storage integration.
- **JWT Authentication Architecture**: Ready for secure HTTP-only cookie-based authentication.
- **Security Middlewares**: Helmet headers, CORS with credential handling, and cookie parsing.
- **Health Verification**: Detailed system uptime and DB state reported at `GET /api/health`.
- **Render Deployment**: Zero-friction deployment ready with Node environment and standard start scripts.

## Scripts

- `npm run dev` - Start development server with live reload via `tsx watch`
- `npm run build` - Compile TypeScript to `dist/`
- `npm run start` - Run compiled server (`node dist/index.js`)
- `npm run typecheck` - Validate TypeScript typings
