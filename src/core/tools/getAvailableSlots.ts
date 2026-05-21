import { Slot } from '../models/Slot';
import {
  resolveAgencyObjectId,
} from '../persistence/resolve-by-uuid';
import { isValidUuid } from '../utils/uuid';
import { logToolEvent } from './tool-log';
import type { ToolFailure, ToolSuccess } from './tool-result.types';
import { toToolError } from './tool-result.types';

type SlotOption = { readonly id: string; readonly label: string };

type SlotsUnavailable = ToolSuccess<{
  readonly available: false;
  readonly message: string;
}>;

type SlotsAvailable = ToolSuccess<{
  readonly available: true;
  readonly slots: ReadonlyArray<SlotOption>;
}>;

export type GetAvailableSlotsResult = SlotsUnavailable | SlotsAvailable | ToolFailure;

const SLOT_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
};

const dateLabelFormatter = new Intl.DateTimeFormat('fr-FR', SLOT_LABEL_FORMAT);

function formatSlotLabel(slotTime: Date): string {
  return dateLabelFormatter.format(slotTime);
}

export async function getAvailableSlots(input: {
  readonly agencyId: string;
}): Promise<GetAvailableSlotsResult> {
  try {
    if (!isValidUuid(input.agencyId)) {
      return { success: false, error: 'Invalid agency UUID' };
    }

    const agencyObjectId = await resolveAgencyObjectId(input.agencyId);

    if (agencyObjectId === null) {
      return { success: false, error: 'Agency not found' };
    }

    const slots = await Slot.find({
      agencyId: agencyObjectId,
      isAvailable: true,
      slotTime: { $gt: new Date() },
    })
      .sort({ slotTime: 1 })
      .limit(3)
      .select({ uuid: 1, slotTime: 1 })
      .lean();

    if (slots.length === 0) {
      logToolEvent('getAvailableSlots: no slots found', { agencyId: input.agencyId });
      return {
        success: true,
        available: false,
        message: 'Aucun créneau disponible',
      };
    }

    logToolEvent('getAvailableSlots: slots found', {
      agencyId: input.agencyId,
      count: String(slots.length),
    });

    return {
      success: true,
      available: true,
      slots: slots.map((slot) => ({
        id: slot.uuid,
        label: formatSlotLabel(slot.slotTime),
      })),
    };
  } catch (error: unknown) {
    return { success: false, error: toToolError(error) };
  }
}
