import mongoose, { Document, Schema, Model } from 'mongoose';

export const JOB_SOURCE_TYPES = [
  'campus_drive',
  'internal_placement',
  'partner_portal',
  'referral',
  'external_aggregated',
] as const;
export type JobSourceType = (typeof JOB_SOURCE_TYPES)[number];

export interface IJobSource extends Document {
  name: string;
  type: JobSourceType;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const jobSourceSchema = new Schema<IJobSource>(
  {
    name: {
      type: String,
      required: [true, 'Job source name is required'],
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: JOB_SOURCE_TYPES,
        message: '{VALUE} is not a valid job source type',
      },
      required: [true, 'Job source type is required'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

jobSourceSchema.index({ name: 1, type: 1 }, { unique: true });

export const JobSource: Model<IJobSource> =
  mongoose.models.JobSource || mongoose.model<IJobSource>('JobSource', jobSourceSchema);
