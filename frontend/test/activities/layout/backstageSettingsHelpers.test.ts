import { describe, it, expect } from 'vitest';
import {
  getSettingsActiveBtnClass,
  getSettingsInactiveBtnClass,
  getPatternButtonClass,
  getSettingLabelClass,
  formatOpacityPercentage,
} from '@/activities/layout/backstageSettingsHelpers';

describe('backstageSettingsHelpers', () => {
  it('returns active button class', () => {
    expect(getSettingsActiveBtnClass()).toContain('bg-blue-600');
  });

  it('returns inactive button class for dark and light modes', () => {
    expect(getSettingsInactiveBtnClass(true)).toContain('bg-slate-800');
    expect(getSettingsInactiveBtnClass(false)).toContain('bg-slate-100');
  });

  it('returns pattern button class based on active status and theme mode', () => {
    expect(getPatternButtonClass(true, true)).toContain('bg-blue-600');
    expect(getPatternButtonClass(false, true)).toContain('bg-slate-800');
    expect(getPatternButtonClass(false, false)).toContain('bg-slate-100');
  });

  it('returns setting label class for dark and light modes', () => {
    expect(getSettingLabelClass(true)).toContain('bg-slate-900');
    expect(getSettingLabelClass(false)).toContain('bg-white');
  });

  it('formats opacity float to integer percentage', () => {
    expect(formatOpacityPercentage(0.5)).toBe(50);
    expect(formatOpacityPercentage(0.75)).toBe(75);
    expect(formatOpacityPercentage(1.0)).toBe(100);
  });
});
