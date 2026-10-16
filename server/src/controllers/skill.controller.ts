import { Request, Response, NextFunction } from 'express';
import { Skill } from '../models/Skill';
import { sendSuccess } from '../utils/apiResponse';
import {
  CANONICAL_SKILLS,
  resolveCanonicalSkillDefinition,
  resolveSkillDocument,
  seedCanonicalSkills,
} from '../utils/skillNormalizer';

/**
 * List or search canonical skills.
 */
export const listSkills = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, category } = req.query;

    const query: Record<string, unknown> = {};

    if (category) {
      query.category = category;
    }

    if (q && typeof q === 'string') {
      const searchRegex = new RegExp(q.trim(), 'i');
      query.$or = [{ name: searchRegex }, { slug: searchRegex }, { aliases: searchRegex }];
    }

    const skills = await Skill.find(query).sort({ name: 1 });

    sendSuccess(res, skills, 'Canonical skills retrieved successfully', 200, {
      total: skills.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Test or resolve an arbitrary user-supplied skill name/alias.
 */
export const resolveSkill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      sendSuccess(res, { resolved: null }, 'Empty query provided');
      return;
    }

    // In-memory canonical check
    const inMemoryDef = resolveCanonicalSkillDefinition(query);

    // Database resolution (persists or retrieves canonical document)
    const skillDoc = await resolveSkillDocument(query);

    sendSuccess(
      res,
      {
        input: query,
        inMemoryMatch: inMemoryDef
          ? {
              slug: inMemoryDef.slug,
              name: inMemoryDef.name,
              category: inMemoryDef.category,
            }
          : null,
        resolvedSkill: skillDoc,
      },
      'Skill normalization resolved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Seed canonical skills dictionary endpoint.
 */
export const seedSkillsEndpoint = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const count = await seedCanonicalSkills();
    sendSuccess(
      res,
      { seededCount: count, totalAvailable: CANONICAL_SKILLS.length },
      'Canonical skills dictionary seeded successfully'
    );
  } catch (error) {
    next(error);
  }
};
