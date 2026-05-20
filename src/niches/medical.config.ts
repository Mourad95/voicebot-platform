import type { NicheConfig, SmsTemplatePayload } from '../types';

const formatRappel = (creneauRappel?: Date | null): string =>
  creneauRappel
    ? creneauRappel.toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'À définir';

const formatReceivedDate = (): string =>
  new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });

export const medicalConfig: NicheConfig = {
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
  smsTemplate: ({
    nom,
    telephone,
    qualificationData,
    creneauRappel,
  }: SmsTemplatePayload): string => {
    const ordonnance = qualificationData.ordonnance ?? 'Non précisé';

    return [
      '🏥 Nouveau patient',
      `Nom : ${nom}`,
      `Tél : ${telephone}`,
      `Motif : ${qualificationData.motif ?? ''}`,
      `Type : ${qualificationData.typeConsultation ?? ''}`,
      `Ordonnance : ${ordonnance}`,
      `Rappel : ${formatRappel(creneauRappel)}`,
      '---',
      `Reçu le ${formatReceivedDate()}`,
    ].join('\n');
  },
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
