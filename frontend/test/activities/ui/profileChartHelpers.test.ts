import { describe, it, expect } from 'vitest';
import {
  getMiniHoverDotClass,
  getGuideLineStroke,
  getPointFillClass,
} from '@/activities/ui/profileChartHelpers';

describe('profileChartHelpers', () => {
  it('calculates mini hover dot class correctly', () => {
    expect(getMiniHoverDotClass(true, false)).toContain('fill-emerald-400');
    expect(getMiniHoverDotClass(true, true)).toContain('fill-rose-500');
    expect(getMiniHoverDotClass(false, false)).toContain('fill-blue-300');
  });

  it('calculates guide line stroke color correctly', () => {
    expect(getGuideLineStroke(true, false, true, false)).toBe('#10b981');
    expect(getGuideLineStroke(true, false, true, true)).toBe('#f43f5e');
    expect(getGuideLineStroke(false, true, false, false)).toBe('#34d399');
    expect(getGuideLineStroke(false, true, false, true)).toBe('#f43f5e');
    expect(getGuideLineStroke(false, false, false, false)).toBe('#3b82f6');
  });

  it('calculates point fill class correctly', () => {
    expect(getPointFillClass(true, true, false, false, false)).toContain('fill-emerald-400');
    expect(getPointFillClass(true, true, false, false, true)).toContain('fill-rose-500');
    expect(getPointFillClass(false, false, true, false, false)).toContain('fill-emerald-400');
    expect(getPointFillClass(false, false, true, false, true)).toContain('fill-rose-500');
    expect(getPointFillClass(false, false, false, true, false)).toContain('fill-blue-400');
    expect(getPointFillClass(false, false, false, false, false)).toContain('fill-blue-500');
  });
});
