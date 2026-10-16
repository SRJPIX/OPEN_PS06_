import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const EVIDENCE_TYPES = [
  'github_repo',
  'certificate',
  'assessment_result',
  'publication',
  'portfolio_link',
  'document',
  'other',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export interface IEvidence extends Document {
  student: Types.ObjectId;
  type: EvidenceType;
  title: string;
  url?: string;
  description?: string;
  isVerified: boolean;
  verificationSource?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const evidenceSchema = new Schema<IEvidence>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: [true, 'Student profile reference is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: EVIDENCE_TYPES,
        message: '{VALUE} is not a valid evidence type',
      },
      required: [true, 'Evidence type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Evidence title is required'],
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    verificationSource: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

export const Evidence: Model<IEvidence> =
  mongoose.models.Evidence || mongoose.model<IEvidence>('Evidence', evidenceSchema);
