import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    process.stderr.write(`[CONFIG] Missing required env variable: ${key}\n`);
    process.exit(1);
  }
  return value;
}

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function optionalInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    process.stderr.write(`[CONFIG] Invalid positive integer for ${key}: ${raw}\n`);
    process.exit(1);
  }
  return parsed;
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '3000')),
  sector: optional('SECTOR', optional('NICHE', 'immo')),
  publicUrl: optional('PUBLIC_URL'),

  mongodbUri: required('MONGODB_URI'),

  retellApiKey: required('RETELL_API_KEY'),

  twilio: {
    sid: required('TWILIO_SID'),
    token: required('TWILIO_TOKEN'),
    phone: required('TWILIO_PHONE'),
    smsMock: optional('SMS_MOCK') === 'true',
  },

  // Numéro perso qui reçoit les SMS de qualification des prospects (campagne Emma).
  myPhone: optional('MY_PHONE'),

  callLimits: {
    maxPerPhonePerDay: optionalInt('CALL_MAX_PER_PHONE_PER_DAY', 5),
    maxPerDay: optionalInt('CALL_MAX_PER_DAY', 200),
    maxConcurrent: optionalInt('CALL_MAX_CONCURRENT', 10),
  },

} as const;
