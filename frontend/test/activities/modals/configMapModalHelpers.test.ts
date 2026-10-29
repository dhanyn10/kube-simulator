import { describe, it, expect } from 'vitest';
import {
  PREDEFINED_KEYS,
  findActiveKeyInfo,
  filterKeysByQuery,
  filterValuesByQuery,
  buildConfigMapItem,
  extractPodHashFromLabel,
  getPodReplicaGroupInfo,
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
    expect(item2.name).toBe(item2.id);
    expect(item2.configData).toEqual([]);

    const item3 = buildConfigMapItem('cm-custom-id', '', []);
    expect(item3.id).toBe('cm-custom-id');
    expect(item3.name).toBe('cm-custom-id');
  });

  describe('extractPodHashFromLabel', () => {
    it('extracts baseName and podHash from standard replica pod label', () => {
      const res1 = extractPodHashFromLabel('web-pod-7f9b2-a1b2c');
      expect(res1).toEqual({ baseName: 'web-pod', podHash: '7f9b2' });

      const res2 = extractPodHashFromLabel('my-service-app-abc12-xyz34');
      expect(res2).toEqual({ baseName: 'my-service-app', podHash: 'abc12' });
    });

    it('returns empty object for non-conforming or short labels', () => {
      expect(extractPodHashFromLabel(undefined)).toEqual({});
      expect(extractPodHashFromLabel('')).toEqual({});
      expect(extractPodHashFromLabel('simplepod')).toEqual({});
      expect(extractPodHashFromLabel('app-pod')).toEqual({});
      expect(extractPodHashFromLabel('app-pod-123')).toEqual({});
    });
  });

  describe('getPodReplicaGroupInfo', () => {
    it('returns replica group info for Pod node with podHash', () => {
      const node = {
        id: 'pod-1',
        type: 'Pod',
        data: {
          baseName: 'frontend',
          podHash: '7f9b2',
          replicaSuffix: 'k9j10',
          label: 'frontend-7f9b2-k9j10',
        },
      };
      const info = getPodReplicaGroupInfo(node);
      expect(info).toEqual({
        isGroup: true,
        groupKey: 'pod-group:frontend-7f9b2',
        groupLabel: 'frontend-7f9b2',
      });
    });

    it('infers group info from pod label when podHash is not explicitly on data', () => {
      const node = {
        id: 'pod-2',
        type: 'Pod',
        data: {
          label: 'worker-4d5e6-7a8b9',
        },
      };
      const info = getPodReplicaGroupInfo(node);
      expect(info).toEqual({
        isGroup: true,
        groupKey: 'pod-group:worker-4d5e6',
        groupLabel: 'worker-4d5e6',
      });
    });

    it('returns individual node info for standalone Pod without hash or for non-Pod node', () => {
      const standalonePod = {
        id: 'pod-solo',
        type: 'Pod',
        data: { label: 'my-single-pod' },
      };
      expect(getPodReplicaGroupInfo(standalonePod)).toEqual({
        isGroup: false,
        groupKey: 'pod-solo',
        groupLabel: 'my-single-pod',
      });

      const deploymentNode = {
        id: 'dep-1',
        type: 'Deployment',
        data: { label: 'web-deploy' },
      };
      expect(getPodReplicaGroupInfo(deploymentNode)).toEqual({
        isGroup: false,
        groupKey: 'dep-1',
        groupLabel: 'web-deploy',
      });
    });
  });
});
