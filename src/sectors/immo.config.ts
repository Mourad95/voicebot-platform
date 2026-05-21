import type { CallSummaryInput, SectorConfig } from '../types';
import { formatSmsMessage } from '../types/sector.types';

const PROJET_VERBS: Record<string, string> = {
  achat: 'acheter',
  vente: 'vendre',
  location: 'louer',
};

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
  const projet = qualificationData.projet ?? 'inconnu';
  const projetVerb = PROJET_VERBS[projet];
  const budget = qualificationData.budget ?? 'non précisé';
  const delai = qualificationData.delai ?? 'non précisé';
  const typeBien = qualificationData.typeBien?.trim();
  const bienDetail = typeBien !== undefined && typeBien !== '' ? ` (${typeBien})` : '';

  if (projetVerb === undefined) {
    return `${client} a un projet immobilier sur un bien${bienDetail} (budget ${budget}, délai ${delai}).${formatRappelSuffix(creneauRappel)}`;
  }

  return `${client} souhaite ${projetVerb} un bien${bienDetail} pour un budget de ${budget}, délai ${delai}.${formatRappelSuffix(creneauRappel)}`;
};

export const immoConfig: SectorConfig = {
  name: 'immo',
  displayName: 'Agence immobilière',
  qualificationFields: [
    {
      key: 'projet',
      type: 'enum',
      enumValues: ['achat', 'vente', 'location', 'inconnu'],
      required: true,
    },
    {
      key: 'budget',
      type: 'string',
      required: true,
    },
    {
      key: 'delai',
      type: 'string',
      required: true,
    },
    {
      key: 'typeBien',
      type: 'string',
      required: false,
    },
  ],
  buildCallSummaryText,
  smsTemplate: formatSmsMessage,
  defaultBusinessHours: {
    monday: { start: 9, end: 19 },
    tuesday: { start: 9, end: 19 },
    wednesday: { start: 9, end: 19 },
    thursday: { start: 9, end: 19 },
    friday: { start: 9, end: 19 },
    saturday: { start: 10, end: 13 },
    sunday: null,
  },
};
