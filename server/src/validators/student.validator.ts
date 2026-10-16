import { z } from 'zod';
import { EVIDENCE_TYPES, EvidenceType } from '../models/Evidence';
import { SKILL_PROFICIENCIES, SkillProficiency } from '../models/StudentSkill';

export const updateProfileSchema = z.object({
  department: z.string().min(2, 'Department name must be at least 2 characters').trim().optional(),
  degree: z.string().min(2, 'Degree name must be at least 2 characters').trim().optional(),
  graduationYear: z.coerce
    .number()
    .int()
    .min(2000, 'Graduation year cannot be earlier than 2000')
    .max(2100, 'Graduation year cannot exceed 2100')
    .optional(),
  cgpa: z.coerce
    .number()
    .min(0, 'CGPA cannot be negative')
    .max(10, 'CGPA cannot exceed 10.0')
    .optional(),
  phone: z.string().trim().optional(),
  bio: z.string().max(1000, 'Bio cannot exceed 1000 characters').trim().optional(),
  education: z
    .array(
      z.object({
        institution: z.string().min(1, 'Institution is required').trim(),
        degree: z.string().min(1, 'Degree is required').trim(),
        fieldOfStudy: z.string().trim().optional(),
        startYear: z.coerce.number().optional(),
        endYear: z.coerce.number().optional(),
        scoreOrCgpa: z.string().trim().optional(),
      })
    )
    .optional(),
  links: z
    .object({
      github: z.string().trim().optional(),
      linkedin: z.string().trim().optional(),
      portfolio: z.string().trim().optional(),
    })
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const submitEvidenceSchema = z.object({
  type: z.enum(EVIDENCE_TYPES as unknown as [EvidenceType, ...EvidenceType[]]),
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters long')
    .max(200, 'Title cannot exceed 200 characters')
    .trim(),
  description: z.string().max(2000, 'Description cannot exceed 2000 characters').trim().optional(),
  url: z.string().trim().optional(),
  skills: z
    .array(z.string().min(1, 'Skill cannot be empty'))
    .min(1, 'At least one skill must be linked to this evidence'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SubmitEvidenceInput = z.infer<typeof submitEvidenceSchema>;

export const reviewEvidenceSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_evidence', 'under_review']),
  notes: z
    .string()
    .min(2, 'Evaluation notes are required when reviewing evidence')
    .max(1000, 'Notes cannot exceed 1000 characters')
    .trim(),
  score: z.coerce.number().min(0).optional(),
  confidenceScore: z.coerce.number().min(0).max(100).optional(),
});

export type ReviewEvidenceInput = z.infer<typeof reviewEvidenceSchema>;

export const addSkillSchema = z.object({
  name: z.string().min(1, 'Skill name or alias is required').trim(),
  proficiency: z
    .enum(SKILL_PROFICIENCIES as unknown as [SkillProficiency, ...SkillProficiency[]])
    .default('intermediate'),
});

export type AddSkillInput = z.infer<typeof addSkillSchema>;
