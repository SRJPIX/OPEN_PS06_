import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export const SKILL_PROFICIENCIES = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export type SkillProficiency = (typeof SKILL_PROFICIENCIES)[number];

export const SKILL_VERIFICATION_STATUSES = [
  'self_reported',
  'submitted',
  'under_review',
  'verified',
  'rejected',
  'needs_additional_evidence',
] as const;
export type SkillVerificationStatus = (typeof SKILL_VERIFICATION_STATUSES)[number];

export interface IStudentSkill extends Document {
  student: Types.ObjectId;
  skill: Types.ObjectId;
  proficiency: SkillProficiency;
  status: SkillVerificationStatus;
  isVerified: boolean;
  confidenceScore: number;
  evidence: Types.ObjectId[];
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const studentSkillSchema = new Schema<IStudentSkill>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: [true, 'Student profile reference is required'],
      index: true,
    },
    skill: {
      type: Schema.Types.ObjectId,
      ref: 'Skill',
      required: [true, 'Skill reference is required'],
      index: true,
    },
    proficiency: {
      type: String,
      enum: {
        values: SKILL_PROFICIENCIES,
        message: '{VALUE} is not a valid skill proficiency',
      },
      default: 'intermediate',
    },
    status: {
      type: String,
      enum: {
        values: SKILL_VERIFICATION_STATUSES,
        message: '{VALUE} is not a valid skill verification status',
      },
      default: 'self_reported',
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    confidenceScore: {
      type: Number,
      min: [0, 'Confidence score cannot be less than 0'],
      max: [100, 'Confidence score cannot exceed 100'],
      default: 0,
    },
    evidence: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Evidence',
      },
    ],
    verifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee a student only has one record per skill
studentSkillSchema.index({ student: 1, skill: 1 }, { unique: true });
studentSkillSchema.index({ student: 1, status: 1 });

export const StudentSkill: Model<IStudentSkill> =
  mongoose.models.StudentSkill || mongoose.model<IStudentSkill>('StudentSkill', studentSkillSchema);
