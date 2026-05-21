import mongoose, { Types } from 'mongoose';

import { Prospect } from '../models/Prospect';
import { Slot } from '../models/Slot';
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

function isValidObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value) && new Types.ObjectId(value).toString() === value;
}

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
    if (!isValidObjectId(input.agencyId)) {
      return { success: false, error: 'Invalid agencyId' };
    }

    if (input.slotId !== undefined && !isValidObjectId(input.slotId)) {
      return { success: false, error: 'Invalid slotId' };
    }

    const agencyObjectId = new Types.ObjectId(input.agencyId);
    const creneauRappel = parseCreneauRappel(input.creneauRappel);
    let prospectId = '';

    await session.withTransaction(async () => {
      const [prospect] = await Prospect.create(
        [
          {
            agencyId: agencyObjectId,
            nom: input.nom,
            telephone: input.telephone,
            qualificationData: toQualificationMap(input.qualificationData),
            creneauRappel,
            slotId:
              input.slotId !== undefined ? new Types.ObjectId(input.slotId) : undefined,
            callId: input.callId,
          },
        ],
        { session },
      );

      prospectId = prospect._id.toString();

      if (input.slotId !== undefined) {
        const slot = await Slot.findOneAndUpdate(
          {
            _id: new Types.ObjectId(input.slotId),
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
      prospectId,
      slotId: input.slotId,
    });

    return { success: true, prospectId };
  } catch (error: unknown) {
    return { success: false, error: toToolError(error) };
  } finally {
    await session.endSession();
  }
}
