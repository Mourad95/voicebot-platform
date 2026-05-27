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

export const PRIORITIES = ["haute", "moyenne", "basse"] as const;
export type Priority = (typeof PRIORITIES)[number];

export function isPriority(value: unknown): value is Priority {
  return (
    typeof value === "string" &&
    (PRIORITIES as readonly string[]).includes(value)
  );
}

const PRIORITY_BADGE: Record<Priority, string> = {
  haute: "Priorité : Haute",
  moyenne: "Priorité : Moyenne",
  basse: "Priorité : Basse",
};

const PRIORITY_CTA: Record<Priority, string> = {
  haute: "=> Rappeler maintenant",
  moyenne: "=> Rappeler dans la journee",
  basse: "=> Recontacter dès que possible",
};

const QUALIF_LABELS: Record<string, string> = {
  projet: "Projet",
  leadType: "Projet",
  typeBien: "Bien",
  budget: "Budget",
  budgetOuPrix: "Budget",
  financement: "Financement",
  accordBanque: "Accord banque",
  accord_banque: "Accord banque",
  delai: "Delai",
  secteur: "Zone",
  adresseBien: "Adresse",
  superficie: "Surface",
  nbPieces: "Pieces",
  creneauRappel: "Rappel",
};

const SEEN_KEYS = new Set(["creneauRappel"]);

function formatQualifFields(qualificationData: QualificationData): string {
  const seen = new Set(SEEN_KEYS);
  const lines: string[] = [];

  for (const [key, label] of Object.entries(QUALIF_LABELS)) {
    if (seen.has(key)) continue;
    const value = qualificationData[key];
    if (!value || value === "inconnu" || value === "non précisé") continue;
    lines.push(`${label} : ${value}`);
    seen.add(key);
  }

  return lines.join("\n");
}

function buildSmsMessage(params: {
  readonly priority: Priority;
  readonly nom: string;
  readonly telephone: string;
  readonly qualificationData: QualificationData;
  readonly resume: string;
  readonly creneauRappel: string | null;
}): string {
  const qualifBlock = formatQualifFields(params.qualificationData);
  const lines: string[] = [
    PRIORITY_BADGE[params.priority],
    `${params.nom || "Prospect inconnu"} | ${params.telephone || "Non renseigne"}`,
  ];

  if (qualifBlock) {
    lines.push(qualifBlock);
  }

  lines.push(`${params.resume}`);

  if (params.creneauRappel) {
    lines.push(`Rappel: ${params.creneauRappel}`);
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
    const recipientPhone = input.agentPhone?.trim() || agency.agentPhone;
    const sectorConfig = getSector(agency.sector);
    const prospectNom = prospect.nom ?? "";
    const prospectNumero = prospect.telephone ?? "";
    const summaryInput = {
      nom: prospectNom,
      telephone: prospectNumero,
      qualificationData: mapQualificationData(prospect.qualificationData),
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
      qualificationData: mapQualificationData(prospect.qualificationData),
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
