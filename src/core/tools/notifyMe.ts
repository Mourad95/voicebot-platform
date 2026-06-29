import { config } from '../../config';
import { logToolEvent } from './tool-log';
import type { ToolResult } from './tool-result.types';
import { toToolError } from './tool-result.types';

export const INTEREST_LEVELS = ['chaud', 'tiede', 'froid'] as const;
export type InterestLevel = (typeof INTEREST_LEVELS)[number];

export function isInterestLevel(value: unknown): value is InterestLevel {
  return (
    typeof value === 'string' &&
    (INTEREST_LEVELS as readonly string[]).includes(value)
  );
}

export interface NotifyMeInput {
  readonly interest: InterestLevel;
  readonly agencyName?: string;
  readonly prospectPhone?: string;
  readonly summary?: string;
  readonly slot?: string;
}

const INTEREST_HEADER: Record<InterestLevel, string> = {
  chaud: 'LEAD CHAUD - Emma',
  tiede: 'LEAD TIEDE - Emma',
  froid: 'LEAD FROID - Emma',
};

function buildMessage(input: NotifyMeInput): string {
  const lines: string[] = [
    INTEREST_HEADER[input.interest],
    '',
    input.agencyName ? input.agencyName.toUpperCase() : 'AGENCE INCONNUE',
    input.prospectPhone ?? 'Numero non renseigne',
  ];

  if (input.summary) {
    lines.push('', input.summary);
  }

  if (input.slot) {
    lines.push('', `Creneau demande : ${input.slot}`);
  }

  return lines.join('\n');
}

function getTwilioConfig(): { sid: string; token: string; from: string } {
  return {
    sid: config.twilio.sid,
    token: config.twilio.token,
    from: config.twilio.phone,
  };
}

export async function notifyMe(input: NotifyMeInput): Promise<ToolResult> {
  try {
    if (config.myPhone === '') {
      logToolEvent('notifyMe: MY_PHONE not configured', {});
      return { success: false, error: 'MY_PHONE not configured' };
    }

    const message = buildMessage(input);

    if (config.twilio.smsMock) {
      logToolEvent(`[SMS MOCK] → ${config.myPhone}\n${message}`, {
        interest: input.interest,
        agencyName: input.agencyName ?? '',
      });
      return { success: true };
    }

    const twilioConfig = getTwilioConfig();
    const Twilio = (await import('twilio')).default;
    const client = Twilio(twilioConfig.sid, twilioConfig.token);

    const twilioMessage = await client.messages.create({
      body: message,
      from: twilioConfig.from,
      to: config.myPhone,
    });

    logToolEvent('notifyMe: Twilio SMS sent', {
      interest: input.interest,
      messageSid: twilioMessage.sid,
      status: twilioMessage.status,
    });

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = toToolError(error);
    logToolEvent('notifyMe: Twilio request failed', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}
