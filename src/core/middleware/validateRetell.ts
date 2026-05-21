import type { NextFunction, Request, Response } from 'express';

import { verifyRetellSignature } from '../security/verify-retell-signature';

function getRawBodyString(body: unknown): string | null {
  if (Buffer.isBuffer(body)) {
    return body.toString('utf-8');
  }

  if (typeof body === 'string') {
    return body;
  }

  return null;
}

function getRetellLabel(body: unknown): string {
  if (typeof body !== 'object' || body === null) {
    return 'unknown';
  }

  if ('tool_name' in body && typeof body.tool_name === 'string') {
    return body.tool_name;
  }

  if ('event' in body && typeof body.event === 'string') {
    return body.event;
  }

  return 'unknown';
}

function parseJsonBody(rawBody: string): unknown {
  return JSON.parse(rawBody) as unknown;
}

function logRetellCall(label: string): void {
  process.stdout.write(
    `[RETELL] Appel reçu - tool: ${label} - ${new Date().toISOString()}\n`,
  );
}

export function validateRetell(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const rawBody = getRawBodyString(req.body);

  if (rawBody === null) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  if (nodeEnv !== 'development') {
    const apiKey = process.env.RETELL_API_KEY ?? '';
    const signature = req.header('x-retell-signature');

    const isValid = verifyRetellSignature({
      rawBody,
      apiKey,
      signature,
    });

    if (!isValid) {
      res.status(401).json({ error: 'Invalid x-retell-signature' });
      return;
    }
  }

  try {
    req.body = parseJsonBody(rawBody);
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  logRetellCall(getRetellLabel(req.body));
  next();
}
