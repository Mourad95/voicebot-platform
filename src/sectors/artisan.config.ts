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
  return trimmed === '' ? 'Un prospect' : trimmed;
};

const buildCallSummaryText = ({
  nom,
  qualificationData,
  creneauRappel,
}: CallSummaryInput): string => {
  const client = formatClientName(nom);
  const intervention = qualificationData.typeIntervention ?? 'une intervention';
  const urgence = qualificationData.urgence ?? 'non précisée';
  const adresse = qualificationData.adresse ?? 'non précisée';

  return `${client} demande une intervention (${intervention}), urgence ${urgence}, à ${adresse}.${formatRappelSuffix(creneauRappel)}`;
};

export const artisanConfig: SectorConfig = {
  name: 'artisan',
  displayName: 'Artisan',
  qualificationFields: [
    {
      key: 'typeIntervention',
      type: 'string',
      required: true,
    },
    {
      key: 'urgence',
      type: 'enum',
      enumValues: ['urgent', 'cette semaine', 'ce mois'],
      required: true,
    },
    {
      key: 'adresse',
      type: 'string',
      required: true,
    },
  ],
  buildCallSummaryText,
  smsTemplate: formatSmsMessage,
  defaultBusinessHours: {
    monday: { start: 8, end: 18 },
    tuesday: { start: 8, end: 18 },
    wednesday: { start: 8, end: 18 },
    thursday: { start: 8, end: 18 },
    friday: { start: 8, end: 18 },
    saturday: { start: 9, end: 12 },
    sunday: null,
  },
};
