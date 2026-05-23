import { Prospect } from '../models/Prospect';
import { isValidUuid } from '../utils/uuid';
import { logToolEvent } from './tool-log';
import type { ToolResult } from './tool-result.types';
import { toToolError } from './tool-result.types';

export type SaveSummaryInput = {
  readonly prospectId: string;
  readonly resume: string;
};

export async function saveSummary(
  input: SaveSummaryInput,
): Promise<ToolResult> {
  try {
    if (!isValidUuid(input.prospectId)) {
      logToolEvent('saveSummary: invalid UUID', { prospectId: input.prospectId });
      return { success: false, error: 'Invalid prospect UUID' };
    }

    if (input.resume.trim() === '') {
      logToolEvent('saveSummary: empty resume', { prospectId: input.prospectId });
      return { success: false, error: 'Resume cannot be empty' };
    }

    const prospect = await Prospect.findOneAndUpdate(
      { uuid: input.prospectId },
      { resume: input.resume },
      { new: true },
    );

    if (prospect === null) {
      logToolEvent('saveSummary: prospect not found', { prospectId: input.prospectId });
      return { success: false, error: 'Prospect not found' };
    }

    logToolEvent('saveSummary: resume saved', { prospectId: input.prospectId });

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = toToolError(error);
    logToolEvent('saveSummary: error', { prospectId: input.prospectId, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}
