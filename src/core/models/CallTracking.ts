import { Schema, model, type Document, type Model } from 'mongoose';

const CALL_TRACKING_TTL_SECONDS = 60 * 60 * 25; // 25h : couvre la fenêtre journalière + marge

export interface ICallTracking {
  readonly callId: string;
  readonly callerPhone: string;
  readonly startedAt: Date;
  readonly endedAt?: Date;
}

export interface ICallTrackingDocument extends ICallTracking, Document {
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const callTrackingSchema = new Schema<ICallTrackingDocument>(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    callerPhone: { type: String, required: true },
    startedAt: { type: Date, required: true, default: () => new Date() },
    endedAt: { type: Date, required: false },
  },
  {
    timestamps: true,
    strict: 'throw',
  },
);

// Purge automatique des documents anciens (les compteurs ne portent que sur la journée glissante)
callTrackingSchema.index({ startedAt: 1 }, { expireAfterSeconds: CALL_TRACKING_TTL_SECONDS });
// Compteurs par numéro sur fenêtre temporelle
callTrackingSchema.index({ callerPhone: 1, startedAt: 1 });
// Comptage des appels actifs (endedAt absent)
callTrackingSchema.index({ endedAt: 1 });

export const CallTracking: Model<ICallTrackingDocument> = model<ICallTrackingDocument>(
  'CallTracking',
  callTrackingSchema,
);
