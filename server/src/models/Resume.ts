import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const RESUME_STATUSES = ['draft', 'generated', 'verified', 'archived'] as const;
export type ResumeStatus = (typeof RESUME_STATUSES)[number];

export const VALIDATION_STATUSES = [
  'SUPPORTED',
  'NEEDS_REVIEW',
  'UNSUPPORTED',
  'CONTRADICTED',
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export interface IResumeBullet {
  bulletId: string;
  section: 'skills' | 'projects' | 'experience' | 'education' | 'certifications';
  text: string;
  skillIds: Types.ObjectId[];
  evidenceIds: Types.ObjectId[];
  validationStatus: ValidationStatus;
  confidenceScore: number;
}

export interface IResumeContact {
  fullName: string;
  email: string;
  phone?: string;
  department: string;
  degree: string;
  institution: string;
  rollNumber: string;
  graduationYear: number;
  cgpa: number;
  links?: Array<{ label: string; url: string }>;
}

export interface IResumeEducation {
  institution: string;
  degree: string;
  department: string;
  graduationYear: number;
  cgpa: number;
  highlights?: string[];
}

export interface IResumeSkillCategory {
  category: string;
  skills: Array<{
    skillId: Types.ObjectId;
    name: string;
    proficiency: string;
    evidenceIds: Types.ObjectId[];
    isVerified: boolean;
  }>;
}

export interface IResumeProject {
  projectId?: Types.ObjectId;
  title: string;
  description: string;
  technologies: string[];
  url?: string;
  bullets: Array<{
    bulletId: string;
    text: string;
    evidenceIds: Types.ObjectId[];
    skillIds: Types.ObjectId[];
    validationStatus: ValidationStatus;
    confidenceScore: number;
  }>;
}

export interface IResumeCertification {
  title: string;
  issuer: string;
  issueDate?: Date | string;
  credentialUrl?: string;
  evidenceId?: Types.ObjectId;
  isVerified: boolean;
}

export interface IResumeExcludedItem {
  type: 'skill' | 'project' | 'metric' | 'claim';
  text: string;
  reason: string;
}

export interface IResume extends Document {
  student: Types.ObjectId;
  title: string;
  version: number;
  summary?: string;
  targetRole?: string;
  targetJob?: Types.ObjectId;
  fileUrl?: string;
  isPrimary: boolean;
  status: ResumeStatus;

  // Structured ATS Resume Sections
  contactDetails?: IResumeContact;
  education?: IResumeEducation[];
  skills?: IResumeSkillCategory[];
  projects?: IResumeProject[];
  certifications?: IResumeCertification[];
  bullets?: IResumeBullet[];

  // Truthfulness & Provenance
  excludedItems?: IResumeExcludedItem[];
  generationStats?: {
    totalEvidenceConsidered: number;
    supportedBulletsCount: number;
    omittedClaimsCount: number;
    fitScore?: number;
    generatedAt: Date;
  };

  // Uploaded Original File Metadata
  originalFile?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    rawExtractedText?: string;
    uploadedAt?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

const bulletSchema = new Schema<IResumeBullet>(
  {
    bulletId: { type: String, required: true },
    section: {
      type: String,
      enum: ['skills', 'projects', 'experience', 'education', 'certifications'],
      required: true,
    },
    text: { type: String, required: true, trim: true },
    skillIds: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
    evidenceIds: [{ type: Schema.Types.ObjectId, ref: 'Evidence' }],
    validationStatus: {
      type: String,
      enum: VALIDATION_STATUSES,
      default: 'SUPPORTED',
    },
    confidenceScore: { type: Number, default: 100, min: 0, max: 100 },
  },
  { _id: false }
);

const resumeSchema = new Schema<IResume>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: [true, 'Student profile reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Resume title is required'],
      trim: true,
    },
    version: {
      type: Number,
      default: 1,
      min: [1, 'Version must be at least 1'],
    },
    summary: {
      type: String,
      trim: true,
    },
    targetRole: {
      type: String,
      trim: true,
    },
    targetJob: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: RESUME_STATUSES,
        message: '{VALUE} is not a valid resume status',
      },
      default: 'draft',
      index: true,
    },

    contactDetails: {
      fullName: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      department: { type: String, trim: true },
      degree: { type: String, trim: true },
      institution: { type: String, trim: true },
      rollNumber: { type: String, trim: true },
      graduationYear: { type: Number },
      cgpa: { type: Number },
      links: [
        {
          label: { type: String },
          url: { type: String },
        },
      ],
    },

    education: [
      {
        institution: { type: String, required: true },
        degree: { type: String, required: true },
        department: { type: String, required: true },
        graduationYear: { type: Number, required: true },
        cgpa: { type: Number, required: true },
        highlights: [{ type: String }],
      },
    ],

    skills: [
      {
        category: { type: String, required: true },
        skills: [
          {
            skillId: { type: Schema.Types.ObjectId, ref: 'Skill' },
            name: { type: String, required: true },
            proficiency: { type: String },
            evidenceIds: [{ type: Schema.Types.ObjectId, ref: 'Evidence' }],
            isVerified: { type: Boolean, default: false },
          },
        ],
      },
    ],

    projects: [
      {
        projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
        title: { type: String, required: true },
        description: { type: String, required: true },
        technologies: [{ type: String }],
        url: { type: String },
        bullets: [bulletSchema],
      },
    ],

    certifications: [
      {
        title: { type: String, required: true },
        issuer: { type: String, required: true },
        issueDate: { type: Schema.Types.Mixed },
        credentialUrl: { type: String },
        evidenceId: { type: Schema.Types.ObjectId, ref: 'Evidence' },
        isVerified: { type: Boolean, default: false },
      },
    ],

    bullets: [bulletSchema],

    excludedItems: [
      {
        type: {
          type: String,
          enum: ['skill', 'project', 'metric', 'claim'],
          required: true,
        },
        text: { type: String, required: true },
        reason: { type: String, required: true },
      },
    ],

    generationStats: {
      totalEvidenceConsidered: { type: Number, default: 0 },
      supportedBulletsCount: { type: Number, default: 0 },
      omittedClaimsCount: { type: Number, default: 0 },
      fitScore: { type: Number },
      generatedAt: { type: Date, default: Date.now },
    },

    originalFile: {
      fileName: { type: String },
      fileSize: { type: Number },
      mimeType: { type: String },
      rawExtractedText: { type: String },
      uploadedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

resumeSchema.index({ student: 1, version: 1 }, { unique: true });

export const Resume: Model<IResume> =
  mongoose.models.Resume || mongoose.model<IResume>('Resume', resumeSchema);
