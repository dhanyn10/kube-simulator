
export const MATERIAL_COLORS = [
  { name: 'Red', hex: 'var(--color-mat-red)' },
  { name: 'Pink', hex: 'var(--color-mat-pink)' },
  { name: 'Purple', hex: 'var(--color-mat-purple)' },
  { name: 'Deep Purple', hex: 'var(--color-mat-deep-purple)' },
  { name: 'Indigo', hex: 'var(--color-mat-indigo)' },
  { name: 'Blue', hex: 'var(--color-mat-blue)' },
  { name: 'Light Blue', hex: 'var(--color-mat-light-blue)' },
  { name: 'Cyan', hex: 'var(--color-mat-cyan)' },
  { name: 'Teal', hex: 'var(--color-mat-teal)' },
  { name: 'Green', hex: 'var(--color-mat-green)' },
  { name: 'Light Green', hex: 'var(--color-mat-light-green)' },
  { name: 'Lime', hex: 'var(--color-mat-lime)' },
  { name: 'Yellow', hex: 'var(--color-mat-yellow)' },
  { name: 'Amber', hex: 'var(--color-mat-amber)' },
  { name: 'Orange', hex: 'var(--color-mat-orange)' },
  { name: 'Deep Orange', hex: 'var(--color-mat-deep-orange)' },
  { name: 'Brown', hex: 'var(--color-mat-brown)' },
  { name: 'Grey', hex: 'var(--color-mat-grey)' },
  { name: 'Blue Grey', hex: 'var(--color-mat-blue-grey)' },
];

export const getMaterialColor = (name: string) => {
  return MATERIAL_COLORS.find(c => c.name === name)?.hex || MATERIAL_COLORS[0].hex;
};
