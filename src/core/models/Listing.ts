import crypto from 'node:crypto';

import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export interface IListing {
  readonly uuid: string;
  readonly agencyId: Types.ObjectId;
  readonly reference: string;
  readonly type: string;
  readonly city: string;
  readonly price: number;
  readonly surface: number;
  readonly surfaceTerrain?: number;
  readonly rooms: number;
  readonly bedrooms?: number;
  readonly description: string;
  readonly features: string[];
  readonly isActive: boolean;
}

export interface IListingDocument extends IListing, Document {
  readonly _id: Types.ObjectId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const listingSchema = new Schema<IListingDocument>(
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
    reference: {
      type: String,
      required: true,
      index: true,
    },
    type: { type: String, required: true },
    city: { type: String, required: true },
    price: { type: Number, required: true },
    surface: { type: Number, required: true },
    surfaceTerrain: { type: Number, required: false },
    rooms: { type: Number, required: true },
    bedrooms: { type: Number, required: false },
    description: { type: String, required: true },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    strict: 'throw',
  },
);

listingSchema.index({ agencyId: 1, reference: 1 }, { unique: true });

export const Listing: Model<IListingDocument> = model<IListingDocument>(
  'Listing',
  listingSchema,
);
