import { createHmac, timingSafeEqual } from 'node:crypto';

const RETELL_SIGNATURE_PATTERN = /^v=(\d+),d=(.*)$/;
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

function safeEqualHex(expectedHex: string, receivedHex: string): boolean {
  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const received = Buffer.from(receivedHex, 'hex');

    if (expected.length !== received.length) {
      return false;
    }

    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export function verifyRetellSignature(params: {
  readonly rawBody: string;
  readonly apiKey: string;
  readonly signature: string | undefined;
}): boolean {
  const { rawBody, apiKey, signature } = params;

  if (apiKey.trim() === '') {
    return false;
  }

  if (signature === undefined || signature.trim() === '') {
    return false;
  }

  const match = RETELL_SIGNATURE_PATTERN.exec(signature);

  if (match === null) {
    return false;
  }

  const timestamp = match[1];
  const digest = match[2];
  const timestampMs = Number(timestamp);

  if (!Number.isFinite(timestampMs)) {
    return false;
  }

  const now = Date.now();

  if (Math.abs(now - timestampMs) > MAX_TIMESTAMP_DRIFT_MS) {
    return false;
  }

  const expectedDigest = createHmac('sha256', apiKey)
    .update(rawBody + timestamp)
    .digest('hex');

  return safeEqualHex(expectedDigest, digest);
}
