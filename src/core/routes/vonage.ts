import { Router, type Request, type Response } from 'express';

import { logToolEvent } from '../tools/tool-log';

const vonageRouter = Router();

vonageRouter.post('/inbound', (req: Request, res: Response): void => {
  logToolEvent('vonage: inbound SMS received', {
    from: String(req.body?.from ?? ''),
    to: String(req.body?.to ?? ''),
    text: String(req.body?.text ?? ''),
  });
  res.status(200).end();
});

vonageRouter.post('/status', (req: Request, res: Response): void => {
  logToolEvent('vonage: SMS status update', {
    messageUUID: String(req.body?.message_uuid ?? ''),
    status: String(req.body?.status ?? ''),
    to: String(req.body?.to ?? ''),
  });
  res.status(200).end();
});

export { vonageRouter };
