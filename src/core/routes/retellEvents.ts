import { Router, type Request, type Response } from 'express';

import { Prospect } from '../models/Prospect';

export interface RetellCallPayload {
  readonly call_id: string;
  readonly transcript?: string;
}

const RETELL_EVENT_NAMES = [
  'call_started',
  'call_ended',
  'call_analyzed',
] as const;

export type RetellEventName = (typeof RETELL_EVENT_NAMES)[number];

export interface RetellEvent {
  readonly event: RetellEventName;
  readonly call: RetellCallPayload;
}

const retellEventsRouter = Router();

function isRetellEventName(value: string): value is RetellEventName {
  return (RETELL_EVENT_NAMES as readonly string[]).includes(value);
}

function isRetellEvent(body: unknown): body is RetellEvent {
  return (
    typeof body === 'object' &&
    body !== null &&
    'event' in body &&
    typeof body.event === 'string' &&
    isRetellEventName(body.event) &&
    'call' in body &&
    typeof body.call === 'object' &&
    body.call !== null &&
    'call_id' in body.call &&
    typeof body.call.call_id === 'string'
  );
}

async function updateProspectTranscript(
  callId: string,
  transcript: string | undefined,
): Promise<void> {
  if (transcript === undefined || transcript.trim() === '') {
    return;
  }

  await Prospect.findOneAndUpdate({ callId }, { rawTranscript: transcript });
}

retellEventsRouter.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
});

retellEventsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isRetellEvent(req.body)) {
      res.status(200).json({ received: true });
      return;
    }

    const { event, call } = req.body;

    switch (event) {
      case 'call_started':
        process.stdout.write(
          `[RETELL] call_started - call_id: ${call.call_id} - ${new Date().toISOString()}\n`,
        );
        break;

      case 'call_ended':
        process.stdout.write(
          `[RETELL] call_ended - call_id: ${call.call_id} - ${new Date().toISOString()}\n`,
        );
        await updateProspectTranscript(call.call_id, call.transcript);
        break;

      case 'call_analyzed':
        process.stdout.write(
          `[RETELL] call_analyzed - call_id: ${call.call_id} - ${new Date().toISOString()}\n`,
        );
        await updateProspectTranscript(call.call_id, call.transcript);
        break;

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch {
    res.status(200).json({ received: true });
  }
});

export { retellEventsRouter };
