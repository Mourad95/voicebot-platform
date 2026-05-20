import { artisanConfig } from './artisan.config';
import { immoConfig } from './immo.config';
import { medicalConfig } from './medical.config';
import type { NicheConfig } from '../types';

const niches = new Map<string, NicheConfig>([
  ['immo', immoConfig],
  ['medical', medicalConfig],
  ['artisan', artisanConfig],
]);

export function getNiche(name: string): NicheConfig {
  const niche = niches.get(name);

  if (!niche) {
    throw new Error(`Niche inconnue : "${name}"`);
  }

  return niche;
}

export { niches };
export default niches;
