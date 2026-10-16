import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInterviewQuestion {
  question: string;
  topic: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tips?: string;
  codeSnippet?: string;
}

export interface IInterviewRound {
  roundNumber: number;
  roundName: string;
  durationMinutes?: number;
  questions: IInterviewQuestion[];
}

export interface IInterviewReport extends Document {
  student: Types.ObjectId;
  companyName: string;
  company?: Types.ObjectId;
  role: string;
  driveYear: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'challenging';
  outcome: 'offered' | 'rejected' | 'opted_out' | 'pending';
  rounds: IInterviewRound[];
  overallExperience: string;
  preparationTips?: string;
  isAnonymous: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  moderationNotes?: string;
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  upvotesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const interviewQuestionSchema = new Schema<IInterviewQuestion>(
  {
    question: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    tips: { type: String, trim: true },
    codeSnippet: { type: String },
  },
  { _id: false }
);

const interviewRoundSchema = new Schema<IInterviewRound>(
  {
    roundNumber: { type: Number, required: true },
    roundName: { type: String, required: true, trim: true },
    durationMinutes: { type: Number },
    questions: [interviewQuestionSchema],
  },
  { _id: false }
);

const interviewReportSchema = new Schema<IInterviewReport>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyName: { type: String, required: true, trim: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company' },
    role: { type: String, required: true, trim: true },
    driveYear: { type: Number, required: true, default: 2026 },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'challenging'],
      default: 'medium',
    },
    outcome: {
      type: String,
      enum: ['offered', 'rejected', 'opted_out', 'pending'],
      default: 'offered',
    },
    rounds: [interviewRoundSchema],
    overallExperience: { type: String, required: true, trim: true },
    preparationTips: { type: String, trim: true },
    isAnonymous: { type: Boolean, default: false },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved', // seeded or default approved, can be pending for new submissions
    },
    moderationNotes: { type: String, trim: true },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    upvotesCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

interviewReportSchema.index({ companyName: 1, moderationStatus: 1 });
interviewReportSchema.index({ role: 1 });
interviewReportSchema.index({ driveYear: -1 });

export const InterviewReport = mongoose.model<IInterviewReport>('InterviewReport', interviewReportSchema);
export default InterviewReport;

