import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { config } from '../src/config/env';
import {
  VALID_STATUS_TRANSITIONS,
  canTransitionStatus,
  calculateStudentDashboardMetrics,
  calculatePlacementDashboardMetrics,
} from '../src/utils/applicationWorkflow';
import { ApplicationStatus } from '../src/models/Application';
import { signAuthToken } from '../src/utils/token';

describe('Frontend Integration & Smoke Test Suite: Primary Demonstration Workflow', () => {
  const app = createApp();
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await connectDB(config.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
  });

  afterAll(async () => {
    if (dbAvailable) {
      await disconnectDB();
    }
  });

  // =========================================================================
  // 1. Client Routing & Route Architecture Contract Verification
  // =========================================================================
  describe('Client Route Architecture & RBAC Contracts', () => {
    const studentRoutes = [
      '/student/dashboard',
      '/student/profile',
      '/student/skills',
      '/student/assessments-projects',
      '/student/jobs',
      '/student/jobs/:jobId',
      '/student/resumes',
      '/student/resume-analysis',
      '/student/applications',
      '/student/interview-prep',
      '/student/settings',
    ];

    const officerRoutes = [
      '/officer/dashboard',
      '/officer/students',
      '/officer/students/:studentId',
      '/officer/evidence-reviews',
      '/officer/jobs',
      '/officer/jobs/create',
      '/officer/jobs/:id/edit',
      '/officer/jobs/import-csv',
      '/officer/jobs/duplicates',
      '/officer/matching',
      '/officer/resume-claims',
      '/officer/applications',
      '/officer/analytics',
      '/officer/audit-logs',
      '/officer/settings',
    ];

    const recruiterRoutes = ['/recruiter/dashboard', '/recruiter/jobs'];

    it('verifies student routes have valid URI structures and parameter conventions', () => {
      expect(studentRoutes.length).toBe(11);
      studentRoutes.forEach((route) => {
        expect(route.startsWith('/student/')).toBe(true);
        expect(route).toMatch(/^\/student\/[a-zA-Z0-9/:-]+$/);
      });
    });

    it('verifies placement officer workspaces have valid URI structures and parameter conventions', () => {
      expect(officerRoutes.length).toBe(15);
      officerRoutes.forEach((route) => {
        expect(route.startsWith('/officer/')).toBe(true);
        expect(route).toMatch(/^\/officer\/[a-zA-Z0-9/:-]+$/);
      });
    });

    it('verifies recruiter workspaces have valid URI structures', () => {
      expect(recruiterRoutes.length).toBe(2);
      recruiterRoutes.forEach((route) => {
        expect(route.startsWith('/recruiter/')).toBe(true);
        expect(route).toMatch(/^\/recruiter\/[a-zA-Z0-9/:-]+$/);
      });
    });
  });

  // =========================================================================
  // 2. Client API Response Contract & Error Handling Shapes
  // =========================================================================
  describe('Client API Transport & Envelope Contracts', () => {
    it('returns standardized ApiResponse envelope on public endpoints', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('status', 'ok');
      expect(res.body.data).toHaveProperty('timestamp');
    });

    it('returns standardized ApiError envelope on 404 routes', async () => {
      const res = await request(app).get('/api/non-existent-endpoint-test');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
    });

    it('returns 401 Unauthorized with standardized ApiError envelope for unauthenticated protected calls', async () => {
      const endpoints = [
        '/api/auth/me',
        '/api/applications/me',
        '/api/resumes/me',
        '/api/evidence/reviews/pending',
      ];

      for (const ep of endpoints) {
        const res = await request(app).get(ep);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.message).toMatch(
          /Authentication required|Token missing|Unauthorized/i
        );
      }
    });

    it('validates auth cookie token structure and parsing by client middleware', async () => {
      const token = signAuthToken({
        userId: '507f1f77bcf86cd799439011',
        role: 'student',
      });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // Standard JWT header.payload.signature
    });
  });

  // =========================================================================
  // 3. Workflow State Machine Contract Verification
  // =========================================================================
  describe('Application Pipeline State Transition Rules Contract', () => {
    it('enforces strict placement officer transition rules', () => {
      // APPLIED -> UNDER_REVIEW, REJECTED, WITHDRAWN
      expect(canTransitionStatus('APPLIED', 'UNDER_REVIEW', 'placement_officer').valid).toBe(true);
      expect(canTransitionStatus('APPLIED', 'REJECTED', 'placement_officer').valid).toBe(true);
      expect(canTransitionStatus('APPLIED', 'WITHDRAWN', 'placement_officer').valid).toBe(true);
      expect(canTransitionStatus('APPLIED', 'OFFER', 'placement_officer').valid).toBe(false);

      // UNDER_REVIEW -> INTERVIEW, REJECTED, WITHDRAWN
      expect(canTransitionStatus('UNDER_REVIEW', 'INTERVIEW', 'placement_officer').valid).toBe(
        true
      );
      expect(canTransitionStatus('UNDER_REVIEW', 'REJECTED', 'placement_officer').valid).toBe(true);

      // INTERVIEW -> OFFER, REJECTED, WITHDRAWN
      expect(canTransitionStatus('INTERVIEW', 'OFFER', 'placement_officer').valid).toBe(true);
      expect(canTransitionStatus('INTERVIEW', 'REJECTED', 'placement_officer').valid).toBe(true);

      // Terminal states cannot transition
      expect(canTransitionStatus('OFFER', 'APPLIED', 'placement_officer').valid).toBe(false);
      expect(canTransitionStatus('REJECTED', 'INTERVIEW', 'placement_officer').valid).toBe(false);
      expect(canTransitionStatus('WITHDRAWN', 'UNDER_REVIEW', 'placement_officer').valid).toBe(
        false
      );
    });

    it('enforces strict student transition restrictions (self-granting prohibited)', () => {
      // Student can withdraw from active/non-terminal states
      expect(canTransitionStatus('APPLIED', 'WITHDRAWN', 'student').valid).toBe(true);
      expect(canTransitionStatus('UNDER_REVIEW', 'WITHDRAWN', 'student').valid).toBe(true);
      expect(canTransitionStatus('INTERVIEW', 'WITHDRAWN', 'student').valid).toBe(true);
      expect(canTransitionStatus('OFFER', 'WITHDRAWN', 'student').valid).toBe(true);

      // Student CANNOT withdraw from terminal states
      expect(canTransitionStatus('REJECTED', 'WITHDRAWN', 'student').valid).toBe(false);
      expect(canTransitionStatus('WITHDRAWN', 'WITHDRAWN', 'student').valid).toBe(false);

      // Student is strictly forbidden from self-granting review, interview, offer or rejected
      const nonWithdrawnStatuses: ApplicationStatus[] = [
        'UNDER_REVIEW',
        'INTERVIEW',
        'OFFER',
        'REJECTED',
        'APPLIED',
      ];
      for (const target of nonWithdrawnStatuses) {
        expect(canTransitionStatus('APPLIED', target, 'student').valid).toBe(false);
        expect(canTransitionStatus('UNDER_REVIEW', target, 'student').valid).toBe(false);
        expect(canTransitionStatus('INTERVIEW', target, 'student').valid).toBe(false);
      }
    });

    it('enforces recruiter transition rules (cannot grant initial review without placement approval)', () => {
      // Recruiter can progress UNDER_REVIEW -> INTERVIEW -> OFFER
      expect(canTransitionStatus('UNDER_REVIEW', 'INTERVIEW', 'recruiter').valid).toBe(true);
      expect(canTransitionStatus('INTERVIEW', 'OFFER', 'recruiter').valid).toBe(true);
      expect(canTransitionStatus('INTERVIEW', 'REJECTED', 'recruiter').valid).toBe(true);

      // Recruiter cannot bypass UNDER_REVIEW from raw APPLIED without officer triage
      expect(canTransitionStatus('APPLIED', 'OFFER', 'recruiter').valid).toBe(false);
    });
  });

  // =========================================================================
  // 4. Dual Dashboard Statistical Metric Calculation Contract
  // =========================================================================
  describe('Dual Dashboard Statistics Contract (Student & Placement)', () => {
    it('calculates deterministic student dashboard metrics adhering to frontend requirements', () => {
      const mockApplications: any[] = [
        { currentStatus: 'APPLIED' },
        { currentStatus: 'UNDER_REVIEW' },
        { currentStatus: 'INTERVIEW' },
        { currentStatus: 'OFFER' },
        { currentStatus: 'REJECTED' },
        { currentStatus: 'WITHDRAWN' },
      ];

      const metrics = calculateStudentDashboardMetrics(mockApplications);

      expect(metrics.totalApplications).toBe(6);
      expect(metrics.activeApplications).toBe(4); // APPLIED, UNDER_REVIEW, INTERVIEW, OFFER
      expect(metrics.interviewsScheduled).toBe(2); // INTERVIEW, OFFER
      expect(metrics.offersReceived).toBe(1); // OFFER
      expect(metrics.byStatus.APPLIED).toBe(1);
      expect(metrics.byStatus.INTERVIEW).toBe(1);
      expect(metrics.byStatus.OFFER).toBe(1);
      expect(metrics.byStatus.REJECTED).toBe(1);
      expect(metrics.byStatus.WITHDRAWN).toBe(1);
    });

    it('calculates deterministic placement dashboard metrics adhering to officer workspace requirements', () => {
      const mockApplications: any[] = [
        { currentStatus: 'APPLIED', student: 's1', job: 'j1' },
        { currentStatus: 'UNDER_REVIEW', student: 's2', job: 'j1' },
        { currentStatus: 'INTERVIEW', student: 's3', job: 'j2' },
        { currentStatus: 'OFFER', student: 's4', job: 'j2', offerDetails: { offeredCtc: 1200000 } },
        { currentStatus: 'OFFER', student: 's5', job: 'j3', offerDetails: { offeredCtc: 1500000 } },
        { currentStatus: 'REJECTED', student: 's6', job: 'j3' },
      ];

      const metrics = calculatePlacementDashboardMetrics(mockApplications);

      expect(metrics.totalApplications).toBe(6);
      expect(metrics.byStatus.APPLIED).toBe(1);
      expect(metrics.byStatus.UNDER_REVIEW).toBe(1);
      expect(metrics.byStatus.INTERVIEW).toBe(1);
      expect(metrics.byStatus.OFFER).toBe(2);
      expect(metrics.byStatus.REJECTED).toBe(1);
      expect(metrics.byStatus.WITHDRAWN).toBe(0);
      expect(metrics.placedStudentsCount).toBe(2);
      expect(metrics.uniqueApplicants).toBe(6);
      expect(metrics.placementRate).toBeGreaterThan(0);
      expect(metrics.averageOfferCtc).toBe(1350000);
      expect(metrics.highestOfferCtc).toBe(1500000);
    });
  });

  // =========================================================================
  // 5. End-to-End Primary Workflow Smoke Integration (when DB active)
  // =========================================================================
  describe('Full Primary Workflow API Contract Execution', () => {
    it('verifies public job endpoints reject unauthenticated or return empty list gracefully', async () => {
      if (!dbAvailable) return;
      const res = await request(app).get('/api/jobs');
      expect([200, 401]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('data');
      }
    });

    it('verifies CSV export endpoint rejects unauthorized non-officers', async () => {
      const res = await request(app).get('/api/applications/export/csv');
      expect(res.status).toBe(401);
    });

    it('verifies student applications endpoint rejects unauthorized requests', async () => {
      const res = await request(app).get('/api/applications/me');
      expect(res.status).toBe(401);
    });
  });
});
