// Shared helpers for parsing "sale modification" requests out of a
// booking's notes field. The Modifications queue and the calendar day
// popup both need this, so it lives here instead of being duplicated.

export const MODIFICATION_MARKER = 'SALE MODIFICATION REQUIRED';

export type ModificationDetails = {
  instructions: string;
  scheduledDate: string;
  scheduledTime: string;
};

export function modificationDetails(notes: string | null): ModificationDetails {
  const block = notes?.split(MODIFICATION_MARKER)[1] ?? '';
  const instructions =
    block.match(/Details:\s*([\s\S]*?)\nModification date:/)?.[1]?.trim() ||
    'Modification instructions were not added.';
  const scheduledDate =
    block.match(/Modification date:\s*([^\n]+)/)?.[1]?.trim() || '';
  const scheduledTime =
    block.match(/Modification time:\s*([^\n]+)/)?.[1]?.trim() || '';
  return { instructions, scheduledDate, scheduledTime };
}

export function hasModificationRequest(notes: string | null) {
  return Boolean(notes?.includes(MODIFICATION_MARKER));
}
