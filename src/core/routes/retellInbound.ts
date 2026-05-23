import { Router, type Request, type Response } from 'express';

const retellInboundRouter = Router();

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

retellInboundRouter.post('/', (_req: Request, res: Response): void => {
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
