import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { JOB_SOURCE_TYPES, JobSourceType } from './JobSource';

export const WORKPLACE_TYPES = ['remote', 'hybrid', 'on_site'] as const;
export type WorkplaceType = (typeof WORKPLACE_TYPES)[number];

export const JOB_TYPES = ['full_time', 'internship', 'part_time', 'contract'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['draft', 'open', 'closed', 'archived'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface IJobMergedSource {
  jobId: Types.ObjectId;
  requisitionId?: string;
  sourceUrl?: string;
  sourceType?: string;
  mergedAt: Date;
  mergedBy: Types.ObjectId;
  notes?: string;
}

export interface IJobProvenance {
  sourceType?: string;
  sourceUrl?: string;
  requisitionId?: string;
  partnerName?: string;
  alumniReferrer?: {
    name?: string;
    email?: string;
    graduationYear?: number;
  };
  apiSourceRef?: string;
  parserUsed?: 'deterministic' | 'llm' | 'manual' | 'csv_import';
  ingestedAt?: Date;
  ingestedBy?: Types.ObjectId;
  mergedFrom?: IJobMergedSource[];
}

export interface IPotentialDuplicate {
  jobId: Types.ObjectId;
  similarityScore: number;
  matchReasons: string[];
  status: 'pending_review' | 'dismissed' | 'merged';
  detectedAt: Date;
}

export interface IJob extends Document {
  company: Types.ObjectId;
  title: string;
  description: string;
  responsibilities: string[];
  location: string;
  workplaceType: WorkplaceType;
  jobType: JobType;
  requiredSkills: Types.ObjectId[];
  preferredSkills: Types.ObjectId[];
  minCgpa: number;
  eligibleDepartments: string[];
  eligibleGraduationYears: number[];
  salaryRange?: {
    min?: number;
    max?: number;
    currency: string;
  };
  status: JobStatus;
  postedBy: Types.ObjectId;
  source?: Types.ObjectId;
  sourceType: JobSourceType;
  requisitionId?: string;
  sourceUrl?: string;
  duplicateOf?: Types.ObjectId;
  provenance?: IJobProvenance;
  potentialDuplicates?: IPotentialDuplicate[];
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const jobMergedSourceSchema = new Schema<IJobMergedSource>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    requisitionId: { type: String, trim: true },
    sourceUrl: { type: String, trim: true },
    sourceType: { type: String, trim: true },
    mergedAt: { type: Date, default: Date.now },
    mergedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const jobProvenanceSchema = new Schema<IJobProvenance>(
  {
    sourceType: { type: String, trim: true },
    sourceUrl: { type: String, trim: true },
    requisitionId: { type: String, trim: true },
    partnerName: { type: String, trim: true },
    alumniReferrer: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      graduationYear: { type: Number },
    },
    apiSourceRef: { type: String, trim: true },
    parserUsed: {
      type: String,
      enum: ['deterministic', 'llm', 'manual', 'csv_import'],
      default: 'manual',
    },
    ingestedAt: { type: Date, default: Date.now },
    ingestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    mergedFrom: { type: [jobMergedSourceSchema], default: [] },
  },
  { _id: false }
);

const potentialDuplicateSchema = new Schema<IPotentialDuplicate>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    similarityScore: { type: Number, required: true },
    matchReasons: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['pending_review', 'dismissed', 'merged'],
      default: 'pending_review',
    },
    detectedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const jobSchema = new Schema<IJob>(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
    },
    responsibilities: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      default: 'Remote',
    },
    workplaceType: {
      type: String,
      enum: {
        values: WORKPLACE_TYPES,
        message: '{VALUE} is not a valid workplace type',
      },
      required: [true, 'Workplace type is required'],
      default: 'on_site',
      index: true,
    },
    jobType: {
      type: String,
      enum: {
        values: JOB_TYPES,
        message: '{VALUE} is not a valid job type',
      },
      required: [true, 'Job type is required'],
      default: 'full_time',
      index: true,
    },
    requiredSkills: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Skill',
        index: true,
      },
    ],
    preferredSkills: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Skill',
      },
    ],
    minCgpa: {
      type: Number,
      min: [0, 'Minimum CGPA cannot be negative'],
      max: [10, 'Minimum CGPA cannot exceed 10.0'],
      default: 0,
    },
    eligibleDepartments: {
      type: [String],
      default: [],
    },
    eligibleGraduationYears: {
      type: [Number],
      default: [],
    },
    salaryRange: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      currency: { type: String, default: 'INR' },
    },
    status: {
      type: String,
      enum: {
        values: JOB_STATUSES,
        message: '{VALUE} is not a valid job status',
      },
      default: 'draft',
      index: true,
    },
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Job poster user reference is required'],
      index: true,
    },
    source: {
      type: Schema.Types.ObjectId,
      ref: 'JobSource',
      index: true,
    },
    sourceType: {
      type: String,
      enum: {
        values: JOB_SOURCE_TYPES,
        message: '{VALUE} is not a valid source type',
      },
      default: 'manual_submission',
      index: true,
    },
    requisitionId: {
      type: String,
      trim: true,
      index: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
      index: true,
    },
    duplicateOf: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      index: true,
    },
    provenance: {
      type: jobProvenanceSchema,
      default: () => ({}),
    },
    potentialDuplicates: {
      type: [potentialDuplicateSchema],
      default: [],
    },
    deadline: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

jobSchema.index({ status: 1, workplaceType: 1, jobType: 1 });
jobSchema.index({ company: 1, requisitionId: 1 });
jobSchema.index({ company: 1, status: 1 });

export const Job: Model<IJob> = mongoose.models.Job || mongoose.model<IJob>('Job', jobSchema);
