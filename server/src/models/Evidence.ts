import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const EVIDENCE_TYPES = [
  'coding_assessment',
  'technical_quiz',
  'evaluated_project',
  'github_repo',
  'verified_certification',
  'other_reviewed_evidence',
  'certificate',
  'publication',
  'portfolio_link',
  'document',
  'other',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_STATUSES = [
  'submitted',
  'under_review',
  'verified',
  'rejected',
  'needs_additional_evidence',
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export interface IEvidenceAuditEntry {
  fromStatus?: EvidenceStatus;
  toStatus: EvidenceStatus;
  reviewedBy: Types.ObjectId;
  notes?: string;
  reviewedAt: Date;
}

export interface IEvidence extends Document {
  student: Types.ObjectId;
  skills: Types.ObjectId[];
  type: EvidenceType;
  title: string;
  url?: string;
  description?: string;
  status: EvidenceStatus;
  isVerified: boolean;
  score?: number;
  maxScore?: number;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  auditHistory: IEvidenceAuditEntry[];
  verificationSource?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const evidenceAuditEntrySchema = new Schema<IEvidenceAuditEntry>(
  {
    fromStatus: {
      type: String,
      enum: EVIDENCE_STATUSES,
    },
    toStatus: {
      type: String,
      enum: EVIDENCE_STATUSES,
      required: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const evidenceSchema = new Schema<IEvidence>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: [true, 'Student profile reference is required'],
      index: true,
    },
    skills: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Skill',
        index: true,
      },
    ],
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
    status: {
      type: String,
      enum: {
        values: EVIDENCE_STATUSES,
        message: '{VALUE} is not a valid evidence status',
      },
      default: 'submitted',
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    score: {
      type: Number,
      min: [0, 'Score cannot be negative'],
    },
    maxScore: {
      type: Number,
      min: [1, 'Maximum score must be at least 1'],
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
    auditHistory: {
      type: [evidenceAuditEntrySchema],
      default: [],
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

evidenceSchema.index({ student: 1, status: 1 });

export const Evidence: Model<IEvidence> =
  mongoose.models.Evidence || mongoose.model<IEvidence>('Evidence', evidenceSchema);
