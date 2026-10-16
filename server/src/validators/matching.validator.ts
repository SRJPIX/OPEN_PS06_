import { z } from 'zod';

export const rankCandidatesQuerySchema = z.object({
  batch: z.coerce.number().int().optional(),
  graduationYear: z.coerce.number().int().optional(),
  department: z.string().trim().optional(),
  minCgpa: z.coerce.number().min(0).max(10).optional(),
  eligibility: z.enum(['MET', 'NOT_MET', 'UNKNOWN', 'ALL']).optional().default('ALL'),
  minScore: z.coerce.number().min(0).max(100).optional(),
  requiredSkillWeight: z.coerce.number().min(1).max(10).optional().default(3),
  preferredSkillWeight: z.coerce.number().min(1).max(10).optional().default(1),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type RankCandidatesQuery = z.infer<typeof rankCandidatesQuerySchema>;

