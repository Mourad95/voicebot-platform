import { getSector } from "../../sectors";
import type { IAgencyDocument } from "../models/Agency";
import { findProspectByUuid } from "../persistence/resolve-by-uuid";
import { isValidUuid } from "../utils/uuid";
import { logToolEvent } from "./tool-log";
import type { ToolResult } from "./tool-result.types";
import { toToolError } from "./tool-result.types";

export type NotifyAgentResult = ToolResult;

function isPopulatedAgency(agency: unknown): agency is IAgencyDocument {
  return (
    typeof agency === "object" &&
    agency !== null &&
    "agentPhone" in agency &&
    "sector" in agency
  );
}

function isE164(value: string | undefined): value is string {
  return typeof value === 'string' && /^\+[1-9]\d{7,14}$/.test(value);
}

export const PRIORITIES = ["haute", "moyenne", "basse"] as const;
export type Priority = (typeof PRIORITIES)[number];

export function isPriority(value: unknown): value is Priority {
  return (
    typeof value === "string" &&
    (PRIORITIES as readonly string[]).includes(value)
  );
}

const PRIORITY_HEADER: Record<Priority, string> = {
  haute: "PRIORITE HAUTE - Lead chaud",
  moyenne: "PRIORITE MOYENNE - A rappeler",
  basse: "PRIORITE BASSE - Lead froid",
};

const PRIORITY_CTA: Record<Priority, string> = {
  haute: "Tres motive - rappeler en priorite",
  moyenne: "Interesse - rappeler dans la journee",
  basse: "A suivre - recontacter quand possible",
};

function buildSmsMessage(params: {
  readonly priority: Priority;
  readonly nom: string;
  readonly telephone: string;
  readonly resume: string;
  readonly creneauRappel: string | null;
}): string {
  const nomDisplay = params.nom ? params.nom.toUpperCase() : "PROSPECT INCONNU";
  const lines: string[] = [
    PRIORITY_HEADER[params.priority],
    "",
    nomDisplay,
    params.telephone || "Non renseigne",
    "",
    params.resume,
  ];

  if (params.creneauRappel) {
    lines.push("", `Rappel souhaite : ${params.creneauRappel}`);
  }

  lines.push("", PRIORITY_CTA[params.priority]);

  return lines.join("\n");
}

function getTwilioConfig(): {
  sid: string;
  token: string;
  from: string;
} | null {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_PHONE;

  if (!sid || !token || !from) {
    return null;
  }

  return { sid, token, from };
}

export async function notifyAgent(input: {
  readonly prospectId: string;
  readonly priority: Priority;
  readonly agentPhone?: string;
}): Promise<NotifyAgentResult> {
  try {
    if (!isValidUuid(input.prospectId)) {
      logToolEvent("notifyAgent: invalid UUID", {
        prospectId: input.prospectId,
      });
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
    const recipientPhone = isE164(input.agentPhone) ? input.agentPhone : agency.agentPhone;
    const sectorConfig = getSector(agency.sector);
    const prospectNom = prospect.nom ?? "";
    const prospectNumero = prospect.telephone ?? "";
    const summaryInput = {
      nom: prospectNom,
      telephone: prospectNumero,
      qualificationData: Object.fromEntries(prospect.qualificationData?.entries() ?? []),
      creneauRappel: prospect.creneauRappel ?? null,
    };
    const resume =
      prospect.resume !== undefined && prospect.resume !== ""
        ? prospect.resume
        : sectorConfig.buildCallSummaryText(summaryInput);

    const message = buildSmsMessage({
      priority: input.priority,
      nom: prospectNom,
      telephone: prospectNumero,
      resume,
      creneauRappel:
        prospect.creneauRappel != null ? String(prospect.creneauRappel) : null,
    });

    if (process.env.SMS_MOCK === "true") {
      logToolEvent(`[SMS MOCK] → ${recipientPhone}\n${message}`, {
        agentPhone: recipientPhone,
        prospectId: input.prospectId,
      });
      return { success: true };
    }

    const twilioConfig = getTwilioConfig();
    if (twilioConfig === null) {
      return { success: false, error: "Twilio configuration is missing" };
    }

    const Twilio = (await import("twilio")).default;
    const client = Twilio(twilioConfig.sid, twilioConfig.token);

    const twilioMessage = await client.messages.create({
      body: message,
      from: twilioConfig.from,
      to: recipientPhone,
    });

    logToolEvent("notifyAgent: Twilio SMS sent", {
      prospectId: input.prospectId,
      agentPhone: recipientPhone,
      messageSid: twilioMessage.sid,
      status: twilioMessage.status,
    });

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = toToolError(error);
    logToolEvent("notifyAgent: Twilio request failed", {
      prospectId: input.prospectId,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}
