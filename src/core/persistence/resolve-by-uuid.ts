import type { Types } from 'mongoose';

import type { IAgencyDocument } from '../models/Agency';
import { Agency } from '../models/Agency';
import { Prospect } from '../models/Prospect';
import { Slot } from '../models/Slot';
import { isValidUuid } from '../utils/uuid';

export async function resolveAgencyObjectId(
  agencyUuid: string,
): Promise<Types.ObjectId | null> {
  if (!isValidUuid(agencyUuid)) {
    return null;
  }

  const agency = await Agency.findOne({ uuid: agencyUuid }).select({ _id: 1 }).lean();

  return agency?._id ?? null;
}

export async function resolveSlotByUuid(params: {
  readonly slotUuid: string;
  readonly agencyObjectId: Types.ObjectId;
}): Promise<{ readonly _id: Types.ObjectId } | null> {
  if (!isValidUuid(params.slotUuid)) {
    return null;
  }

  const slot = await Slot.findOne({
    uuid: params.slotUuid,
    agencyId: params.agencyObjectId,
  })
    .select({ _id: 1 })
    .lean();

  return slot ?? null;
}

export async function findProspectByUuid(prospectUuid: string) {
  if (!isValidUuid(prospectUuid)) {
    return null;
  }

  return Prospect.findOne({ uuid: prospectUuid }).populate<{
    agencyId: IAgencyDocument;
  }>('agencyId');
}
