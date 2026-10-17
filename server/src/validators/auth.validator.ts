import { z } from 'zod';

export const registerStudentSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password cannot exceed 100 characters'),
  rollNumber: z
    .string()
    .min(2, 'Roll number must be at least 2 characters')
    .max(50, 'Roll number cannot exceed 50 characters')
    .trim(),
  department: z
    .string()
    .min(2, 'Department name is required')
    .max(100, 'Department name cannot exceed 100 characters')
    .trim(),
  degree: z
    .string()
    .min(2, 'Degree name is required')
    .max(50, 'Degree name cannot exceed 50 characters')
    .trim()
    .default('B.Tech'),
  graduationYear: z.coerce
    .number()
    .int('Graduation year must be an integer')
    .min(2000, 'Graduation year cannot be earlier than 2000')
    .max(2100, 'Graduation year cannot exceed 2100'),
  cgpa: z.coerce
    .number()
    .min(0, 'CGPA cannot be negative')
    .max(10, 'CGPA cannot exceed 10.0')
    .default(0),
  phone: z.string().trim().optional(),
  bio: z.string().max(1000, 'Bio cannot exceed 1000 characters').trim().optional(),
});

export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const provisionUserSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password cannot exceed 100 characters'),
  role: z.enum(['placement_officer', 'recruiter', 'admin', 'student'], {
    message: 'Role must be one of: placement_officer, recruiter, admin, student',
  }),
  companyId: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  name: z.string().trim().optional(),
});

export type ProvisionUserInput = z.infer<typeof provisionUserSchema>;
