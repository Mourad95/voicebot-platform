import type { CallSummaryInput, SectorConfig } from '../types';
import { formatSmsMessage } from '../types/sector.types';

const formatRappelSuffix = (creneauRappel?: Date | null): string => {
  if (creneauRappel === undefined || creneauRappel === null) {
    return '';
  }

  const label = creneauRappel.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return ` Rappel prévu le ${label}.`;
};

const formatClientName = (nom: string): string => {
  const trimmed = nom.trim();
  return trimmed === '' ? 'Un patient' : trimmed;
};

const buildCallSummaryText = ({
  nom,
  qualificationData,
  creneauRappel,
}: CallSummaryInput): string => {
  const client = formatClientName(nom);
  const motif = qualificationData.motif ?? 'un motif non précisé';
  const typeConsultation = qualificationData.typeConsultation ?? 'non précisé';
  const ordonnance = qualificationData.ordonnance ?? 'non précisé';

  return `${client} souhaite un rendez-vous (${typeConsultation}) pour ${motif}, ordonnance : ${ordonnance}.${formatRappelSuffix(creneauRappel)}`;
};

export const medicalConfig: SectorConfig = {
  name: 'medical',
  displayName: 'Cabinet paramédical',
  qualificationFields: [
    {
      key: 'motif',
      type: 'string',
      required: true,
    },
    {
      key: 'typeConsultation',
      type: 'enum',
      enumValues: ['première consultation', 'suivi', 'urgence'],
      required: true,
    },
    {
      key: 'ordonnance',
      type: 'enum',
      enumValues: ['oui', 'non', 'ne sait pas'],
      required: false,
    },
  ],
  buildCallSummaryText,
  smsTemplate: formatSmsMessage,
  defaultBusinessHours: {
    monday: { start: 8, end: 19 },
    tuesday: { start: 8, end: 19 },
    wednesday: { start: 8, end: 19 },
    thursday: { start: 8, end: 19 },
    friday: { start: 8, end: 19 },
    saturday: { start: 9, end: 12 },
    sunday: null,
  },
};
