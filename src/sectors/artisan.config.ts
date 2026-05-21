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
  smsTemplate: ({
    nom,
    telephone,
    qualificationData,
    creneauRappel,
  }: SmsTemplatePayload): string => {
    return [
      "🔧 Nouvelle demande d'intervention",
      `Nom : ${nom}`,
      `Tél : ${telephone}`,
      `Intervention : ${qualificationData.typeIntervention ?? ''}`,
      `Urgence : ${qualificationData.urgence ?? ''}`,
      `Adresse : ${qualificationData.adresse ?? ''}`,
      `Rappel : ${formatRappel(creneauRappel)}`,
      '---',
      `Reçu le ${formatReceivedDate()}`,
    ].join('\n');
  },
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
