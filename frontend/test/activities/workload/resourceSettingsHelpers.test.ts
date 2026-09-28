import { describe, it, expect } from 'vitest';
import { getResourceSettingItems } from '@/activities/workload/resourceSettingsHelpers';

describe('resourceSettingsHelpers', () => {
  it('returns resource setting items in correct order', () => {
    const items = getResourceSettingItems();
    expect(items).toHaveLength(5);

    expect(items[0].field).toBe('cpuLimit');
    expect(items[1].field).toBe('cpuRequest');
    expect(items[3].field).toBe('memoryLimit');
    expect(items[4].field).toBe('memoryRequest');
  });
});
