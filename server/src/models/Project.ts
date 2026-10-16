import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IProject extends Document {
  student: Types.ObjectId;
  title: string;
  description: string;
  skills: Types.ObjectId[];
  repoUrl?: string;
  liveUrl?: string;
  startDate?: Date;
  endDate?: Date;
  isOngoing: boolean;
  evidence: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: [true, 'Student reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true,
    },
    skills: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Skill',
        index: true,
      },
    ],
    repoUrl: {
      type: String,
      trim: true,
    },
    liveUrl: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isOngoing: {
      type: Boolean,
      default: false,
    },
    evidence: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Evidence',
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>('Project', projectSchema);
