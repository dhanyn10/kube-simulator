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

    // Symbols that sanitize to empty string fall back to id (line 72: name || id)
    const item4 = buildConfigMapItem('cm-symbols', '---!!!', []);
    expect(item4.name).toBe('cm-symbols');
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

    it('handles fallbackBase and pod fallback when baseName is missing or data is undefined (lines 121-122)', () => {
      // baseName missing, but data.podHash exists without label -> extractPodBaseName returns 'pod' as fallbackBase
      const podNoBase = {
        id: 'pod-no-base',
        type: 'Pod',
        data: { podHash: '7f9b2' },
      };
      const info1 = getPodReplicaGroupInfo(podNoBase);
      expect(info1.isGroup).toBe(true);
      expect(info1.groupLabel).toBe('pod-7f9b2');

      // Getter returns data with podHash on first access, undefined on second access (line 121 : undefined, line 122 || 'pod')
      let accessCount = 0;
      const dynamicPod = {
        type: 'Pod',
        get data() {
          return accessCount++ === 0 ? { podHash: '9x8y7' } : undefined;
        },
      };
      const info2 = getPodReplicaGroupInfo(dynamicPod);
      expect(info2.isGroup).toBe(true);
      expect(info2.groupLabel).toBe('pod-9x8y7');
    });

    it('falls back to id or empty string for nodes missing data, label, or id (lines 133-134)', () => {
      // Node without label falls back to node.id
      const nodeNoLabel = { id: 'orphan-node', data: {} };
      const info1 = getPodReplicaGroupInfo(nodeNoLabel);
      expect(info1.groupKey).toBe('orphan-node');
      expect(info1.groupLabel).toBe('orphan-node');

      // Empty node without id or label falls back to empty strings
      const emptyNode = {};
      const info2 = getPodReplicaGroupInfo(emptyNode);
      expect(info2.groupKey).toBe('');
      expect(info2.groupLabel).toBe('');
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

    it('safely handles nodes with missing type and dynamic type fallback (lines 160 & 168)', () => {
      let typeAccess = 0;
      const dynamicTypeNode = {
        id: 'dyn-type-1',
        get type() {
          return typeAccess++ === 0 ? 'Deployment' : undefined;
        },
        data: { label: 'dyn-deploy' },
      };
      const nodesWithMissingAndDyn = [
        { id: 'missing-type-node', data: {} },
        dynamicTypeNode,
      ];
      const result = getAvailableWorkloadComponents(nodesWithMissingAndDyn);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'dyn-type-1', label: 'dyn-deploy', type: 'Node' });
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

    it('evaluates group replica matching in alreadyPresent (line 197)', () => {
      const targetPod = {
        id: 'pod-worker-1',
        type: 'Pod',
        data: { baseName: 'worker', podHash: 'abc12', label: 'worker-abc12-xyz01' },
      };
      const nodes = [targetPod];

      // 1. Different component id and different group label -> proceeds to append
      const existingOther = [{ id: 'other-comp', label: 'other-label', type: 'Pod' as const }];
      const res1 = appendTargetComponentOption(existingOther, 'pod-worker-1', undefined, nodes);
      expect(res1).toHaveLength(2);

      // 2. Different component id, but matching groupLabel -> alreadyPresent is true
      const existingMatchingLabel = [{ id: 'different-id', label: 'worker-abc12', type: 'Pod' as const }];
      const res2 = appendTargetComponentOption(existingMatchingLabel, 'pod-worker-1', undefined, nodes);
      expect(res2).toBe(existingMatchingLabel);
    });

    it('handles targetNode not found in nodes (lines 186 & 194)', () => {
      const initial = [{ id: 'comp-1', label: 'comp-1', type: 'Pod' as const }];
      const result = appendTargetComponentOption(initial, 'missing-node-id', 'Missing Label', []);
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        id: 'missing-node-id',
        label: 'Missing Label',
        type: 'Node',
      });
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
