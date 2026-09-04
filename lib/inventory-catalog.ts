export const INVENTORY_CATEGORIES = [
  'BARATI SAFA',
  'BELT',
  'BROOCH',
  'CRAVAT',
  'DEAD STOCK',
  'DUPATTA',
  'FEATHERS',
  'GROOM SAFA',
  'KATAR',
  'MALA',
  'MOD',
  'POCKET BROOCH',
  'SCARF',
  'TALWAR',
  'Velcro Safa',
  'VINTAGE ROLLS-ROYCE',
] as const;

export const BARATI_SAFA_SUBCATEGORIES = Array.from(
  { length: 9 },
  (_, index) => `Package ${index + 1}`,
);

export function sameInventoryValue(
  value: string | null | undefined,
  selected: string,
) {
  return (
    value?.trim().toLocaleLowerCase() === selected.trim().toLocaleLowerCase()
  );
}
