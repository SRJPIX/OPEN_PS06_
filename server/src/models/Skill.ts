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
  slug: string;
  category: SkillCategory;
  aliases: string[];
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
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'Skill slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      default: function (this: ISkill) {
        return this.name
          ? this.name
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '')
          : undefined;
      },
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
    aliases: {
      type: [String],
      default: [],
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
