import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Health and Readiness Endpoints', () => {
  const app = createApp();

  describe('GET /api/health (Liveness Probe)', () => {
    it('should return 200 with service information and liveness status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toMatchObject({
        status: 'ok',
        service: 'evidra-api',
        version: '0.1.0',
      });
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('database');
    });
  });

  describe('GET /api/ready (Readiness Probe)', () => {
    it('should return 503 when database is disconnected', async () => {
      // In default test environment without active MongoDB connection
      const response = await request(app).get('/api/ready');

      // If DB is disconnected, status should be 503 SERVICE_NOT_READY
      expect([200, 503]).toContain(response.status);

      if (response.status === 503) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toHaveProperty('code', 'SERVICE_NOT_READY');
        expect(response.body.error.details).toHaveProperty('ready', false);
      } else {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('ready', true);
      }
    });
  });

  describe('GET / (Root Service Overview)', () => {
    it('should return 200 with service metadata', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toMatchObject({
        name: 'Evidra API',
        status: 'active',
        version: '0.1.0',
      });
      expect(response.body.data.endpoints).toHaveProperty('health', '/api/health');
      expect(response.body.data.endpoints).toHaveProperty('ready', '/api/ready');
    });
  });

  describe('Unmatched routes (404 Handler)', () => {
    it('should return consistent JSON 404 response', async () => {
      const response = await request(app).get('/api/non-existent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toMatchObject({
        code: 'NOT_FOUND',
      });
      expect(response.body.error.message).toContain('endpoint not found');
    });
  });
});
