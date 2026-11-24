/**
 * Palette of material colors mapping display names (e.g. 'Red', 'Blue Grey') to CSS variable
 * token names (`var(--color-mat-...)`). Used for palette pickers in the canvas config UI.
 */
export const MATERIAL_COLORS = [
  { name: 'Red', hex: 'var(--color-mat-red)' }, { name: 'Pink', hex: 'var(--color-mat-pink)' },
  { name: 'Purple', hex: 'var(--color-mat-purple)' }, { name: 'Deep Purple', hex: 'var(--color-mat-deep-purple)' },
  { name: 'Indigo', hex: 'var(--color-mat-indigo)' }, { name: 'Blue', hex: 'var(--color-mat-blue)' },
  { name: 'Light Blue', hex: 'var(--color-mat-light-blue)' }, { name: 'Cyan', hex: 'var(--color-mat-cyan)' },
  { name: 'Teal', hex: 'var(--color-mat-teal)' }, { name: 'Green', hex: 'var(--color-mat-green)' },
  { name: 'Light Green', hex: 'var(--color-mat-light-green)' }, { name: 'Lime', hex: 'var(--color-mat-lime)' },
  { name: 'Yellow', hex: 'var(--color-mat-yellow)' }, { name: 'Amber', hex: 'var(--color-mat-amber)' },
  { name: 'Orange', hex: 'var(--color-mat-orange)' }, { name: 'Deep Orange', hex: 'var(--color-mat-deep-orange)' },
  { name: 'Brown', hex: 'var(--color-mat-brown)' }, { name: 'Grey', hex: 'var(--color-mat-grey)' },
  { name: 'Blue Grey', hex: 'var(--color-mat-blue-grey)' },
];

/**
 * Returns the hex token for a material color by display name, falling back to the first
 * palette entry when the name isn't found.
 *
 * @param name - Material color display name (e.g. 'Red').
 * @returns CSS variable string for the color.
 */
export const getMaterialColor = (name: string) => {
  return MATERIAL_COLORS.find(c => c.name === name)?.hex || MATERIAL_COLORS[0].hex;
};
