import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const APPLICATION_STATUSES = [
  'APPLIED',
  'UNDER_REVIEW',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const normalizeStatusString = (val: string): string => {
  if (typeof val !== 'string') return val;
  const upper = val.trim().toUpperCase();
  if (upper === 'OFFERED') return 'OFFER';
  if (upper === 'SCREENING' || upper === 'SHORTLISTED' || upper === 'ASSESSMENT') return 'UNDER_REVIEW';
  return upper;
};

export interface IInterviewDetails {
  round?: number | string;
  interviewType?: 'technical' | 'hr' | 'managerial' | 'coding' | 'system_design' | 'other';
  scheduledAt?: Date;
  location?: string;
  meetingLink?: string;
  interviewerName?: string;
  interviewerEmail?: string;
  notes?: string;
  feedback?: string;
}

export interface IOfferDetails {
  offeredCtc?: number;
  currency?: string;
  baseSalary?: number;
  bonus?: number;
  designation?: string;
  joiningDate?: Date;
  deadline?: Date;
  offerLetterUrl?: string;
  notes?: string;
}

export interface IResumeSnapshot {
  resumeId: Types.ObjectId;
  version: number;
  title: string;
  summary?: string;
  targetRole?: string;
  fileUrl?: string;
  submittedAt: Date;
}

export interface IApplication extends Document {
  student: Types.ObjectId;
  job: Types.ObjectId;
  resume: Types.ObjectId;
  resumeVersion: number;
  resumeSnapshot?: IResumeSnapshot;
  currentStatus: ApplicationStatus;
  appliedAt: Date;
  coverLetter?: string;
  interviewDetails?: IInterviewDetails;
  offerDetails?: IOfferDetails;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const interviewDetailsSchema = new Schema<IInterviewDetails>(
  {
    round: { type: Schema.Types.Mixed },
    interviewType: {
      type: String,
      enum: ['technical', 'hr', 'managerial', 'coding', 'system_design', 'other'],
      default: 'technical',
    },
    scheduledAt: { type: Date },
    location: { type: String, trim: true },
    meetingLink: { type: String, trim: true },
    interviewerName: { type: String, trim: true },
    interviewerEmail: { type: String, trim: true },
    notes: { type: String, trim: true },
    feedback: { type: String, trim: true },
  },
  { _id: false }
);

const offerDetailsSchema = new Schema<IOfferDetails>(
  {
    offeredCtc: { type: Number, min: 0 },
    currency: { type: String, default: 'INR', trim: true },
    baseSalary: { type: Number, min: 0 },
    bonus: { type: Number, min: 0 },
    designation: { type: String, trim: true },
    joiningDate: { type: Date },
    deadline: { type: Date },
    offerLetterUrl: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const resumeSnapshotSchema = new Schema<IResumeSnapshot>(
  {
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true },
    version: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, trim: true },
    targetRole: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
    resumeVersion: {
      type: Number,
      required: [true, 'Resume version is required'],
      default: 1,
      min: [1, 'Resume version must be at least 1'],
    },
    resumeSnapshot: {
      type: resumeSnapshotSchema,
    },
    currentStatus: {
      type: String,
      enum: {
        values: APPLICATION_STATUSES,
        message: '{VALUE} is not a valid application status',
      },
      default: 'APPLIED',
      set: normalizeStatusString,
      index: true,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    coverLetter: {
      type: String,
      trim: true,
    },
    interviewDetails: {
      type: interviewDetailsSchema,
    },
    offerDetails: {
      type: offerDetailsSchema,
    },
    notes: {
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
applicationSchema.index({ currentStatus: 1, appliedAt: -1 });
applicationSchema.index({ job: 1, currentStatus: 1 });

export const Application: Model<IApplication> =
  mongoose.models.Application || mongoose.model<IApplication>('Application', applicationSchema);
