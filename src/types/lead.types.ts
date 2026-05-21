import type { SectorName } from './sector.types';
import type { QualificationData } from './qualification.types';

export const LEAD_STATUSES = [
  'new',
  'qualified',
  'callback_scheduled',
  'not_interested',
  'closed',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Lead {
  readonly id?: string;
  readonly nom: string;
  readonly telephone: string;
  readonly sector: SectorName;
  readonly qualificationData: QualificationData;
  readonly creneauRappel?: Date | null;
  readonly status: LeadStatus;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}
