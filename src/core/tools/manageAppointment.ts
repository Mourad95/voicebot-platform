import mongoose from 'mongoose';

import { Prospect, type IProspectDocument } from '../models/Prospect';
import { Slot } from '../models/Slot';
import {
  resolveAgencyObjectId,
  resolveSlotByUuid,
  findProspectByUuid,
} from '../persistence/resolve-by-uuid';
import { isValidUuid } from '../utils/uuid';
import { logToolEvent } from './tool-log';
import type { ToolFailure, ToolSuccess } from './tool-result.types';
import { toToolError } from './tool-result.types';

const APPOINTMENT_ACTIONS = ['check', 'reschedule', 'cancel'] as const;

type AppointmentAction = (typeof APPOINTMENT_ACTIONS)[number];

export type ManageAppointmentInput = {
  readonly action: string;
  readonly agencyId: string;
  readonly telephone?: string;
  readonly prospectId?: string;
  readonly newSlotId?: string;
};

type SlotInfo = {
  readonly id: string;
  readonly slotTime: string;
};

type ProspectInfo = {
  readonly id: string;
  readonly nom?: string;
  readonly telephone?: string;
  readonly status: string;
  readonly creneauRappel?: string;
};

type CheckFoundResult = ToolSuccess<{
  readonly found: true;
  readonly prospect: ProspectInfo;
  readonly slot: SlotInfo | null;
}>;

type CheckNotFoundResult = ToolSuccess<{
  readonly found: false;
  readonly message: string;
}>;

type RescheduleResult = ToolSuccess<{
  readonly rescheduled: true;
  readonly newSlot: SlotInfo;
}>;

type CancelResult = ToolSuccess<{
  readonly cancelled: true;
}>;

export type ManageAppointmentResult =
  | CheckFoundResult
  | CheckNotFoundResult
  | RescheduleResult
  | CancelResult
  | ToolFailure;

const SLOT_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
};

const dateLabelFormatter = new Intl.DateTimeFormat('fr-FR', SLOT_LABEL_FORMAT);

function formatSlotTime(slotTime: Date): string {
  return dateLabelFormatter.format(slotTime);
}

function isValidAction(action: string): action is AppointmentAction {
  return APPOINTMENT_ACTIONS.includes(action as AppointmentAction);
}

function toProspectInfo(prospect: IProspectDocument): ProspectInfo {
  return {
    id: prospect.uuid,
    nom: prospect.nom,
    telephone: prospect.telephone,
    status: prospect.status,
    creneauRappel: prospect.creneauRappel?.toISOString(),
  };
}

