import { describe, it, expect } from 'vitest';
import { getResourceSettingItems } from '../../../src/activity/workload/resourceSettingsHelpers';

describe('resourceSettingsHelpers', () => {
  it('returns correctly styled items when errors are present', () => {
    const items = getResourceSettingItems(true, false);
    expect(items).toHaveLength(5);

    const cpuReq = items.find((i) => i.field === 'cpuRequest');
    expect(cpuReq?.hasError).toBe(true);
    expect(cpuReq?.activeColor).toContain('bg-red-600');

    const memReq = items.find((i) => i.field === 'memoryRequest');
    expect(memReq?.hasError).toBe(false);
    expect(memReq?.activeColor).toContain('bg-emerald-600');
  });
});
