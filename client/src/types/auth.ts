export type UserRole = 'student' | 'placement_officer' | 'recruiter' | 'admin';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  scoreOrCgpa?: string;
}

export interface StudentProfile {
  id?: string;
  user: string;
  rollNumber: string;
  department: string;
  degree: string;
  graduationYear: number;
  cgpa: number;
  phone?: string;
  bio?: string;
  education?: EducationEntry[];
  links?: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
  };
}

export interface AuthSessionResponse {
  user: User;
  profile?: StudentProfile | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterStudentData {
  email: string;
  password: string;
  rollNumber: string;
  department: string;
  degree: string;
  graduationYear: number;
  cgpa: number;
  phone?: string;
  bio?: string;
}
