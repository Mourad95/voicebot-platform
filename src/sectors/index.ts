import { artisanConfig } from './artisan.config';
import { immoConfig } from './immo.config';
import { medicalConfig } from './medical.config';
import type { SectorConfig } from '../types';

const sectors = new Map<string, SectorConfig>([
  ['immo', immoConfig],
  ['medical', medicalConfig],
  ['artisan', artisanConfig],
]);

export function getSector(name: string): SectorConfig {
  const sector = sectors.get(name);

  if (!sector) {
    throw new Error(`Unknown sector: "${name}"`);
  }

  return sector;
}

export { sectors };
export default sectors;
