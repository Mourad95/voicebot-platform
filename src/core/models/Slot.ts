import crypto from 'node:crypto';

import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export interface ISlot {
  readonly uuid: string;
  readonly agencyId: Types.ObjectId;
  readonly slotTime: Date;
  readonly isAvailable: boolean;
  readonly prospectId?: Types.ObjectId | null;
}

export interface ISlotDocument extends ISlot, Document {
  readonly _id: Types.ObjectId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const slotSchema = new Schema<ISlotDocument>(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
      index: true,
    },
    agencyId: {
      type: Schema.Types.ObjectId,
      ref: 'Agency',
      required: true,
    },
    slotTime: { type: Date, required: true },
    isAvailable: { type: Boolean, default: true },
    prospectId: {
      type: Schema.Types.ObjectId,
      ref: 'Prospect',
      required: false,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: 'throw',
  },
);

slotSchema.index({ agencyId: 1, slotTime: 1, isAvailable: 1 });

export const Slot: Model<ISlotDocument> = model<ISlotDocument>(
  'Slot',
  slotSchema,
);
