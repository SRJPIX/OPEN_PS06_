import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IEducationEntry {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  scoreOrCgpa?: string;
}

export interface IStudentProfile extends Document {
  user: Types.ObjectId;
  rollNumber: string;
  department: string; // Branch / Department
  degree: string;
  graduationYear: number;
  cgpa: number;
  phone?: string;
  bio?: string;
  education?: IEducationEntry[];
  links: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const educationEntrySchema = new Schema<IEducationEntry>(
  {
    institution: { type: String, required: true, trim: true },
    degree: { type: String, required: true, trim: true },
    fieldOfStudy: { type: String, trim: true },
    startYear: { type: Number },
    endYear: { type: Number },
    scoreOrCgpa: { type: String, trim: true },
  },
  { _id: false }
);

const studentProfileSchema = new Schema<IStudentProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    department: {
      type: String,
      required: [true, 'Department (branch) is required'],
      trim: true,
      index: true,
    },
    degree: {
      type: String,
      required: [true, 'Degree program is required'],
      trim: true,
    },
    graduationYear: {
      type: Number,
      required: [true, 'Graduation year is required'],
      min: [2000, 'Graduation year cannot be earlier than 2000'],
      max: [2100, 'Graduation year cannot exceed 2100'],
      index: true,
    },
    cgpa: {
      type: Number,
      required: [true, 'CGPA is required'],
      min: [0, 'CGPA cannot be negative'],
      max: [10, 'CGPA cannot exceed 10.0'],
    },
    phone: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
      trim: true,
    },
    education: {
      type: [educationEntrySchema],
      default: [],
    },
    links: {
      github: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      portfolio: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

export const StudentProfile: Model<IStudentProfile> =
  mongoose.models.StudentProfile ||
  mongoose.model<IStudentProfile>('StudentProfile', studentProfileSchema);
