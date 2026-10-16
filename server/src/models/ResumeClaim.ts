import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const RESUME_CLAIM_TYPES = [
  'skill',
  'project',
  'experience',
  'education',
  'achievement',
  'certification',
  'metric',
] as const;
export type ResumeClaimType = (typeof RESUME_CLAIM_TYPES)[number];

export const CLAIM_VALIDATION_STATUSES = [
  'SUPPORTED',
  'NEEDS_REVIEW',
  'UNSUPPORTED',
  'CONTRADICTED',
] as const;
export type ClaimValidationStatus = (typeof CLAIM_VALIDATION_STATUSES)[number];

export interface IResumeClaim extends Document {
  resume: Types.ObjectId;
  student: Types.ObjectId;
  claimType: ResumeClaimType;
  text: string;
  extractedText?: string;
  correctedText?: string;
  validationStatus: ClaimValidationStatus;
  explanation: string;
  isVerified: boolean;
  evidence: Types.ObjectId[];
  skills: Types.ObjectId[];
  confidenceScore: number;
  flaggedForOfficerReview: boolean;
  reviewNotes?: string;
  reviewedBy?: Types.ObjectId;
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
    extractedText: {
      type: String,
      trim: true,
    },
    correctedText: {
      type: String,
      trim: true,
    },
    validationStatus: {
      type: String,
      enum: {
        values: CLAIM_VALIDATION_STATUSES,
        message: '{VALUE} is not a valid claim validation status',
      },
      default: 'UNSUPPORTED',
      index: true,
    },
    explanation: {
      type: String,
      default: 'Verification status computed against student portfolio evidence.',
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
    skills: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Skill',
      },
    ],
    confidenceScore: {
      type: Number,
      min: [0, 'Confidence score cannot be negative'],
      max: [100, 'Confidence score cannot exceed 100'],
      default: 0,
    },
    flaggedForOfficerReview: {
      type: Boolean,
      default: false,
      index: true,
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

resumeClaimSchema.index({ resume: 1, claimType: 1 });
resumeClaimSchema.index({ student: 1, validationStatus: 1 });

export const ResumeClaim: Model<IResumeClaim> =
  mongoose.models.ResumeClaim || mongoose.model<IResumeClaim>('ResumeClaim', resumeClaimSchema);
