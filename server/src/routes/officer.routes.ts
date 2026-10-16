import { Router } from 'express';
import {
  getOfficerDashboardStats,
  getOfficerAnalytics,
  getOfficerAuditLogs,
  getPlacementSettings,
  updatePlacementSettings,
} from '../controllers/officer.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All officer routes require authentication and placement_officer or admin role
router.use(requireAuth, requireRole('placement_officer', 'admin'));

/**
 * @route   GET /api/officer/dashboard/stats
 * @desc    Get real API dashboard metrics
 * @access  Private (Placement Officer, Admin)
 */
router.get('/dashboard/stats', getOfficerDashboardStats);

/**
 * @route   GET /api/officer/analytics
 * @desc    Get aggregated placement intelligence and funnel analytics
 * @access  Private (Placement Officer, Admin)
 */
router.get('/analytics', getOfficerAnalytics);

/**
 * @route   GET /api/officer/audit-logs
 * @desc    Get paginated audit log history
 * @access  Private (Placement Officer, Admin)
 */
router.get('/audit-logs', getOfficerAuditLogs);

/**
 * @route   GET /api/officer/settings
 * @desc    Get institutional placement settings
 * @access  Private (Placement Officer, Admin)
 */
router.get('/settings', getPlacementSettings);

/**
 * @route   PUT /api/officer/settings
 * @desc    Update institutional placement settings
 * @access  Private (Placement Officer, Admin)
 */
router.put('/settings', updatePlacementSettings);

export default router;

