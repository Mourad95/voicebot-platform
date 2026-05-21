import mongoose, { type Types } from 'mongoose';

import { Prospect } from '../models/Prospect';
import { Slot } from '../models/Slot';
import {
  resolveAgencyObjectId,
  resolveSlotByUuid,
} from '../persistence/resolve-by-uuid';
import { isValidUuid } from '../utils/uuid';
import { logToolEvent } from './tool-log';
import type { ToolResult } from './tool-result.types';
import { toToolError } from './tool-result.types';

export type SaveProspectResult = ToolResult<{ readonly prospectId: string }>;

export type SaveProspectInput = {
  readonly agencyId: string;
  readonly nom?: string;
  readonly telephone?: string;
  readonly qualificationData: Record<string, string>;
  readonly slotId?: string;
  readonly creneauRappel?: string;
  readonly callId?: string;
};

function parseCreneauRappel(value: string | undefined): Date | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid creneauRappel date');
  }

  return parsed;
}

function toQualificationMap(data: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(data));
}

export async function saveProspect(
  input: SaveProspectInput,
): Promise<SaveProspectResult> {
  const session = await mongoose.startSession();

  try {
    if (!isValidUuid(input.agencyId)) {
      return { success: false, error: 'Invalid agency UUID' };
    }

    if (input.slotId !== undefined && !isValidUuid(input.slotId)) {
      return { success: false, error: 'Invalid slot UUID' };
    }

    const agencyObjectId = await resolveAgencyObjectId(input.agencyId);

    if (agencyObjectId === null) {
      return { success: false, error: 'Agency not found' };
    }

    const creneauRappel = parseCreneauRappel(input.creneauRappel);
    let prospectUuid = '';

    await session.withTransaction(async () => {
      let slotObjectId: Types.ObjectId | undefined;

      if (input.slotId !== undefined) {
        const slot = await resolveSlotByUuid({
          slotUuid: input.slotId,
          agencyObjectId,
        });

        if (slot === null) {
          throw new Error('Slot not available or not found');
        }

        slotObjectId = slot._id;
      }

      const [prospect] = await Prospect.create(
        [
          {
            agencyId: agencyObjectId,
            nom: input.nom,
            telephone: input.telephone,
            qualificationData: toQualificationMap(input.qualificationData),
            creneauRappel,
            slotId: slotObjectId,
            callId: input.callId,
          },
        ],
        { session },
      );

      prospectUuid = prospect.uuid;

      if (input.slotId !== undefined && slotObjectId !== undefined) {
        const slot = await Slot.findOneAndUpdate(
          {
            _id: slotObjectId,
            agencyId: agencyObjectId,
            isAvailable: true,
          },
          {
            isAvailable: false,
            prospectId: prospect._id,
          },
          { session, new: true },
        );

        if (slot === null) {
          throw new Error('Slot not available or not found');
        }
      }
    });

    logToolEvent('saveProspect: prospect created', {
      agencyId: input.agencyId,
      prospectId: prospectUuid,
      slotId: input.slotId,
    });

    return { success: true, prospectId: prospectUuid };
  } catch (error: unknown) {
    return { success: false, error: toToolError(error) };
  } finally {
    await session.endSession();
  }
}
