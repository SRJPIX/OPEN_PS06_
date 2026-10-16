import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const RESUME_CLAIM_TYPES = [
  'skill',
  'project',
  'experience',
  'education',
  'achievement',
] as const;
export type ResumeClaimType = (typeof RESUME_CLAIM_TYPES)[number];

export interface IResumeClaim extends Document {
  resume: Types.ObjectId;
  student: Types.ObjectId;
  claimType: ResumeClaimType;
  text: string;
  isVerified: boolean;
  evidence: Types.ObjectId[];
  confidenceScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const resumeClaimSchema = new Schema<IResumeClaim>(
  {
    resume: {
      type: Schema.Types.ObjectId,
      ref: 'Resume',
      required: [true, 'Resume reference is required'],
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: [true, 'Student profile reference is required'],
      index: true,
    },
    claimType: {
      type: String,
      enum: {
        values: RESUME_CLAIM_TYPES,
        message: '{VALUE} is not a valid resume claim type',
      },
      required: [true, 'Claim type is required'],
      index: true,
    },
    text: {
      type: String,
      required: [true, 'Claim text is required'],
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    evidence: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Evidence',
      },
    ],
    confidenceScore: {
      type: Number,
      min: [0, 'Confidence score cannot be negative'],
      max: [100, 'Confidence score cannot exceed 100'],
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

resumeClaimSchema.index({ resume: 1, claimType: 1 });

export const ResumeClaim: Model<IResumeClaim> =
  mongoose.models.ResumeClaim || mongoose.model<IResumeClaim>('ResumeClaim', resumeClaimSchema);
