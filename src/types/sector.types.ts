import type { QualificationData } from './qualification.types';

export type QualificationFieldType = 'string' | 'enum';

export interface QualificationFieldConfig {
  readonly key: string;
  readonly type: QualificationFieldType;
  readonly enumValues?: readonly string[];
  readonly required: boolean;
}

export interface BusinessHoursSlot {
  readonly start: number;
  readonly end: number;
}

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export type BusinessHours = Record<DayOfWeek, BusinessHoursSlot | null>;

export const SMS_STATUS = ['important'] as const;

export type SmsStatus = (typeof SMS_STATUS)[number];

export interface SmsTemplatePayload {
  readonly nom: string;
  readonly numero: string;
  readonly text: string;
  readonly status: SmsStatus;
}

export interface CallSummaryInput {
  readonly nom: string;
  readonly telephone: string;
  readonly qualificationData: QualificationData;
  readonly creneauRappel?: Date | null;
}

export function formatSmsMessage(payload: SmsTemplatePayload): string {
  return [
    `[${payload.status.toUpperCase()}]`,
    payload.nom,
    payload.numero,
    '',
    payload.text,
  ].join('\n');
}

export interface SectorConfig {
  readonly name: string;
  readonly displayName: string;
  readonly qualificationFields: readonly QualificationFieldConfig[];
  readonly buildCallSummaryText: (input: CallSummaryInput) => string;
  readonly smsTemplate: (payload: SmsTemplatePayload) => string;
  readonly defaultBusinessHours: BusinessHours;
}

export const SECTOR_NAMES = ['immo', 'medical', 'artisan'] as const;

export type SectorName = (typeof SECTOR_NAMES)[number];
