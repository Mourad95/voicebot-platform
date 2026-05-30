import { Listing } from '../models/Listing';
import { resolveAgencyObjectId } from '../persistence/resolve-by-uuid';
import { isValidUuid } from '../utils/uuid';
import { logToolEvent } from './tool-log';
import type { ToolResult } from './tool-result.types';
import { toToolError } from './tool-result.types';

export type GetListingData = {
  readonly reference: string;
  readonly type: string;
  readonly city: string;
  readonly price: number;
  readonly surface: number;
  readonly surfaceTerrain?: number;
  readonly rooms: number;
  readonly bedrooms?: number;
  readonly description: string;
  readonly features: string[];
};

export type GetListingResult = ToolResult<{ readonly listing: GetListingData | null }>;

export async function getListing(input: {
  readonly agencyId: string;
  readonly reference: string;
}): Promise<GetListingResult> {
  try {
    if (!isValidUuid(input.agencyId)) {
      return { success: false, error: 'Invalid agency UUID' };
    }

    const agencyObjectId = await resolveAgencyObjectId(input.agencyId);
    if (agencyObjectId === null) {
      return { success: false, error: 'Agency not found' };
    }

    const listing = await Listing.findOne({
      agencyId: agencyObjectId,
      reference: input.reference.trim().toUpperCase(),
      isActive: true,
    }).lean();

    if (listing === null) {
      logToolEvent('getListing: not found', { reference: input.reference });
      return { success: true, listing: null };
    }

    logToolEvent('getListing: found', { reference: listing.reference, city: listing.city });

    return {
      success: true,
      listing: {
        reference: listing.reference,
        type: listing.type,
        city: listing.city,
        price: listing.price,
        surface: listing.surface,
        surfaceTerrain: listing.surfaceTerrain,
        rooms: listing.rooms,
        bedrooms: listing.bedrooms,
        description: listing.description,
        features: listing.features,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: toToolError(error) };
  }
}
