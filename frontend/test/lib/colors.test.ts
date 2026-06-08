import { describe, it, expect } from 'vitest';
import { getMaterialColor, MATERIAL_COLORS } from '@/lib/colors';

describe('colors lib', () => {
  it('should return correct hex for valid material color name', () => {
    expect(getMaterialColor('Red')).toBe('var(--color-mat-red)');
    expect(getMaterialColor('Blue')).toBe('var(--color-mat-blue)');
    expect(getMaterialColor('Green')).toBe('var(--color-mat-green)');
  });

  it('should return default color for invalid material color name', () => {
    const defaultColor = MATERIAL_COLORS[0].hex;
    expect(getMaterialColor('NonExistentColor')).toBe(defaultColor);
    expect(getMaterialColor('')).toBe(defaultColor);
  });
});
