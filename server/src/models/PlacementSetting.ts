import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IPlacementSetting extends Document {
  institutionName: string;
  defaultGraduationYear: number;
  minCgpaThreshold: number;
  scoringWeights: {
    requiredSkillWeight: number;
    preferredSkillWeight: number;
    courseworkWeight: number;
    verificationPenalty: number;
  };
  autoArchivePastDeadlines: boolean;
  strictDuplicateRejection: boolean;
  emailAlertsEnabled: boolean;
  evidenceReviewSlaDays: number;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const placementSettingSchema = new Schema<IPlacementSetting>(
  {
    institutionName: {
      type: String,
      default: 'Apex Institute of Technology - Placement Cell',
      trim: true,
    },
    defaultGraduationYear: {
      type: Number,
      default: 2026,
    },
    minCgpaThreshold: {
      type: Number,
      default: 6.0,
      min: 0,
      max: 10,
    },
    scoringWeights: {
      requiredSkillWeight: { type: Number, default: 3.0, min: 0.1, max: 10 },
      preferredSkillWeight: { type: Number, default: 1.0, min: 0.1, max: 10 },
      courseworkWeight: { type: Number, default: 0.5, min: 0, max: 5 },
      verificationPenalty: { type: Number, default: 0.2, min: 0, max: 1 },
    },
    autoArchivePastDeadlines: {
      type: Boolean,
      default: true,
    },
    strictDuplicateRejection: {
      type: Boolean,
      default: true,
    },
    emailAlertsEnabled: {
      type: Boolean,
      default: true,
    },
    evidenceReviewSlaDays: {
      type: Number,
      default: 3,
      min: 1,
      max: 30,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export const PlacementSetting: Model<IPlacementSetting> =
  mongoose.models.PlacementSetting ||
  mongoose.model<IPlacementSetting>('PlacementSetting', placementSettingSchema);

