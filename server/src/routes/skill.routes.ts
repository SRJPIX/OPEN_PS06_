import { Router } from 'express';
import { listSkills, resolveSkill, seedSkillsEndpoint } from '../controllers/skill.controller';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   GET /api/skills
 * @desc    Search / list canonical skills
 * @access  Public
 */
router.get('/', listSkills);

/**
 * @route   POST /api/skills/resolve
 * @desc    Resolve user input / alias to canonical skill
 * @access  Public
 */
router.post('/resolve', resolveSkill);

/**
 * @route   POST /api/skills/seed
 * @desc    Admin: seed canonical skills dictionary
 * @access  Private (Admin)
 */
router.post('/seed', requireAuth, requireAdmin, seedSkillsEndpoint);

export default router;
