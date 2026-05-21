import 'dotenv/config';

import mongoose from 'mongoose';

import { Agency } from '../src/core/models/Agency';
import { Prospect } from '../src/core/models/Prospect';
import { Slot } from '../src/core/models/Slot';
import { getSector } from '../src/sectors';
import type { SectorName } from '../src/types/sector.types';

const PARIS_TIMEZONE = 'Europe/Paris';
const SLOT_HOURS = [10, 14, 16] as const;
const WORKING_DAYS_COUNT = 7;
const DEFAULT_TEST_PHONE = '+33600000000';
const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/voicebot';

const parisDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const parisWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PARIS_TIMEZONE,
  weekday: 'short',
});

const parisWallClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PARIS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  hour12: false,
});

function resolveSector(): SectorName {
  const sector = process.env.SECTOR ?? process.env.NICHE ?? 'immo';
  return sector as SectorName;
}

function resolveTestPhone(): string {
  const testPhone = process.env.TEST_PHONE?.trim();

  if (testPhone === undefined || testPhone === '') {
    process.stderr.write(
      `[SEED] Warning: TEST_PHONE absent, utilisation de ${DEFAULT_TEST_PHONE}\n`,
    );
    return DEFAULT_TEST_PHONE;
  }

  return testPhone;
}

function getParisYmd(date: Date): { year: number; month: number; day: number } {
  const parts = parisDateFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return { year, month, day };
}

function isSundayInParis(date: Date): boolean {
  return parisWeekdayFormatter.format(date) === 'Sun';
}

function addDaysUtc(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toParisWallClockUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
): Date {
  let timestamp = Date.UTC(year, month - 1, day, hour, 0, 0);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const probe = new Date(timestamp);
    const parts = parisWallClockFormatter.formatToParts(probe);
    const actualYear = Number(parts.find((part) => part.type === 'year')?.value);
    const actualMonth = Number(parts.find((part) => part.type === 'month')?.value);
    const actualDay = Number(parts.find((part) => part.type === 'day')?.value);
    const actualHour = Number(parts.find((part) => part.type === 'hour')?.value);

    if (
      actualYear === year &&
      actualMonth === month &&
      actualDay === day &&
      actualHour === hour
    ) {
      return probe;
    }

    const dayShift = day - actualDay;
    const hourShift = hour - actualHour;
    timestamp += (dayShift * 24 + hourShift) * 60 * 60 * 1000;
  }

  return new Date(timestamp);
}

function buildWorkingDaySlots(): Date[] {
  const slotTimes: Date[] = [];
  let cursor = new Date();
  let workingDaysAdded = 0;

  while (workingDaysAdded < WORKING_DAYS_COUNT) {
    if (!isSundayInParis(cursor)) {
      const { year, month, day } = getParisYmd(cursor);

      for (const hour of SLOT_HOURS) {
        slotTimes.push(toParisWallClockUtc(year, month, day, hour));
      }

      workingDaysAdded += 1;
    }

    cursor = addDaysUtc(cursor, 1);
  }

  return slotTimes;
}

async function seed(): Promise<void> {
  const sector = resolveSector();
  const sectorConfig = getSector(sector);
  const testPhone = resolveTestPhone();

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  await Promise.all([
    Agency.deleteMany({}),
    Prospect.deleteMany({}),
    Slot.deleteMany({}),
  ]);

  const agency = await Agency.create({
    name: `Agence seed ${sectorConfig.displayName}`,
    agentName: 'Agent Seed',
    agentPhone: testPhone,
    sector,
    businessHours: sectorConfig.defaultBusinessHours,
    isActive: true,
  });

  const slotTimes = buildWorkingDaySlots();

  await Slot.insertMany(
    slotTimes.map((slotTime) => ({
      agencyId: agency._id,
      slotTime,
      isAvailable: true,
      prospectId: null,
    })),
  );

  process.stdout.write(`✅ Agence créée : ${agency.uuid}\n`);
  process.stdout.write(`✅ ${slotTimes.length} slots créés\n`);
  process.stdout.write(
    `📋 Agency UUID à coller dans ton prompt Retell : ${agency.uuid}\n`,
  );
  process.stdout.write(
    `🎯 Sector : ${sector} (${sectorConfig.displayName})\n`,
  );
}

void seed()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    process.stderr.write(`[SEED] Failed: ${message}\n`);

    try {
      await mongoose.connection.close();
    } catch {
      // ignore close errors on failure path
    }

    process.exit(1);
  });
