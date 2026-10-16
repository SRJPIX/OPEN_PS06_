import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICompany extends Document {
  name: string;
  website?: string;
  industry: string;
  description?: string;
  logoUrl?: string;
  isVerified: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      unique: true,
      trim: true,
      index: true,
    },
    website: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      required: [true, 'Industry classification is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Company creator user reference is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Company: Model<ICompany> =
  mongoose.models.Company || mongoose.model<ICompany>('Company', companySchema);
