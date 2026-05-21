import type { SectorConfig, SmsTemplatePayload } from '../types';

const formatRappel = (creneauRappel?: Date | null): string =>
  creneauRappel
    ? creneauRappel.toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'À définir';

const formatReceivedDate = (): string =>
  new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });

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
  smsTemplate: ({
    nom,
    telephone,
    qualificationData,
    creneauRappel,
  }: SmsTemplatePayload): string => {
    const typeBien = qualificationData.typeBien ?? 'Non précisé';

    return [
      '🏠 Nouveau prospect immobilier',
      `Nom : ${nom}`,
      `Tél : ${telephone}`,
      `Projet : ${qualificationData.projet ?? ''}`,
      `Type de bien : ${typeBien}`,
      `Budget : ${qualificationData.budget ?? ''}`,
      `Délai : ${qualificationData.delai ?? ''}`,
      `Rappel : ${formatRappel(creneauRappel)}`,
      '---',
      `Reçu le ${formatReceivedDate()}`,
    ].join('\n');
  },
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