async function handleCheck(
  agencyId: string,
  telephone: string | undefined,
): Promise<ManageAppointmentResult> {
  if (telephone === undefined || telephone.trim() === '') {
    return { success: false, error: 'telephone requis pour action check' };
  }

  if (!isValidUuid(agencyId)) {
    return { success: false, error: 'Invalid agency UUID' };
  }

  const agencyObjectId = await resolveAgencyObjectId(agencyId);

  if (agencyObjectId === null) {
    return { success: false, error: 'Agency not found' };
  }

  const prospect = await Prospect.findOne({
    agencyId: agencyObjectId,
    telephone: telephone.trim(),
    status: { $nin: ['cancelled', 'closed'] },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (prospect === null) {
    logToolEvent('manageAppointment:check: no prospect found', {
      agencyId,
      telephone,
    });

    return {
      success: true,
      found: false,
      message: 'Aucun rendez-vous trouvé pour ce numéro',
    };
  }

  let slotInfo: SlotInfo | null = null;

  if (prospect.slotId !== undefined && prospect.slotId !== null) {
    const slot = await Slot.findById(prospect.slotId)
      .select({ uuid: 1, slotTime: 1 })
      .lean();

    if (slot !== null) {
      slotInfo = {
        id: slot.uuid,
        slotTime: formatSlotTime(slot.slotTime),
      };
    }
  }

  logToolEvent('manageAppointment:check: prospect found', {
    agencyId,
    prospectId: prospect.uuid,
    hasSlot: String(slotInfo !== null),
  });

  return {
    success: true,
    found: true,
    prospect: {
      id: prospect.uuid,
      nom: prospect.nom,
      telephone: prospect.telephone,
      status: prospect.status,
      creneauRappel: prospect.creneauRappel?.toISOString(),
    },
    slot: slotInfo,
  };
}

async function handleReschedule(
  prospectId: string | undefined,
  newSlotId: string | undefined,
): Promise<ManageAppointmentResult> {
  if (prospectId === undefined) {
    return { success: false, error: 'prospectId requis pour action reschedule' };
  }

  if (newSlotId === undefined) {
    return { success: false, error: 'newSlotId requis pour action reschedule' };
  }

  if (!isValidUuid(prospectId) || !isValidUuid(newSlotId)) {
    return { success: false, error: 'Invalid UUID format' };
  }

  const session = await mongoose.startSession();

  try {
    let newSlotInfo: SlotInfo | null = null;

    await session.withTransaction(async () => {
      const prospect = await findProspectByUuid(prospectId);

      if (prospect === null) {
        throw new Error('Prospect not found');
      }

      const agencyObjectId = prospect.agencyId._id;
      const oldSlotId = prospect.slotId;

      const newSlot = await resolveSlotByUuid({
        slotUuid: newSlotId,
        agencyObjectId,
      });

      if (newSlot === null) {
        throw new Error('Nouveau créneau non disponible');
      }

      if (oldSlotId !== undefined && oldSlotId !== null) {
        await Slot.updateOne(
          { _id: oldSlotId },
          { isAvailable: true, prospectId: null },
          { session },
        );
      }

      await Slot.updateOne(
        { _id: newSlot._id, isAvailable: true },
        { isAvailable: false, prospectId: prospect._id },
        { session },
      );

      await Prospect.updateOne(
        { _id: prospect._id },
        { slotId: newSlot._id, status: 'callback_scheduled' },
        { session },
      );

      const updatedSlot = await Slot.findById(newSlot._id)
        .select({ uuid: 1, slotTime: 1 })
        .lean();

      if (updatedSlot === null) {
        throw new Error('Failed to retrieve updated slot');
      }

      newSlotInfo = {
        id: updatedSlot.uuid,
        slotTime: formatSlotTime(updatedSlot.slotTime),
      };
    });

    if (newSlotInfo === null) {
      return { success: false, error: 'Transaction failed' };
    }

    logToolEvent('manageAppointment:reschedule: success', {
      prospectId,
      newSlotId,
    });

    return {
      success: true,
      rescheduled: true,
      newSlot: newSlotInfo,
    };
  } catch (error: unknown) {
    return { success: false, error: toToolError(error) };
  } finally {
    await session.endSession();
  }
}

async function handleCancel(
  prospectId: string | undefined,
): Promise<ManageAppointmentResult> {
  if (prospectId === undefined) {
    return { success: false, error: 'prospectId requis pour action cancel' };
  }

  if (!isValidUuid(prospectId)) {
    return { success: false, error: 'Invalid prospect UUID' };
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const prospect = await findProspectByUuid(prospectId);

      if (prospect === null) {
        throw new Error('Prospect not found');
      }

      if (prospect.slotId !== undefined && prospect.slotId !== null) {
        await Slot.updateOne(
          { _id: prospect.slotId },
          { isAvailable: true, prospectId: null },
          { session },
        );
      }

      await Prospect.updateOne(
        { _id: prospect._id },
        { status: 'cancelled', slotId: null },
        { session },
      );
    });

    logToolEvent('manageAppointment:cancel: success', { prospectId });

    return { success: true, cancelled: true };
  } catch (error: unknown) {
    return { success: false, error: toToolError(error) };
  } finally {
    await session.endSession();
  }
}

export async function manageAppointment(
  input: ManageAppointmentInput,
): Promise<ManageAppointmentResult> {
  const { action, agencyId, telephone, prospectId, newSlotId } = input;

  if (!isValidAction(action)) {
    return {
      success: false,
      error: `Action invalide. Valeurs possibles: ${APPOINTMENT_ACTIONS.join(', ')}`,
    };
  }

  switch (action) {
    case 'check':
      return handleCheck(agencyId, telephone);

    case 'reschedule':
      return handleReschedule(prospectId, newSlotId);

    case 'cancel':
      return handleCancel(prospectId);
  }
}
