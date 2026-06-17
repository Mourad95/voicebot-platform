import { config } from '../../config';
import { CallTracking } from '../models/CallTracking';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const CALL_REJECTION_REASONS = [
  'per_phone_quota',
  'daily_quota',
  'concurrency',
] as const;
export type CallRejectionReason = (typeof CALL_REJECTION_REASONS)[number];

export type CallAdmission =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: CallRejectionReason };

/**
 * Vérifie les 3 plafonds avant de laisser un appel démarrer l'agent LLM :
 * - nombre d'appels du même numéro sur 24h glissantes
 * - nombre total d'appels sur 24h glissantes
 * - nombre d'appels actuellement actifs (non terminés)
 */
export async function checkCallAdmission(callerPhone: string): Promise<CallAdmission> {
  const since = new Date(Date.now() - ONE_DAY_MS);

  const [perPhoneCount, dailyCount, concurrentCount] = await Promise.all([
    CallTracking.countDocuments({ callerPhone, startedAt: { $gte: since } }),
    CallTracking.countDocuments({ startedAt: { $gte: since } }),
    CallTracking.countDocuments({ endedAt: { $exists: false } }),
  ]);

  if (perPhoneCount >= config.callLimits.maxPerPhonePerDay) {
    return { accepted: false, reason: 'per_phone_quota' };
  }

  if (dailyCount >= config.callLimits.maxPerDay) {
    return { accepted: false, reason: 'daily_quota' };
  }

  if (concurrentCount >= config.callLimits.maxConcurrent) {
    return { accepted: false, reason: 'concurrency' };
  }

  return { accepted: true };
}

export async function registerCallStart(params: {
  readonly callId: string;
  readonly callerPhone: string;
}): Promise<void> {
  await CallTracking.updateOne(
    { callId: params.callId },
    {
      $setOnInsert: {
        callId: params.callId,
        callerPhone: params.callerPhone,
        startedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function registerCallEnd(callId: string): Promise<void> {
  await CallTracking.updateOne(
    { callId, endedAt: { $exists: false } },
    { $set: { endedAt: new Date() } },
  );
}
