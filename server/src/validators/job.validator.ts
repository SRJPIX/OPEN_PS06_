import { z } from 'zod';
import { WORKPLACE_TYPES, JOB_TYPES, JOB_STATUSES } from '../models/Job';
import { JOB_SOURCE_TYPES } from '../models/JobSource';

export const createJobSchema = z.object({
  company: z.string().trim().min(1, 'Company ID or name is required'),
  title: z.string().trim().min(2, 'Job title must be at least 2 characters'),
  description: z.string().trim().min(10, 'Job description must be at least 10 characters'),
  responsibilities: z.array(z.string().trim()).optional().default([]),
  location: z.string().trim().optional().default('Remote'),
  workplaceType: z
    .enum(WORKPLACE_TYPES as unknown as [string, ...string[]])
    .optional()
    .default('on_site'),
  jobType: z
    .enum(JOB_TYPES as unknown as [string, ...string[]])
    .optional()
    .default('full_time'),
  requiredSkills: z.array(z.string().trim()).optional().default([]),
  preferredSkills: z.array(z.string().trim()).optional().default([]),
  minCgpa: z.number().min(0).max(10).optional().default(0),
  eligibleDepartments: z.array(z.string().trim()).optional().default([]),
  eligibleGraduationYears: z.array(z.number().int()).optional().default([]),
  salaryRange: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      currency: z.string().trim().default('INR'),
    })
    .optional(),
  deadline: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  status: z
    .enum(JOB_STATUSES as unknown as [string, ...string[]])
    .optional()
    .default('draft'),
  requisitionId: z.string().trim().optional(),
  sourceUrl: z.string().trim().url('Source URL must be a valid URL').optional().or(z.literal('')),
  sourceType: z
    .enum(JOB_SOURCE_TYPES as unknown as [string, ...string[]])
    .optional()
    .default('manual_submission'),
  source: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid JobSource ID')
    .optional(),
  provenance: z
    .object({
      partnerName: z.string().trim().optional(),
      alumniReferrer: z
        .object({
          name: z.string().trim().optional(),
          email: z.string().trim().email().optional(),
          graduationYear: z.number().int().optional(),
        })
        .optional(),
      apiSourceRef: z.string().trim().optional(),
    })
    .optional(),
});

export const updateJobSchema = createJobSchema.partial();

export const queryJobsSchema = z.object({
  title: z.string().trim().optional(),
  company: z.string().trim().optional(),
  location: z.string().trim().optional(),
  workplaceType: z.enum(WORKPLACE_TYPES as unknown as [string, ...string[]]).optional(),
  workMode: z.enum(WORKPLACE_TYPES as unknown as [string, ...string[]]).optional(), // Alias for workplaceType
  jobType: z.enum(JOB_TYPES as unknown as [string, ...string[]]).optional(),
  status: z.enum(JOB_STATUSES as unknown as [string, ...string[]]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const mergeJobsSchema = z.object({
  primaryJobId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid primaryJobId'),
  duplicateJobId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid duplicateJobId'),
  notes: z.string().trim().optional(),
});

export const parseJobSchema = z.object({
  text: z.string().trim().min(5, 'Job text must be at least 5 characters'),
  useLlm: z.boolean().optional().default(false),
});

export const createJobSourceSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  type: z.enum(JOB_SOURCE_TYPES as unknown as [string, ...string[]]),
  description: z.string().trim().optional(),
  externalRef: z.string().trim().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
