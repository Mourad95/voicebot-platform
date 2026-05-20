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

export interface SmsTemplatePayload {
  readonly nom: string;
  readonly telephone: string;
  readonly qualificationData: QualificationData;
  readonly creneauRappel?: Date | null;
}

export interface NicheConfig {
  readonly name: string;
  readonly displayName: string;
  readonly qualificationFields: readonly QualificationFieldConfig[];
  readonly smsTemplate: (payload: SmsTemplatePayload) => string;
  readonly defaultBusinessHours: BusinessHours;
}

export const NICHE_NAMES = ['immo', 'medical', 'artisan'] as const;

export type NicheName = (typeof NICHE_NAMES)[number];
