import mongoose, { Document, Schema, Model } from 'mongoose';

export const SKILL_CATEGORIES = [
  'frontend',
  'backend',
  'fullstack',
  'database',
  'devops',
  'cloud',
  'ai_ml',
  'mobile',
  'cybersecurity',
  'soft_skills',
  'other',
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export interface ISkill extends Document {
  name: string;
  category: SkillCategory;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const skillSchema = new Schema<ISkill>(
  {
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    category: {
      type: String,
      enum: {
        values: SKILL_CATEGORIES,
        message: '{VALUE} is not a valid skill category',
      },
      default: 'other',
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Skill: Model<ISkill> =
  mongoose.models.Skill || mongoose.model<ISkill>('Skill', skillSchema);
