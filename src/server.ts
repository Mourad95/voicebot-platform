import 'dotenv/config';

import express from 'express';
import mongoose from 'mongoose';

import { validateRetell } from './core/middleware/validateRetell';
import { retellRouter } from './core/routes/retell';
import { retellEventsRouter } from './core/routes/retellEvents';
import { retellInboundRouter } from './core/routes/retellInbound';
import { vonageRouter } from './core/routes/vonage';

const PORT = Number(process.env.PORT ?? 3000);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const SECTOR = process.env.SECTOR ?? process.env.NICHE ?? 'immo';
const MONGODB_URI = process.env.MONGODB_URI ?? "";
const PUBLIC_URL = process.env.PUBLIC_URL ?? '';

async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    process.stderr.write(`[SERVER] MongoDB connection failed: ${message}\n`);
    process.exit(1);
  }
}

function registerShutdownHooks(): void {
  const shutdown = async (signal: string): Promise<void> => {
    process.stdout.write(`[SERVER] ${signal} received, shutting down...\n`);

    try {
      await mongoose.connection.close();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      process.stderr.write(`[SERVER] MongoDB close failed: ${message}\n`);
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

async function startServer(): Promise<void> {
  await connectDatabase();

  const app = express();
  const retellRawBodyParser = express.raw({ type: 'application/json' });

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: NODE_ENV,
      sector: SECTOR,
    });
  });

  app.use(
    '/webhook/retell/events',
    retellRawBodyParser,
    validateRetell,
    retellEventsRouter,
  );
  app.use('/webhook/retell/inbound', express.json(), retellInboundRouter);
  app.use('/webhook/vonage', express.json(), vonageRouter);
  app.use('/webhook/retell', retellRawBodyParser, validateRetell, retellRouter);

  app.listen(PORT, () => {
    process.stdout.write(
      `🚀 Serveur démarré - port ${PORT} - sector ${SECTOR} - env ${NODE_ENV}\n`,
    );
    if (PUBLIC_URL) {
      process.stdout.write(
        `[VONAGE] Inbound URL → ${PUBLIC_URL}/webhook/vonage/inbound\n` +
        `[VONAGE] Status URL  → ${PUBLIC_URL}/webhook/vonage/status\n`,
      );
    }
  });

  registerShutdownHooks();
}

void startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`[SERVER] Startup failed: ${message}\n`);
  process.exit(1);
});
