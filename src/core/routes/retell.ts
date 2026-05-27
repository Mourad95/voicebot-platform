import { Router, type Request, type Response } from 'express';

import { getAvailableSlots } from '../tools/getAvailableSlots';
import { logToolEvent } from '../tools/tool-log';
import {
  manageAppointment,
  type ManageAppointmentInput,
} from '../tools/manageAppointment';
import { isPriority, notifyAgent } from '../tools/notifyAgent';
import { saveProspect, type SaveProspectInput } from '../tools/saveProspect';
import { saveSummary } from '../tools/saveSummary';
import type { ToolResult } from '../tools/tool-result.types';
import { toToolError } from '../tools/tool-result.types';

export interface RetellToolCall {
  readonly tool_name: string;
  readonly args: Record<string, unknown>;
  readonly call_id?: string;
}

type RetellToolResponse = { readonly result: ToolResult };

const retellRouter = Router();

function isRetellToolCall(body: unknown): body is RetellToolCall {
  return (
    typeof body === 'object' &&
    body !== null &&
    'tool_name' in body &&
    typeof body.tool_name === 'string' &&
    'args' in body &&
    typeof body.args === 'object' &&
    body.args !== null
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function parseQualificationData(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  return Object.fromEntries(entries);
}

function parseSaveProspectInput(
  args: Record<string, unknown>,
  callId?: string,
): SaveProspectInput | null {
  const agencyId = asString(args.agencyId);

  if (agencyId === undefined) {
    return null;
  }

  return {
    agencyId,
    nom: asString(args.nom),
    telephone: asString(args.telephone),
    qualificationData: parseQualificationData(args.qualificationData),
    slotId: asString(args.slotId),
    creneauRappel: asString(args.creneauRappel),
    callId: asString(args.callId) ?? callId,
  };
}

async function dispatchToolCall(
  body: RetellToolCall,
): Promise<ToolResult> {
  const { tool_name: toolName, args, call_id: callId } = body;

  switch (toolName) {
    case 'get_available_slots': {
      const agencyId = asString(args.agencyId);

      if (agencyId === undefined) {
        return { success: false, error: 'Missing agencyId in args' };
      }

      return getAvailableSlots({ agencyId });
    }

    case 'save_prospect': {
      const input = parseSaveProspectInput(args, callId);

      if (input === null) {
        return { success: false, error: 'Missing agencyId in args' };
      }

      return saveProspect(input);
    }

    case 'notify_agent': {
      const prospectId = asString(args.prospectId);
      const priority = args.priority;
      logToolEvent('notify_agent: args received', {
        prospectId: String(args.prospectId ?? ''),
        priority: String(priority ?? ''),
        agentPhone: String(args.agentPhone ?? '<not sent>'),
      });

      if (prospectId === undefined) {
        return { success: false, error: 'Missing prospectId in args' };
      }

      if (!isPriority(priority)) {
        return { success: false, error: 'Invalid or missing priority (expected haute|moyenne|basse)' };
      }

      return notifyAgent({ prospectId, priority, agentPhone: asString(args.agentPhone) });
    }

    case 'manage_appointment': {
      const agencyId = asString(args.agencyId);
      const action = asString(args.action);

      if (agencyId === undefined) {
        return { success: false, error: 'Missing agencyId in args' };
      }

      if (action === undefined) {
        return { success: false, error: 'Missing action in args' };
      }

      const input: ManageAppointmentInput = {
        action,
        agencyId,
        telephone: asString(args.telephone),
        prospectId: asString(args.prospectId),
        newSlotId: asString(args.newSlotId),
      };

      return manageAppointment(input);
    }

    case 'save_summary': {
      const prospectId = asString(args.prospectId);
      const resume = asString(args.resume);
      logToolEvent('save_summary: args received', {
        prospectId: String(args.prospectId ?? ''),
        resumeLength: String(typeof args.resume === 'string' ? args.resume.length : -1),
      });

      if (prospectId === undefined) {
        return { success: false, error: 'Missing prospectId in args' };
      }

      if (resume === undefined) {
        return { success: false, error: 'Missing resume in args' };
      }

      return saveSummary({ prospectId, resume });
    }

    default:
      return { success: false, error: 'Tool inconnu' };
  }
}

retellRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isRetellToolCall(req.body)) {
      const response: RetellToolResponse = {
        result: { success: false, error: 'Invalid Retell tool call body' },
      };
      res.status(200).json(response);
      return;
    }

    const result = await dispatchToolCall(req.body);
    const response: RetellToolResponse = { result };
    res.status(200).json(response);
  } catch (error: unknown) {
    const response: RetellToolResponse = {
      result: { success: false, error: toToolError(error) },
    };
    res.status(200).json(response);
  }
});

export { retellRouter };
