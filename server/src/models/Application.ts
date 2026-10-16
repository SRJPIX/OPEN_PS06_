import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const APPLICATION_STATUSES = [
  'applied',
  'screening',
  'shortlisted',
  'assessment',
  'interview',
  'offered',
  'rejected',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface IApplication extends Document {
  student: Types.ObjectId;
  job: Types.ObjectId;
  resume: Types.ObjectId;
  currentStatus: ApplicationStatus;
  appliedAt: Date;
  coverLetter?: string;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: [true, 'Student profile reference is required'],
      index: true,
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Job reference is required'],
      index: true,
    },
    resume: {
      type: Schema.Types.ObjectId,
      ref: 'Resume',
      required: [true, 'Resume reference is required'],
      index: true,
    },
    currentStatus: {
      type: String,
      enum: {
        values: APPLICATION_STATUSES,
        message: '{VALUE} is not a valid application status',
      },
      default: 'applied',
      index: true,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    coverLetter: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring a student can apply to a job at most once
applicationSchema.index({ student: 1, job: 1 }, { unique: true });

export const Application: Model<IApplication> =
  mongoose.models.Application || mongoose.model<IApplication>('Application', applicationSchema);
