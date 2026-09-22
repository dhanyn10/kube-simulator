import { describe, it, expect } from 'vitest';
import {
  PREDEFINED_KEYS,
  findActiveKeyInfo,
  filterKeysByQuery,
  filterValuesByQuery,
  buildConfigMapItem,
} from '@/activities/modals/configMapModalHelpers';

describe('configMapModalHelpers', () => {
  it('PREDEFINED_KEYS exports standard configmap keys', () => {
    expect(PREDEFINED_KEYS.length).toBeGreaterThan(0);
    const keys = PREDEFINED_KEYS.map((k) => k.key);
    expect(keys).toContain('PORT');
    expect(keys).toContain('MAX_CONNECTIONS');
    expect(keys).toContain('LOG_LEVEL');
    expect(keys).toContain('CHAOS_MODE');
  });

  it('findActiveKeyInfo returns key suggestion when found (case-insensitive) or undefined when missing', () => {
    const portInfo = findActiveKeyInfo('port');
    expect(portInfo).toBeDefined();
    expect(portInfo?.key).toBe('PORT');

    const missingInfo = findActiveKeyInfo('UNKNOWN_KEY');
    expect(missingInfo).toBeUndefined();
  });

  it('filterKeysByQuery filters keys matching partial search query', () => {
    const matched = filterKeysByQuery('conn');
    expect(matched).toHaveLength(1);
    expect(matched[0].key).toBe('MAX_CONNECTIONS');

    const empty = filterKeysByQuery('nonexistent');
    expect(empty).toHaveLength(0);
  });

  it('filterValuesByQuery filters values matching query or description', () => {
    const portInfo = findActiveKeyInfo('PORT');
    const matchedVal = filterValuesByQuery(portInfo, '8080');
    expect(matchedVal).toHaveLength(1);
    expect(matchedVal[0].value).toBe('8080');

    const matchedDesc = filterValuesByQuery(portInfo, 'Secure');
    expect(matchedDesc).toHaveLength(1);
    expect(matchedDesc[0].value).toBe('8443');

    const emptyFilter = filterValuesByQuery(undefined, '80');
    expect(emptyFilter).toHaveLength(0);
  });

  it('buildConfigMapItem creates a formatted K8sConfigMapItem with fallback defaults', () => {
    const item1 = buildConfigMapItem('cm-123', 'My App Config!', [{ key: 'PORT', value: '80' }]);
    expect(item1.id).toBe('cm-123');
    expect(item1.name).toBe('my-app-config');
    expect(item1.configData).toEqual([{ key: 'PORT', value: '80' }]);

    const item2 = buildConfigMapItem(undefined, '   ', []);
    expect(item2.id).toBeDefined();
    expect(item2.name).toBe('unnamed-configmap');
    expect(item2.configData).toEqual([]);
  });
});
