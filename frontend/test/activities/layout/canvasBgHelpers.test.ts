import { describe, it, expect } from 'vitest';
import { getFinalCanvasBgColor } from '@/activities/layout/canvasBgHelpers';

describe('canvasBgHelpers', () => {
  it('returns dark mode default background color when canvasBgColor is default in dark mode', () => {
    expect(getFinalCanvasBgColor('default', 'dark')).toBe('#334155');
  });

  it('returns light mode default background color when canvasBgColor is default in light mode', () => {
    expect(getFinalCanvasBgColor('default', 'light')).toBe('#94A3B8');
  });

  it('returns custom color when canvasBgColor is not default', () => {
    expect(getFinalCanvasBgColor('#1e293b', 'dark')).toBe('#1e293b');
  });
});
