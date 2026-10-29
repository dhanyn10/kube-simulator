import { describe, it, expect } from 'vitest';
import {
  PREDEFINED_KEYS,
  findActiveKeyInfo,
  filterKeysByQuery,
  filterValuesByQuery,
  buildConfigMapItem,
  extractPodHashFromLabel,
  getPodReplicaGroupInfo,
  resolveTargetOptionLabel,
  getAvailableWorkloadComponents,
  appendTargetComponentOption,
  extractUniqueRawItems,
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
  describe('resolveTargetOptionLabel', () => {
    it('returns groupLabel if groupInfo.isGroup is true', () => {
      const groupInfo = { isGroup: true, groupKey: 'pod-group:api-123', groupLabel: 'api-123' };
      expect(resolveTargetOptionLabel(groupInfo, null)).toBe('api-123');
    });

    it('returns targetNode label or id if targetNode is provided', () => {
      const nodeWithLabel = { id: 'node-1', data: { label: 'my-pod' } };
      expect(resolveTargetOptionLabel(null, nodeWithLabel)).toBe('my-pod');

      const nodeWithoutLabel = { id: 'node-2', data: {} };
      expect(resolveTargetOptionLabel(null, nodeWithoutLabel)).toBe('node-2');
    });

    it('falls back to targetNodeLabel or targetNodeId or empty string', () => {
      expect(resolveTargetOptionLabel(null, null, 'custom-label', 'custom-id')).toBe('custom-label');
      expect(resolveTargetOptionLabel(null, null, undefined, 'custom-id')).toBe('custom-id');
      expect(resolveTargetOptionLabel(null, null, undefined, undefined)).toBe('');
    });
  });

  describe('getAvailableWorkloadComponents', () => {
    it('extracts workload components and collapses pod replica groups', () => {
      const nodes = [
        { id: 'dep-1', type: 'Deployment', data: { label: 'web-deploy' } },
        { id: 'pod-1', type: 'Pod', data: { baseName: 'web', podHash: 'abc12', label: 'web-abc12-xyz01' } },
        { id: 'pod-2', type: 'Pod', data: { baseName: 'web', podHash: 'abc12', label: 'web-abc12-xyz02' } },
        { id: 'unknown-1', type: 'CustomResource', data: { label: 'unknown' } },
      ];
      const result = getAvailableWorkloadComponents(nodes);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'dep-1', label: 'web-deploy', type: 'Deployment' });
      expect(result[1]).toEqual({ id: 'pod-group:web-abc12', label: 'web-abc12', type: 'Pod' });
    });
  });

  describe('appendTargetComponentOption', () => {
    it('returns same array if targetNodeId is null or cluster-storage', () => {
      const initial = [{ id: 'comp-1', label: 'comp-1', type: 'Pod' }];
      expect(appendTargetComponentOption(initial, null, undefined, [])).toBe(initial);
      expect(appendTargetComponentOption(initial, 'cluster-storage', undefined, [])).toBe(initial);
    });

    it('appends target node if not already present', () => {
      const initial = [{ id: 'comp-1', label: 'comp-1', type: 'Pod' }];
      const nodes = [{ id: 'target-node', type: 'Deployment', data: { label: 'target-deploy' } }];
      const result = appendTargetComponentOption(initial, 'target-node', undefined, nodes);
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({ id: 'target-node', label: 'target-deploy', type: 'Deployment' });
    });

    it('does not duplicate if already present', () => {
      const initial = [{ id: 'target-node', label: 'target-deploy', type: 'Deployment' }];
      const nodes = [{ id: 'target-node', type: 'Deployment', data: { label: 'target-deploy' } }];
      const result = appendTargetComponentOption(initial, 'target-node', undefined, nodes);
      expect(result).toBe(initial);
    });
  });

  describe('extractUniqueRawItems', () => {
    it('extracts unique raw items filtering out currentId and duplicate names', () => {
      const items = [
        { id: 'item-1', rawItem: { id: 'item-1', name: 'config-a' } },
        { id: 'item-2', rawItem: { id: 'item-2', name: 'config-b' } },
        { id: 'item-3', rawItem: { id: 'item-3', name: 'config-b' } }, // duplicate name of item-2
      ];
      const result = extractUniqueRawItems(items as any, 'item-1');
      expect(result).toEqual([{ id: 'item-2', name: 'config-b' }]);
    });
  });
});
