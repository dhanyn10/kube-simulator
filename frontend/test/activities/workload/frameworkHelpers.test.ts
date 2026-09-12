import { describe, it, expect } from 'vitest';
import {
  getFrameworksForRuntime,
  getFrameworkButtonClass,
} from '@/activities/workload/frameworkHelpers';

describe('frameworkHelpers', () => {
  it('getFrameworksForRuntime returns frameworks list for valid runtime', () => {
    expect(getFrameworksForRuntime('')).toBeNull();
    expect(getFrameworksForRuntime('none')).toBeNull();
    expect(getFrameworksForRuntime('nodejs')).toBeDefined();
  });

  it('getFrameworkButtonClass returns correct class according to active status and color mode', () => {
    expect(getFrameworkButtonClass(true, 'dark')).toContain('bg-emerald-600');
    expect(getFrameworkButtonClass(false, 'dark')).toContain('bg-slate-950');
    expect(getFrameworkButtonClass(false, 'light')).toContain('bg-white');
  });
});
