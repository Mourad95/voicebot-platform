import { Types } from 'mongoose';

declare const process: {
  readonly stdout: { write(chunk: string): void };
};

import { Slot } from '../models/Slot';

type ToolFailure = { readonly success: false; readonly error: string };

type GetAvailableSlotsSuccess =
  | {
      readonly success: true;
      readonly available: false;
      readonly message: string;
    }
  | {
      readonly success: true;
      readonly available: true;
      readonly slots: ReadonlyArray<{ readonly id: string; readonly label: string }>;
    };

export type GetAvailableSlotsResult = GetAvailableSlotsSuccess | ToolFailure;

const SLOT_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
};

const dateLabelFormatter = new Intl.DateTimeFormat('fr-FR', SLOT_LABEL_FORMAT);

function logEvent(message: string, meta?: Record<string, string | undefined>): void {
  process.stdout.write(
    `${JSON.stringify({ level: 'info', message, ...meta, ts: new Date().toISOString() })}\n`,
  );
}

function formatSlotLabel(slotTime: Date): string {
  return dateLabelFormatter.format(slotTime);
}

function isValidObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value) && new Types.ObjectId(value).toString() === value;
}

export async function getAvailableSlots(input: {
  readonly agencyId: string;
}): Promise<GetAvailableSlotsResult> {
  try {
    if (!isValidObjectId(input.agencyId)) {
      return { success: false, error: 'Invalid agencyId' };
    }

    const agencyObjectId = new Types.ObjectId(input.agencyId);
    const slots = await Slot.find({
      agencyId: agencyObjectId,
      isAvailable: true,
      slotTime: { $gt: new Date() },
    })
      .sort({ slotTime: 1 })
      .limit(3)
      .select({ _id: 1, slotTime: 1 })
      .lean();

    if (slots.length === 0) {
      logEvent('getAvailableSlots: no slots found', { agencyId: input.agencyId });
      return {
        success: true,
        available: false,
        message: 'Aucun créneau disponible',
      };
    }

    logEvent('getAvailableSlots: slots found', {
      agencyId: input.agencyId,
      count: String(slots.length),
    });

    return {
      success: true,
      available: true,
      slots: slots.map((slot) => ({
        id: slot._id.toString(),
        label: formatSlotLabel(slot.slotTime),
      })),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
