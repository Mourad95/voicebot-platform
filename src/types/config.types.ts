import type { SectorName } from './sector.types';

export interface AppRuntimeConfig {
  readonly nodeEnv: string;
  readonly port: number;
  readonly mongodbUri: string;
  readonly twilioSid: string;
  readonly twilioToken: string;
  readonly twilioPhone: string;
  readonly retellApiKey: string;
  readonly testPhone: string;
  readonly sector: SectorName;
}
