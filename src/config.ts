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

} as const;
