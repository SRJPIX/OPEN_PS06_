import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const ASSESSMENT_PROVIDERS = ['internal', 'hackerrank', 'leetcode', 'custom'] as const;
export type AssessmentProvider = (typeof ASSESSMENT_PROVIDERS)[number];

export interface IAssessment extends Document {
  student: Types.ObjectId;
  skill?: Types.ObjectId;
  title: string;
  provider: AssessmentProvider;
  score: number;
  maxScore: number;
  passed: boolean;
  takenAt: Date;
  certificateUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentSchema = new Schema<IAssessment>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: [true, 'Student reference is required'],
      index: true,
    },
    skill: {
      type: Schema.Types.ObjectId,
      ref: 'Skill',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Assessment title is required'],
      trim: true,
    },
    provider: {
      type: String,
      enum: {
        values: ASSESSMENT_PROVIDERS,
        message: '{VALUE} is not a valid assessment provider',
      },
      default: 'internal',
      index: true,
    },
    score: {
      type: Number,
      required: [true, 'Score is required'],
      min: [0, 'Score cannot be negative'],
    },
    maxScore: {
      type: Number,
      required: [true, 'Maximum score is required'],
      min: [1, 'Maximum score must be at least 1'],
    },
    passed: {
      type: Boolean,
      required: [true, 'Passed boolean status is required'],
      index: true,
    },
    takenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    certificateUrl: {
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

export const Assessment: Model<IAssessment> =
  mongoose.models.Assessment || mongoose.model<IAssessment>('Assessment', assessmentSchema);
