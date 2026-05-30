import 'dotenv/config';

import mongoose from 'mongoose';

import { Agency } from '../src/core/models/Agency';
import { Listing } from '../src/core/models/Listing';

const MONGODB_URI = process.env.MONGODB_URI ?? '';

async function seedListing(): Promise<void> {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const agency = await Agency.findOne({}).lean();
  if (agency === null) {
    process.stderr.write('[SEED] No agency found. Run seed first.\n');
    process.exit(1);
  }

  await Listing.deleteMany({ agencyId: agency._id });

  const listing = await Listing.create({
    agencyId: agency._id,
    reference: 'VM1802',
    type: 'maison',
    city: 'Cergy',
    price: 525000,
    surface: 120,
    surfaceTerrain: 500,
    rooms: 6,
    bedrooms: 4,
    description:
      'Maison bourgeoise de 1850 entièrement rénovée, 120m² habitables sur 3 niveaux + combles. ' +
      'Espace de vie décloisonné et lumineux, cuisine avec îlot central. ' +
      '4 chambres, 3 salles de bain, cave voûtée. ' +
      'Grange avec niveau supérieur aménageable (~95m²), cour pavée, jardin clos. ' +
      'Exposition Sud-Ouest. À deux pas des commerces, écoles et restaurants. ' +
      'Accès RER A Cergy-Préfecture, A15 à 10 min.',
    features: [
      'Cave voûtée',
      'Grange aménageable 95m²',
      'Cour pavée',
      'Jardin clos',
      '2 places de parking couvertes',
      '2 places extérieures',
      'Cuisine ouverte avec îlot',
      'Chauffage gaz',
      'Exposition Sud-Ouest',
    ],
    isActive: true,
  });

  process.stdout.write(`✅ Annonce créée : ${listing.reference} — ${listing.type} ${listing.surface}m² à ${listing.city} — ${listing.price.toLocaleString('fr-FR')}€\n`);
  process.stdout.write(`   UUID : ${listing.uuid}\n`);

  await mongoose.disconnect();
}

void seedListing().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`[SEED] Failed: ${message}\n`);
  process.exit(1);
});
