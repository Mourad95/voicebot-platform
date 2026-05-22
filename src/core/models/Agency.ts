import crypto from 'node:crypto';

import { Schema, model, type Document, type Model, type Types } from 'mongoose';

import {
  SECTOR_NAMES,
  type BusinessHours,
  type SectorName,
} from '../../types/sector.types';

export interface IAgency {
  readonly uuid: string;
  readonly name: string;
  readonly address?: string;
  readonly phone?: string;
  readonly agentName: string;
  readonly agentPhone: string;
  readonly retellAgentId?: string;
  readonly sector: SectorName;
  readonly businessHours?: BusinessHours;
  readonly isActive: boolean;
}

export interface IAgencyDocument extends IAgency, Document {
  readonly _id: Types.ObjectId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const agencySchema = new Schema<IAgencyDocument>(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
      index: true,
    },
    name: { type: String, required: true },
    address: { type: String, required: false },
    phone: { type: String, required: false },
    agentName: { type: String, required: true },
    agentPhone: { type: String, required: true },
    retellAgentId: { type: String, required: false },
    sector: {
      type: String,
      required: true,
      default: 'immo',
      enum: SECTOR_NAMES,
    },
    businessHours: { type: Schema.Types.Mixed, required: false },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    strict: 'throw',
  },
);

export const Agency: Model<IAgencyDocument> = model<IAgencyDocument>(
  'Agency',
  agencySchema,
);
