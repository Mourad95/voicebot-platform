import crypto from 'node:crypto';

import { Schema, model, type Document, type Model, type Types } from 'mongoose';

import { LEAD_STATUSES, type LeadStatus } from '../../types/lead.types';

export type ProspectStatus = LeadStatus;

export interface IProspect {
  readonly uuid: string;
  readonly agencyId: Types.ObjectId;
  readonly nom?: string;
  readonly telephone?: string;
  readonly qualificationData: Map<string, string>;
  readonly creneauRappel?: Date;
  readonly slotId?: Types.ObjectId;
  readonly status: ProspectStatus;
  readonly callId?: string;
  readonly rawTranscript?: string;
  readonly resume?: string;
}

export interface IProspectDocument extends IProspect, Document {
  readonly _id: Types.ObjectId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const prospectSchema = new Schema<IProspectDocument>(
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
    nom: { type: String, required: false },
    telephone: { type: String, required: false },
    qualificationData: {
      type: Map,
      of: String,
      default: () => new Map<string, string>(),
    },
    creneauRappel: { type: Date, required: false },
    slotId: {
      type: Schema.Types.ObjectId,
      ref: 'Slot',
      required: false,
    },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: 'new',
    },
    callId: { type: String, required: false },
    rawTranscript: { type: String, required: false },
    resume: { type: String, required: false },
  },
  {
    timestamps: true,
    strict: 'throw',
  },
);

prospectSchema.index({ agencyId: 1, status: 1 });
prospectSchema.index({ agencyId: 1, telephone: 1 });

export const Prospect: Model<IProspectDocument> = model<IProspectDocument>(
  'Prospect',
  prospectSchema,
);
