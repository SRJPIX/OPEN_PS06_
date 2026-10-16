import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
  IInterviewDetails,
  IOfferDetails,
  normalizeStatusString,
} from './Application';

export interface IApplicationStatusHistory extends Document {
  application: Types.ObjectId;
  fromStatus?: ApplicationStatus;
  toStatus: ApplicationStatus;
  changedBy: Types.ObjectId;
  changedByRole?: string;
  notes?: string;
  interviewDetails?: IInterviewDetails;
  offerDetails?: IOfferDetails;
  changedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const interviewDetailsSchema = new Schema<IInterviewDetails>(
  {
    round: { type: Schema.Types.Mixed },
    interviewType: {
      type: String,
      enum: ['technical', 'hr', 'managerial', 'coding', 'system_design', 'other'],
      default: 'technical',
    },
    scheduledAt: { type: Date },
    location: { type: String, trim: true },
    meetingLink: { type: String, trim: true },
    interviewerName: { type: String, trim: true },
    interviewerEmail: { type: String, trim: true },
    notes: { type: String, trim: true },
    feedback: { type: String, trim: true },
  },
  { _id: false }
);

const offerDetailsSchema = new Schema<IOfferDetails>(
  {
    offeredCtc: { type: Number, min: 0 },
    currency: { type: String, default: 'INR', trim: true },
    baseSalary: { type: Number, min: 0 },
    bonus: { type: Number, min: 0 },
    designation: { type: String, trim: true },
    joiningDate: { type: Date },
    deadline: { type: Date },
    offerLetterUrl: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const applicationStatusHistorySchema = new Schema<IApplicationStatusHistory>(
  {
    application: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required'],
      index: true,
    },
    fromStatus: {
      type: String,
      enum: {
        values: APPLICATION_STATUSES,
        message: '{VALUE} is not a valid fromStatus',
      },
      set: normalizeStatusString,
    },
    toStatus: {
      type: String,
      enum: {
        values: APPLICATION_STATUSES,
        message: '{VALUE} is not a valid toStatus',
      },
      required: [true, 'toStatus is required'],
      set: normalizeStatusString,
      index: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Changed-by user reference is required'],
      index: true,
    },
    changedByRole: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    interviewDetails: {
      type: interviewDetailsSchema,
    },
    offerDetails: {
      type: offerDetailsSchema,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

applicationStatusHistorySchema.index({ application: 1, changedAt: -1 });

export const ApplicationStatusHistory: Model<IApplicationStatusHistory> =
  mongoose.models.ApplicationStatusHistory ||
  mongoose.model<IApplicationStatusHistory>(
    'ApplicationStatusHistory',
    applicationStatusHistorySchema
  );
