import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { APPLICATION_STATUSES, ApplicationStatus } from './Application';

export interface IApplicationStatusHistory extends Document {
  application: Types.ObjectId;
  fromStatus?: ApplicationStatus;
  toStatus: ApplicationStatus;
  changedBy: Types.ObjectId;
  notes?: string;
  changedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
    },
    toStatus: {
      type: String,
      enum: {
        values: APPLICATION_STATUSES,
        message: '{VALUE} is not a valid toStatus',
      },
      required: [true, 'toStatus is required'],
      index: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Changed-by user reference is required'],
      index: true,
    },
    notes: {
      type: String,
      trim: true,
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
