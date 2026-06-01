import type { Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';

const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

export function applySecurityMiddleware(app: Express): void {
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use('/webhook', webhookLimiter);
}
