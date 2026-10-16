import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const WORKPLACE_TYPES = ['remote', 'hybrid', 'on_site'] as const;
export type WorkplaceType = (typeof WORKPLACE_TYPES)[number];

export const JOB_TYPES = ['full_time', 'internship', 'part_time', 'contract'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['draft', 'open', 'closed', 'archived'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface IJob extends Document {
  company: Types.ObjectId;
  title: string;
  description: string;
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
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    workplaceType: {
      type: String,
      enum: {
        values: WORKPLACE_TYPES,
        message: '{VALUE} is not a valid workplace type',
      },
      required: [true, 'Workplace type is required'],
      index: true,
    },
    jobType: {
      type: String,
      enum: {
        values: JOB_TYPES,
        message: '{VALUE} is not a valid job type',
      },
      required: [true, 'Job type is required'],
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
    deadline: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

jobSchema.index({ status: 1, workplaceType: 1, jobType: 1 });

export const Job: Model<IJob> = mongoose.models.Job || mongoose.model<IJob>('Job', jobSchema);
