import Twilio from "twilio";

import { getSector } from "../../sectors";
import type { QualificationData } from "../../types/qualification.types";
import type { IAgencyDocument } from "../models/Agency";
import { findProspectByUuid } from "../persistence/resolve-by-uuid";
import { isValidUuid } from "../utils/uuid";
import { logToolEvent } from "./tool-log";
import type { ToolResult } from "./tool-result.types";
import { toToolError } from "./tool-result.types";

export type NotifyAgentResult = ToolResult;

function mapQualificationData(
  qualificationData: Map<string, string> | undefined,
): QualificationData {
  if (qualificationData === undefined) {
    return {};
  }

  return Object.fromEntries(qualificationData.entries());
}

function isPopulatedAgency(agency: unknown): agency is IAgencyDocument {
  return (
    typeof agency === "object" &&
    agency !== null &&
    "agentPhone" in agency &&
    "sector" in agency
  );
}

export const PRIORITIES = ['haute', 'moyenne', 'basse'] as const;
export type Priority = (typeof PRIORITIES)[number];

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}

const PRIORITY_HEADER: Record<Priority, string> = {
  haute:   '🔴 PRIORITÉ HAUTE — RDV confirmé / lead chaud, à traiter en priorité',
  moyenne: '🟡 PRIORITÉ MOYENNE — Rappel à effectuer',
  basse:   '🟢 PRIORITÉ BASSE — À recontacter quand possible',
};

function getTwilioConfig(): {
  sid: string;
  token: string;
  from: string;
} | null {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_PHONE;

  if (sid === undefined || token === undefined || from === undefined) {
    return null;
  }

  if (sid === "" || token === "" || from === "") {
    return null;
  }

  return { sid, token, from };
}

export async function notifyAgent(input: {
  readonly prospectId: string;
  readonly priority: Priority;
}): Promise<NotifyAgentResult> {
  try {
    if (!isValidUuid(input.prospectId)) {
      logToolEvent("notifyAgent: invalid UUID", { prospectId: input.prospectId });
      return { success: false, error: "Invalid prospect UUID" };
    }

    const prospect = await findProspectByUuid(input.prospectId);

    if (prospect === null) {
      return { success: false, error: "Prospect not found" };
    }

    if (!isPopulatedAgency(prospect.agencyId)) {
      return { success: false, error: "Agency not found for prospect" };
    }

    const agency = prospect.agencyId;
    const sectorConfig = getSector(agency.sector);
    const prospectNom = prospect.nom ?? "";
    const prospectNumero = prospect.telephone ?? "";
    const summaryInput = {
      nom: prospectNom,
      telephone: prospectNumero,
      qualificationData: mapQualificationData(prospect.qualificationData),
      creneauRappel: prospect.creneauRappel ?? null,
    };
    const resumeSection = prospect.resume !== undefined && prospect.resume !== ''
      ? `📋 Résumé de l'appel :\n${prospect.resume}`
      : sectorConfig.buildCallSummaryText(summaryInput);

    const message = [
      PRIORITY_HEADER[input.priority],
      '',
      `👤 ${prospectNom || 'Prospect inconnu'}`,
      `📞 ${prospectNumero || 'Numéro non renseigné'}`,
      '',
      resumeSection,
    ].join('\n');

    if (process.env.SMS_MOCK === 'true') {
      logToolEvent(`[SMS MOCK] → ${agency.agentPhone}\n${message}`, {
        agentPhone: agency.agentPhone,
        prospectId: input.prospectId,
      });
      return { success: true };
    }

    const twilioConfig = getTwilioConfig();
    if (twilioConfig === null) {
      return { success: false, error: "Twilio configuration is missing" };
    }

    const client = Twilio(twilioConfig.sid, twilioConfig.token);

    await client.messages.create({
      body: message,
      from: twilioConfig.from,
      to: agency.agentPhone,
    });

    logToolEvent(
      `SMS envoyé à ${agency.agentPhone} pour prospect ${input.prospectId}`,
      {
        agentPhone: agency.agentPhone,
        prospectId: input.prospectId,
      },
    );

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = toToolError(error);
    logToolEvent("notifyAgent: Twilio or processing failed", {
      prospectId: input.prospectId,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}
