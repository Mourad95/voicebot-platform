import Twilio from 'twilio';

declare const process: {
  readonly env: Record<string, string | undefined>;
  readonly stdout: { write(chunk: string): void };
};

import { getSector } from '../../sectors';
import type { QualificationData } from '../../types/qualification.types';
import type { IAgencyDocument } from '../models/Agency';
import { Prospect } from '../models/Prospect';

type ToolFailure = { readonly success: false; readonly error: string };

type NotifyAgentSuccess = { readonly success: true };

export type NotifyAgentResult = NotifyAgentSuccess | ToolFailure;

function logEvent(message: string, meta?: Record<string, string | undefined>): void {
  process.stdout.write(
    `${JSON.stringify({ level: 'info', message, ...meta, ts: new Date().toISOString() })}\n`,
  );
}

function mapQualificationData(
  qualificationData: Map<string, string> | undefined,
): QualificationData {
  if (qualificationData === undefined) {
    return {};
  }

  return Object.fromEntries(qualificationData.entries());
}

function isPopulatedAgency(
  agency: unknown,
): agency is IAgencyDocument {
  return (
    typeof agency === 'object' &&
    agency !== null &&
    'agentPhone' in agency &&
    'sector' in agency
  );
}

function getTwilioConfig(): { sid: string; token: string; from: string } | null {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_PHONE;

  if (sid === undefined || token === undefined || from === undefined) {
    return null;
  }

  if (sid === '' || token === '' || from === '') {
    return null;
  }

  return { sid, token, from };
}

export async function notifyAgent(input: {
  readonly prospectId: string;
}): Promise<NotifyAgentResult> {
  try {
    const prospect = await Prospect.findById(input.prospectId).populate<{
      agencyId: IAgencyDocument;
    }>('agencyId');

    if (prospect === null) {
      return { success: false, error: 'Prospect not found' };
    }

    if (!isPopulatedAgency(prospect.agencyId)) {
      return { success: false, error: 'Agency not found for prospect' };
    }

    const agency = prospect.agencyId;
    const sectorConfig = getSector(agency.sector);
    const message = sectorConfig.smsTemplate({
      nom: prospect.nom ?? '',
      telephone: prospect.telephone ?? '',
      qualificationData: mapQualificationData(prospect.qualificationData),
      creneauRappel: prospect.creneauRappel ?? null,
    });

    const twilioConfig = getTwilioConfig();
    if (twilioConfig === null) {
      return { success: false, error: 'Twilio configuration is missing' };
    }

    const client = Twilio(twilioConfig.sid, twilioConfig.token);

    await client.messages.create({
      body: message,
      from: twilioConfig.from,
      to: agency.agentPhone,
    });

    logEvent(
      `SMS envoyé à ${agency.agentPhone} pour prospect ${input.prospectId}`,
      {
        agentPhone: agency.agentPhone,
        prospectId: input.prospectId,
      },
    );

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logEvent('notifyAgent: Twilio or processing failed', {
      prospectId: input.prospectId,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}
