import { Router, type Request, type Response } from 'express';

import { checkCallAdmission } from '../persistence/call-limits';

const retellInboundRouter = Router();

function getFromNumber(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('call_inbound' in body)) {
    return null;
  }
  const inbound = (body as { call_inbound: unknown }).call_inbound;
  if (typeof inbound !== 'object' || inbound === null || !('from_number' in inbound)) {
    return null;
  }
  const fromNumber = (inbound as { from_number: unknown }).from_number;
  return typeof fromNumber === 'string' && fromNumber !== '' ? fromNumber : null;
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
  const fromNumber = getFromNumber(req.body);

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

  const dynamicVariables = {
    current_hour: currentHour,
    current_day: currentDay,
  };

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
