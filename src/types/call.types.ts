export const CALL_DIRECTIONS = ['inbound', 'outbound'] as const;

export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const CALL_STATUSES = [
  'ringing',
  'in_progress',
  'completed',
  'failed',
  'no_answer',
] as const;

export type CallStatus = (typeof CALL_STATUSES)[number];

export interface CallSession {
  readonly id?: string;
  readonly leadId?: string;
  readonly direction: CallDirection;
  readonly status: CallStatus;
  readonly twilioCallSid?: string;
  readonly retellCallId?: string;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
}
