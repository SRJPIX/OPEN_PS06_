import { z } from 'zod';
import { APPLICATION_STATUSES, normalizeStatusString } from '../models/Application';

export const submitApplicationSchema = z.object({
  jobId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'jobId must be a valid 24-character hexadecimal ObjectId'),
  resumeId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'resumeId must be a valid 24-character hexadecimal ObjectId'),
  coverLetter: z.string().trim().max(5000, 'Cover letter cannot exceed 5000 characters').optional(),
});

export const interviewDetailsInputSchema = z.object({
  round: z.union([z.number(), z.string().trim()]).optional(),
  interviewType: z
    .enum(['technical', 'hr', 'managerial', 'coding', 'system_design', 'other'])
    .optional(),
  scheduledAt: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional(),
  location: z.string().trim().optional(),
  meetingLink: z.string().trim().url('meetingLink must be a valid URL').optional().or(z.literal('')),
  interviewerName: z.string().trim().optional(),
  interviewerEmail: z.string().trim().email('interviewerEmail must be a valid email').optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional(),
  feedback: z.string().trim().max(5000).optional(),
});

export const offerDetailsInputSchema = z.object({
  offeredCtc: z.number().min(0, 'Offered CTC cannot be negative').optional(),
  currency: z.string().trim().default('INR').optional(),
  baseSalary: z.number().min(0, 'Base salary cannot be negative').optional(),
  bonus: z.number().min(0, 'Bonus cannot be negative').optional(),
  designation: z.string().trim().optional(),
  joiningDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional(),
  deadline: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional(),
  offerLetterUrl: z.string().trim().url('offerLetterUrl must be a valid URL').optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional(),
});

export const updateApplicationStatusSchema = z.object({
  status: z
    .string()
    .trim()
    .transform(normalizeStatusString)
    .refine((val) => (APPLICATION_STATUSES as readonly string[]).includes(val), {
      message: `Invalid status. Valid statuses are: [${APPLICATION_STATUSES.join(', ')}]`,
    }),
  notes: z.string().trim().max(1000).optional(),
  interviewDetails: interviewDetailsInputSchema.optional(),
  offerDetails: offerDetailsInputSchema.optional(),
});

export const updateInterviewDetailsSchema = interviewDetailsInputSchema;

export const updateOfferDetailsSchema = offerDetailsInputSchema;

export const withdrawApplicationSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export const queryApplicationsSchema = z.object({
  jobId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  companyId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  status: z.string().trim().optional(),
  studentId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  search: z.string().trim().optional(),
  fromDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  toDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['appliedAt', 'updatedAt', 'currentStatus']).default('appliedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
export type UpdateInterviewDetailsInput = z.infer<typeof updateInterviewDetailsSchema>;
export type UpdateOfferDetailsInput = z.infer<typeof updateOfferDetailsSchema>;
export type QueryApplicationsInput = z.infer<typeof queryApplicationsSchema>;
