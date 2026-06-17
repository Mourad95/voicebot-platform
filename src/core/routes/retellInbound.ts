import { Router, type Request, type Response } from 'express';

import type { IAgencyDocument } from '../models/Agency';
import { checkCallAdmission } from '../persistence/call-limits';
import { findAgencyByInboundNumber } from '../persistence/resolve-by-uuid';

const retellInboundRouter = Router();

function getInboundField(body: unknown, field: 'from_number' | 'to_number'): string | null {
  if (typeof body !== 'object' || body === null || !('call_inbound' in body)) {
    return null;
  }
  const inbound = (body as { call_inbound: unknown }).call_inbound;
  if (typeof inbound !== 'object' || inbound === null || !(field in inbound)) {
    return null;
  }
  const value = (inbound as Record<string, unknown>)[field];
  return typeof value === 'string' && value !== '' ? value : null;
}

function buildAgencyVariables(agency: IAgencyDocument): Record<string, string> {
  return {
    agence_nom: agency.name,
    agent_nom: agency.agentName,
    agency_id: agency.uuid,
    secteur_agence: agency.sectorLabel ?? '',
    horaires_agence: agency.businessHoursLabel ?? '',
    numero_transfert: agency.transferNumber ?? agency.agentPhone,
  };
}

function getParisDateTime(): {
  readonly currentHour: string;
  readonly currentDay: string;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    hour: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const currentDay = parts.find((p) => p.type === 'weekday')?.value ?? 'lundi';
  const currentHour = parts.find((p) => p.type === 'hour')?.value ?? '00';

  return { currentHour, currentDay };
}

retellInboundRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const fromNumber = getInboundField(req.body, 'from_number');
  const toNumber = getInboundField(req.body, 'to_number');

  process.stdout.write(
    `[RETELL inbound] reçu from=${fromNumber ?? 'null'} to=${toNumber ?? 'null'}\n`,
  );

  // Garde-fou anti-abus : on refuse AVANT que l'agent LLM ne démarre (zéro token consommé).
  // En cas d'erreur DB, on laisse passer (fail-open) pour ne pas bloquer les appels légitimes.
  if (fromNumber !== null) {
    try {
      const admission = await checkCallAdmission(fromNumber);
      if (!admission.accepted) {
        process.stdout.write(
          `[RETELL inbound] call rejected (${admission.reason}) from=${fromNumber}\n`,
        );
        // Réponse 200 sans override_agent_id : Retell ne connecte l'appel à aucun agent.
        res.status(200).json({ call_inbound: {} });
        return;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      process.stderr.write(`[RETELL inbound] admission check failed (fail-open): ${message}\n`);
    }
  }

  const { currentHour, currentDay } = getParisDateTime();
  let dynamicVariables: Record<string, string> = {
    current_hour: currentHour,
    current_day: currentDay,
  };

  // Résolution multi-agences : on injecte les variables de l'agence selon le numéro appelé.
  // Si l'agence est introuvable, on retombe sur les default_dynamic_variables de l'agent Retell.
  if (toNumber !== null) {
    try {
      const agency = await findAgencyByInboundNumber(toNumber);
      if (agency !== null) {
        dynamicVariables = { ...dynamicVariables, ...buildAgencyVariables(agency) };
      } else {
        process.stdout.write(`[RETELL inbound] no agency for to=${toNumber} (defaults used)\n`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      process.stderr.write(`[RETELL inbound] agency lookup failed (defaults used): ${message}\n`);
    }
  }

  process.stdout.write(
    `[RETELL inbound] dynamic_variables = ${JSON.stringify(dynamicVariables)}\n`,
  );

  res.status(200).json({
    call_inbound: {
      dynamic_variables: dynamicVariables,
    },
  });
});

export { retellInboundRouter };
