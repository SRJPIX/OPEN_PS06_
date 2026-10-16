import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const RESUME_STATUSES = ['draft', 'generated', 'verified', 'archived'] as const;
export type ResumeStatus = (typeof RESUME_STATUSES)[number];

export interface IResume extends Document {
  student: Types.ObjectId;
  title: string;
  version: number;
  summary?: string;
  targetRole?: string;
  fileUrl?: string;
  isPrimary: boolean;
  status: ResumeStatus;
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  {
    timestamps: true,
  }
);

resumeSchema.index({ student: 1, version: 1 }, { unique: true });

export const Resume: Model<IResume> =
  mongoose.models.Resume || mongoose.model<IResume>('Resume', resumeSchema);
