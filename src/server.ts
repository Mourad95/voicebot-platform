import express from 'express';
import mongoose from 'mongoose';

import { config } from './config';
import { applySecurityMiddleware } from './core/middleware/security';
import { validateRetell } from './core/middleware/validateRetell';
import { retellRouter } from './core/routes/retell';
import { retellEventsRouter } from './core/routes/retellEvents';
import { retellInboundRouter } from './core/routes/retellInbound';
import { vonageRouter } from './core/routes/vonage';

async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri, {
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
  applySecurityMiddleware(app);
  const retellRawBodyParser = express.raw({ type: 'application/json' });

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: config.nodeEnv,
      sector: config.sector,
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

  app.listen(config.port, () => {
    process.stdout.write(
      `🚀 Serveur démarré - port ${config.port} - sector ${config.sector} - env ${config.nodeEnv}\n`,
    );
    if (config.publicUrl) {
      process.stdout.write(
        `[RETELL] Inbound URL → ${config.publicUrl}/webhook/retell/inbound\n` +
        `[RETELL] Events URL  → ${config.publicUrl}/webhook/retell/events\n` +
        `[RETELL] Tools URL   → ${config.publicUrl}/webhook/retell\n` +
        `[VONAGE] Inbound URL → ${config.publicUrl}/webhook/vonage/inbound\n` +
        `[VONAGE] Status URL  → ${config.publicUrl}/webhook/vonage/status\n`,
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
