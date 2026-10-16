import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAlumniProfile extends Document {
  user?: Types.ObjectId;
  fullName: string;
  email: string;
  graduationYear: number;
  degree: string;
  department: string;
  companyName: string;
  company?: Types.ObjectId;
  designation: string;
  experienceYears: number;
  location?: string;
  linkedinUrl?: string;
  referralAvailable: boolean;
  maxReferralsPerMonth: number;
  activeReferralsCount: number;
  preferredSkills: string[];
  referralGuidelines?: string;
  isVerified: boolean;
  verifiedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const alumniProfileSchema = new Schema<IAlumniProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    graduationYear: { type: Number, required: true },
    degree: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company' },
    designation: { type: String, required: true, trim: true },
    experienceYears: { type: Number, default: 1, min: 0 },
    location: { type: String, trim: true },
    linkedinUrl: { type: String, trim: true },
    referralAvailable: { type: Boolean, default: true },
    maxReferralsPerMonth: { type: Number, default: 3, min: 1 },
    activeReferralsCount: { type: Number, default: 0, min: 0 },
    preferredSkills: [{ type: String, trim: true }],
    referralGuidelines: { type: String, trim: true },
    isVerified: { type: Boolean, default: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

alumniProfileSchema.index({ companyName: 1 });
alumniProfileSchema.index({ department: 1, graduationYear: 1 });
alumniProfileSchema.index({ referralAvailable: 1, isVerified: 1 });

export const AlumniProfile = mongoose.model<IAlumniProfile>('AlumniProfile', alumniProfileSchema);
export default AlumniProfile;

