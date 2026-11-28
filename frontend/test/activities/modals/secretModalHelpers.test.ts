import { describe, it, expect, vi } from 'vitest';
import {
  resolveTargetOptionLabel,
  buildSecretItem,
  findAllAttachedSecretComponents,
  syncNodesSecret,
  mergeAttachedSecretComponents,
  removeSecretFromNodeOrStore,
  detachSecretComponent,
  attachSecretComponent,
  getSecretModalTitle,
  getSecretModalSubtitle,
} from '@/activities/modals/secretModalHelpers';
import { K8sSecretItem } from '@/types';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';

describe('secretModalHelpers', () => {
  describe('resolveTargetOptionLabel', () => {
    it('returns group label when groupInfo is a group', () => {
      const groupInfo = {
        isGroup: true,
        groupKey: 'pod-group:backend-7a8b9',
        groupLabel: 'backend-7a8b9',
      };
      const label = resolveTargetOptionLabel(groupInfo, { id: 'pod-1' }, 'My Pod', 'pod-1');
      expect(label).toBe('backend-7a8b9');
    });

    it('returns targetNode label or id when groupInfo is not a group', () => {
      const groupInfo = {
        isGroup: false,
        groupKey: 'node-1',
        groupLabel: 'solo-pod',
      };
      const labelWithDataLabel = resolveTargetOptionLabel(
        groupInfo,
        { id: 'node-1', data: { label: 'Node Label' } },
        'Fallback Label'
      );
      expect(labelWithDataLabel).toBe('Node Label');

      const labelWithNodeId = resolveTargetOptionLabel(
        null,
        { id: 'node-2' },
        'Fallback'
      );
      expect(labelWithNodeId).toBe('node-2');
    });

    it('falls back to targetNodeLabel, targetNodeId, or empty string', () => {
      expect(resolveTargetOptionLabel(null, null, 'Fallback Label', 'node-3')).toBe('Fallback Label');
      expect(resolveTargetOptionLabel(null, null, undefined, 'node-3')).toBe('node-3');
      expect(resolveTargetOptionLabel(null, null, undefined, undefined)).toBe('');
    });
  });

  describe('buildSecretItem', () => {
    it('builds a secret item with specified initialId, sanitized name, type, and secretData', () => {
      const item = buildSecretItem('sec-101', 'My Secret Key!', 'kubernetes.io/tls', [
        { key: 'tls.crt', value: 'cert' },
      ]);
      expect(item.id).toBe('sec-101');
      expect(item.name).toBe('my-secret-key');
      expect(item.type).toBe('kubernetes.io/tls');
      expect(item.secretData).toEqual([{ key: 'tls.crt', value: 'cert' }]);
    });

    it('generates an ID and defaults name to ID if name is empty or whitespace', () => {
      const item = buildSecretItem(undefined, '   ', undefined, []);
      expect(item.id).toMatch(/^secret-\d+-[a-f0-9]+$/);
      expect(item.name).toBe(item.id);
      expect(item.type).toBe('Opaque');
      expect(item.secretData).toEqual([]);
    });

    it('preserves existing ID and defaults name to existing ID when name is blank', () => {
      const item = buildSecretItem('sec-custom-id', '', '', []);
      expect(item.id).toBe('sec-custom-id');
      expect(item.name).toBe('sec-custom-id');
      expect(item.type).toBe('Opaque');
    });

    it('falls back to generated id when a non-empty name sanitizes to an empty slug', () => {
      const item = buildSecretItem(undefined, '!!!', undefined, []);
      expect(item.name).toBe(item.id);
    });
  });

  describe('findAllAttachedSecretComponents', () => {
    it('returns empty array if both secId and secName are falsy', () => {
      expect(findAllAttachedSecretComponents(undefined, undefined, [])).toEqual([]);
      expect(findAllAttachedSecretComponents('', '', [])).toEqual([]);
    });

    it('finds attached components from node.data.secrets by ID or Name', () => {
      const nodes = [
        {
          id: 'deploy-1',
          type: 'Deployment',
          data: {
            label: 'web-deploy',
            secrets: [{ id: 'sec-1', name: 'app-secret' }],
          },
        },
        {
          id: 'svc-1',
          type: 'Service',
          data: {
            label: 'web-svc',
            secrets: [{ id: 'other-sec', name: 'other' }],
          },
        },
      ];

      const attached = findAllAttachedSecretComponents('sec-1', 'app-secret', nodes);
      expect(attached).toHaveLength(1);
      expect(attached[0]).toEqual({
        id: 'deploy-1',
        label: 'web-deploy',
        type: 'Deployment',
      });
    });

    it('deduplicates multiple replica pods sharing baseName and podHash', () => {
      const nodes = Array.from({ length: 10 }, (_, i) => ({
        id: `pod-replica-${i}`,
        type: 'Pod',
        data: {
          baseName: 'api-server',
          podHash: '8f7a2',
          replicaSuffix: `rep${i}`,
          label: `api-server-8f7a2-rep${i}`,
          secrets: [{ id: 'sec-api', name: 'api-secret' }],
        },
      }));

      const attached = findAllAttachedSecretComponents('sec-api', 'api-secret', nodes);
      expect(attached).toHaveLength(1);
      expect(attached[0]).toEqual({
        id: 'pod-group:api-server-8f7a2',
        label: 'api-server-8f7a2',
        type: 'Pod',
      });
    });

    it('finds attached components through resourceName string', () => {
      const nodes = [
        {
          id: 'worker-node',
          type: 'StatefulSet',
          data: {
            label: 'db-statefulset',
          },
        },
      ];

      const attached = findAllAttachedSecretComponents(
        'sec-db',
        'db-secret',
        nodes,
        'db-statefulset, other-resource'
      );
      expect(attached).toHaveLength(1);
      expect(attached[0].label).toBe('db-statefulset');
    });

    it('matches resourceName against node id and pod replica group label or prefix', () => {
      const nodes = [
        {
          id: 'worker-node',
          type: 'StatefulSet',
          data: { label: 'db-statefulset' },
        },
        {
          id: 'pod-a',
          type: 'Pod',
          data: {
            baseName: 'api-server',
            podHash: '8f7a2',
            label: 'api-server-8f7a2-rep0',
          },
        },
        {
          id: 'pod-b',
          type: 'Pod',
          data: {
            baseName: 'worker',
            podHash: 'a1b2c',
            label: 'worker-a1b2c-rep1',
          },
        },
      ];

      const attached = findAllAttachedSecretComponents(
        'sec-x',
        'x-secret',
        nodes,
        'worker-node,api-server-8f7a2,worker'
      );

      expect(attached.map((component) => component.id)).toEqual([
        'worker-node',
        'pod-group:api-server-8f7a2',
        'pod-group:worker-a1b2c',
      ]);
    });

    it('defaults component type to Node when the node has no type', () => {
      const nodes = [
        {
          id: 'plain-node',
          data: { secrets: [{ id: 'sec-plain' }] },
        },
      ];

      const attached = findAllAttachedSecretComponents('sec-plain', undefined, nodes);

      expect(attached).toEqual([
        { id: 'plain-node', label: 'plain-node', type: 'Node' },
      ]);
    });
  });

  describe('syncNodesSecret', () => {
    it('attaches secret to specified nodes and pod replica groups', () => {
      const updateNodeDataMock = vi.fn();
      const nodes = [
        {
          id: 'pod-0',
          type: 'Pod',
          data: {
            baseName: 'web',
            podHash: 'hash1',
            label: 'web-hash1-a',
            secrets: [],
          },
        },
        {
          id: 'pod-1',
          type: 'Pod',
          data: {
            baseName: 'web',
            podHash: 'hash1',
            label: 'web-hash1-b',
            secrets: [],
          },
        },
        {
          id: 'pod-other',
          type: 'Pod',
          data: {
            label: 'unrelated',
            secrets: [{ id: 'sec-1', name: 'my-sec' }],
          },
        },
      ];

      const secretItem: K8sSecretItem = {
        id: 'sec-1',
        name: 'my-sec',
        type: 'Opaque',
        secretData: [{ key: 'PASS', value: '123' }],
      };

      const attachedIds = new Set(['pod-group:web-hash1']);

      syncNodesSecret(
        nodes,
        'sec-1',
        'my-sec',
        undefined,
        secretItem,
        attachedIds,
        updateNodeDataMock
      );

      // Both pod replicas in the group should be updated with the secret
      expect(updateNodeDataMock).toHaveBeenCalledWith('pod-0', { secrets: [secretItem] });
      expect(updateNodeDataMock).toHaveBeenCalledWith('pod-1', { secrets: [secretItem] });
      // The unrelated node should have its secret removed because attachedIds does not contain it
      expect(updateNodeDataMock).toHaveBeenCalledWith('pod-other', { secrets: [] });
    });

    it('updates existing secret item when already present on an attached node', () => {
      const updateNodeDataMock = vi.fn();
      const oldSecret: K8sSecretItem = {
        id: 'sec-1',
        name: 'old-name',
        type: 'Opaque',
        secretData: [{ key: 'OLD', value: 'old' }],
      };
      const newSecret: K8sSecretItem = {
        id: 'sec-1',
        name: 'new-name',
        type: 'Opaque',
        secretData: [{ key: 'NEW', value: 'new' }],
      };

      const nodes = [
        {
          id: 'deploy-1',
          type: 'Deployment',
          data: {
            label: 'frontend',
            secrets: [oldSecret],
          },
        },
      ];

      syncNodesSecret(
        nodes,
        'sec-1',
        'new-name',
        'old-name',
        newSecret,
        new Set(['deploy-1']),
        updateNodeDataMock
      );

      expect(updateNodeDataMock).toHaveBeenCalledWith('deploy-1', { secrets: [newSecret] });
    });

    it('attaches to nodes without a secrets array and keeps unrelated secrets', () => {
      const updateNodeDataMock = vi.fn();
      const oldSecret: K8sSecretItem = {
        id: 'sec-old',
        name: 'legacy',
        type: 'Opaque',
        secretData: [],
      };
      const otherSecret: K8sSecretItem = {
        id: 'sec-other',
        name: 'other',
        type: 'Opaque',
        secretData: [],
      };
      const newSecret: K8sSecretItem = {
        id: 'sec-old',
        name: 'renamed',
        type: 'Opaque',
        secretData: [],
      };
      const nodes = [
        { id: 'bare-node' },
        { id: 'legacy-node', data: { secrets: [oldSecret, otherSecret] } },
        { id: 'unrelated-node', data: { secrets: [otherSecret] } },
      ];

      syncNodesSecret(
        nodes,
        undefined,
        '',
        'legacy',
        newSecret,
        new Set(['bare-node', 'legacy-node']),
        updateNodeDataMock
      );

      expect(updateNodeDataMock).toHaveBeenCalledWith('bare-node', { secrets: [newSecret] });
      expect(updateNodeDataMock).toHaveBeenCalledWith('legacy-node', {
        secrets: [newSecret, otherSecret],
      });
      expect(updateNodeDataMock).not.toHaveBeenCalledWith('unrelated-node', expect.anything());
    });

    it('matches existing secrets by secName when targetId does not match', () => {
      const updateNodeDataMock = vi.fn();
      const secretItem: K8sSecretItem = {
        id: 'sec-new',
        name: 'name-match',
        type: 'Opaque',
        secretData: [],
      };
      const nodes = [
        {
          id: 'node-1',
          data: { secrets: [{ id: 'other-sec', name: 'name-match' }] },
        },
      ];

      syncNodesSecret(
        nodes,
        'missing-id',
        'name-match',
        undefined,
        secretItem,
        new Set(['node-1']),
        updateNodeDataMock
      );

      expect(updateNodeDataMock).toHaveBeenCalledWith('node-1', { secrets: [secretItem] });
    });
  });

  describe('mergeAttachedSecretComponents', () => {
    it('merges current attached components with source secret attached components without duplicates', () => {
      const current = [
        { id: 'node-1', label: 'node-1', type: 'Pod' },
      ];
      const sourceSec: K8sSecretItem = {
        id: 'sec-src',
        name: 'source-sec',
        type: 'Opaque',
        secretData: [],
      };
      const nodes = [
        {
          id: 'node-1',
          type: 'Pod',
          data: { secrets: [{ id: 'sec-src' }] },
        },
        {
          id: 'node-2',
          type: 'Deployment',
          data: { label: 'node-2', secrets: [{ id: 'sec-src' }] },
        },
      ];

      const merged = mergeAttachedSecretComponents(current, sourceSec, nodes);
      expect(merged).toHaveLength(2);
      expect(merged.map((m) => m.id)).toEqual(['node-1', 'node-2']);
    });
  });

  describe('removeSecretFromNodeOrStore', () => {
    it('removes matching secret from all nodes on canvas and adds log', () => {
      const updateNodeData = vi.fn();
      const addLog = vi.fn();

      const item: OverviewItem = {
        id: 'sec-to-delete',
        name: 'my-secret',
        rawItem: { id: 'sec-to-delete', name: 'my-secret' },
        ownerNode: { id: 'pod-1', label: 'web-pod', type: 'Pod' },
      };

      const nodes = [
        {
          id: 'pod-1',
          data: {
            label: 'web-pod',
            secrets: [{ id: 'sec-to-delete', name: 'my-secret' }],
          },
        },
        {
          id: 'pod-2',
          data: {
            label: 'api-pod',
            secrets: [{ id: 'other-sec', name: 'other-secret' }],
          },
        },
      ];

      removeSecretFromNodeOrStore(item, nodes, updateNodeData, addLog);

      expect(updateNodeData).toHaveBeenCalledWith('pod-1', { secrets: [] });
      expect(updateNodeData).not.toHaveBeenCalledWith('pod-2', expect.anything());
      expect(addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining("[Attached Resource] Removed Secret 'my-secret' from web-pod"),
        'UI'
      );
    });

    it('handles cluster-storage item by invoking deleteSavedSecret without touching canvas nodes', () => {
      const updateNodeData = vi.fn();
      const addLog = vi.fn();
      const deleteSavedSecret = vi.fn();

      const item: OverviewItem = {
        id: 'sec-cluster-item',
        name: 'cluster-secret',
        rawItem: { id: 'sec-cluster-item', name: 'cluster-secret' },
        ownerNode: { id: 'cluster-storage', label: 'Cluster (Local Storage)', type: 'Secret' },
      };

      const nodes = [
        {
          id: 'pod-1',
          data: { secrets: [{ id: 'sec-cluster-item', name: 'cluster-secret' }] },
        },
      ];

      removeSecretFromNodeOrStore(item, nodes, updateNodeData, addLog, deleteSavedSecret);

      expect(updateNodeData).not.toHaveBeenCalled();
      expect(deleteSavedSecret).toHaveBeenCalledWith('sec-cluster-item');
    });

    it('falls back to node id in logs and skips nodes without secrets', () => {
      const updateNodeData = vi.fn();
      const addLog = vi.fn();
      const item: OverviewItem = {
        id: 'sec-rm',
        name: 'remove-me',
        rawItem: { id: 'sec-rm', name: 'remove-me' },
        ownerNode: { id: 'pod-1', label: 'web', type: 'Pod' },
      };
      const nodes = [
        { id: 'no-data-node' },
        {
          id: 'unlabeled-node',
          data: { secrets: [{ id: 'sec-rm', name: 'remove-me' }] },
        },
      ];

      removeSecretFromNodeOrStore(item, nodes, updateNodeData, addLog);

      expect(updateNodeData).toHaveBeenCalledWith('unlabeled-node', { secrets: [] });
      expect(updateNodeData).not.toHaveBeenCalledWith('no-data-node', expect.anything());
      expect(addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('from unlabeled-node'),
        'UI'
      );
    });
  });
  describe('detachSecretComponent', () => {
    it('removes target secret by id or name from matched nodes and logs', () => {
      const updateNodeData = vi.fn();
      const addLog = vi.fn();
      const nodes = [
        {
          id: 'pod-1',
          data: {
            label: 'web-pod',
            secrets: [
              { id: 'sec-1', name: 'db-secret' },
              { id: 'sec-2', name: 'api-secret' },
            ],
          },
        },
      ];

      detachSecretComponent({
        nodes,
        componentId: 'pod-1',
        targetSecId: 'sec-1',
        secretName: 'db-secret',
        oldSecName: undefined,
        updateNodeData,
        addLog,
      });

      expect(updateNodeData).toHaveBeenCalledWith('pod-1', {
        secrets: [{ id: 'sec-2', name: 'api-secret' }],
      });
      expect(addLog).toHaveBeenCalledWith(
        'info',
        "[Secret] Removed attached component 'web-pod' from Secret 'db-secret'",
        'UI'
      );
    });

    it('matches pod replica groups, skips unrelated nodes, and handles missing secrets and labels', () => {
      const updateNodeData = vi.fn();
      const addLog = vi.fn();
      const nodes = [
        { id: 'other-node', data: { secrets: [] } },
        {
          id: 'pod-0',
          type: 'Pod',
          data: {
            baseName: 'web',
            podHash: 'h1',
            label: 'web-h1-a',
            secrets: [{ id: 'sec-1', name: 'db-secret' }],
          },
        },
        {
          id: 'pod-1',
          type: 'Pod',
          data: { baseName: 'web', podHash: 'h1', label: 'web-h1-b' },
        },
        {
          id: 'pod-2',
          type: 'Pod',
          data: { baseName: 'web', podHash: 'h1' },
        },
      ];

      detachSecretComponent({
        nodes,
        componentId: 'pod-group:web-h1',
        targetSecId: 'sec-1',
        secretName: 'db-secret',
        oldSecName: undefined,
        updateNodeData,
        addLog,
      });

      expect(updateNodeData).toHaveBeenCalledWith('pod-0', { secrets: [] });
      expect(updateNodeData).toHaveBeenCalledWith('pod-1', { secrets: [] });
      expect(updateNodeData).toHaveBeenCalledWith('pod-2', { secrets: [] });
      expect(updateNodeData).not.toHaveBeenCalledWith('other-node', expect.anything());
      expect(addLog).toHaveBeenCalledWith(
        'info',
        "[Secret] Removed attached component 'pod-2' from Secret 'db-secret'",
        'UI'
      );
    });

    it('removes secrets matched only by oldSecName', () => {
      const updateNodeData = vi.fn();
      const nodes = [
        {
          id: 'pod-1',
          data: {
            label: 'web-pod',
            secrets: [
              { id: 'sec-old', name: 'legacy' },
              { id: 'sec-keep', name: 'keep' },
            ],
          },
        },
      ];

      detachSecretComponent({
        nodes,
        componentId: 'pod-1',
        targetSecId: 'missing',
        secretName: 'missing-name',
        oldSecName: 'legacy',
        updateNodeData,
      });

      expect(updateNodeData).toHaveBeenCalledWith('pod-1', {
        secrets: [{ id: 'sec-keep', name: 'keep' }],
      });
    });
  });

  describe('attachSecretComponent', () => {
    it('attaches or updates secret on target component nodes and logs', () => {
      const updateNodeData = vi.fn();
      const addLog = vi.fn();
      const nodes = [
        {
          id: 'pod-1',
          type: 'Pod',
          data: {
            label: 'web-pod',
            secrets: [],
          },
        },
      ];

      attachSecretComponent({
        nodes,
        comp: { id: 'pod-1', label: 'web-pod', type: 'Pod' },
        targetId: 'sec-1',
        secretName: 'db-secret',
        secretType: 'Opaque',
        validData: [{ key: 'DB_PASS', value: 'secret' }],
        updateNodeData,
        addLog,
      });

      expect(updateNodeData).toHaveBeenCalledWith('pod-1', {
        secrets: [
          expect.objectContaining({
            id: 'sec-1',
            name: 'db-secret',
            type: 'Opaque',
            resourceName: 'web-pod',
            resourceType: 'Pod',
          }),
        ],
      });
      expect(addLog).toHaveBeenCalledWith(
        'info',
        "[Secret] Attached Secret 'db-secret' to component 'web-pod'",
        'UI'
      );
    });

    it('returns early when target nodes array is empty', () => {
      const updateNodeData = vi.fn();
      attachSecretComponent({
        nodes: [],
        comp: { id: 'non-existent', label: 'none', type: 'Node' },
        targetId: 'sec-1',
        secretName: 'db-secret',
        secretType: 'Opaque',
        validData: [],
        updateNodeData,
      });
      expect(updateNodeData).not.toHaveBeenCalled();
    });

    it('attaches to pod replica groups, skips unrelated nodes, and falls back to node id', () => {
      const updateNodeData = vi.fn();
      const addLog = vi.fn();
      const nodes = [
        { id: 'other-node', data: { label: 'other', secrets: [] } },
        {
          id: 'pod-0',
          type: 'Pod',
          data: { baseName: 'web', podHash: 'h1', label: 'web-h1-a' },
        },
        {
          id: 'pod-1',
          type: 'Pod',
          data: { baseName: 'web', podHash: 'h1' },
        },
      ];

      attachSecretComponent({
        nodes,
        comp: { id: 'pod-group:web-h1', label: '', type: '' },
        targetId: 'sec-new',
        secretName: 'new-secret',
        secretType: 'Opaque',
        validData: [],
        updateNodeData,
        addLog,
      });

      expect(updateNodeData).toHaveBeenCalledTimes(2);
      expect(updateNodeData).toHaveBeenNthCalledWith(1, 'pod-0', {
        secrets: [
          expect.objectContaining({
            resourceName: 'web-h1-a',
            resourceType: 'Pod',
          }),
        ],
      });
      expect(updateNodeData).toHaveBeenNthCalledWith(2, 'pod-1', {
        secrets: [
          expect.objectContaining({
            resourceName: 'web-h1-a',
            resourceType: 'Pod',
          }),
        ],
      });
      expect(updateNodeData).not.toHaveBeenCalledWith('other-node', expect.anything());
    });

    it('falls back to comp type when the node has no type', () => {
      const updateNodeData = vi.fn();
      const nodes = [
        {
          id: 'comp-1',
          data: {
            label: 'custom',
            secrets: [{ id: 'keep-sec', name: 'keep' }],
          },
        },
      ];

      attachSecretComponent({
        nodes,
        comp: { id: 'comp-1', label: 'Custom Label', type: 'Deployment' },
        targetId: 'sec-new',
        secretName: 'new-secret',
        secretType: 'Opaque',
        validData: [],
        updateNodeData,
      });

      const updatedSecrets = updateNodeData.mock.calls[0][1].secrets;
      expect(updatedSecrets).toHaveLength(2);
      expect(updatedSecrets[0]).toEqual({ id: 'keep-sec', name: 'keep' });
      expect(updatedSecrets[1]).toEqual(
        expect.objectContaining({
          resourceName: 'Custom Label',
          resourceType: 'Deployment',
        })
      );
    });

    it('defaults resource type to Node and resource name to node id when both are missing', () => {
      const updateNodeData = vi.fn();
      const nodes = [{ id: 'comp-2', data: {} }];

      attachSecretComponent({
        nodes,
        comp: { id: 'comp-2', label: '', type: '' },
        targetId: 'sec-new',
        secretName: 'new-secret',
        secretType: 'Opaque',
        validData: [],
        updateNodeData,
      });

      expect(updateNodeData).toHaveBeenCalledWith('comp-2', {
        secrets: [
          expect.objectContaining({
            resourceName: 'comp-2',
            resourceType: 'Node',
          }),
        ],
      });
    });

    it('updates an existing secret matched by id while keeping unrelated secrets', () => {
      const updateNodeData = vi.fn();
      const nodes = [
        {
          id: 'deploy-1',
          type: 'Deployment',
          data: {
            label: 'web',
            secrets: [
              { id: 'sec-1', name: 'old-name' },
              { id: 'sec-2', name: 'keep' },
            ],
          },
        },
      ];

      attachSecretComponent({
        nodes,
        comp: { id: 'deploy-1', label: 'web', type: 'Deployment' },
        targetId: 'sec-1',
        secretName: 'new-name',
        secretType: 'Opaque',
        validData: [],
        updateNodeData,
      });

      const updatedSecrets = updateNodeData.mock.calls[0][1].secrets;
      expect(updatedSecrets[0]).toEqual(
        expect.objectContaining({ id: 'sec-1', name: 'new-name' })
      );
      expect(updatedSecrets[1]).toEqual({ id: 'sec-2', name: 'keep' });
    });

    it('updates an existing secret matched by name when targetId is empty', () => {
      const updateNodeData = vi.fn();
      const nodes = [
        {
          id: 'deploy-1',
          data: {
            label: 'web',
            secrets: [{ id: 'sec-1', name: 'old-name' }],
          },
        },
      ];

      attachSecretComponent({
        nodes,
        comp: { id: 'deploy-1', label: 'web', type: 'Deployment' },
        targetId: '',
        secretName: 'old-name',
        secretType: 'Opaque',
        validData: [],
        updateNodeData,
      });

      const updatedSecrets = updateNodeData.mock.calls[0][1].secrets;
      expect(updatedSecrets).toHaveLength(1);
      expect(updatedSecrets[0]).toEqual(expect.objectContaining({ name: 'old-name' }));
    });
  });

  describe('getSecretModalTitle', () => {
    it('returns appropriate title for list, profile, and form modes', () => {
      expect(getSecretModalTitle('list', false)).toBe('Cluster Secrets Overview');
      expect(getSecretModalTitle('profile', false, 'Dev Profile')).toBe('Secret Profile — Dev Profile');
      expect(getSecretModalTitle('profile', false, null)).toBe('Secret Profile — Canvas Profile');
      expect(getSecretModalTitle('form', true)).toBe('Edit Secret');
      expect(getSecretModalTitle('form', false)).toBe('Attach Secret');
    });
  });

  describe('getSecretModalSubtitle', () => {
    it('returns appropriate subtitle for list, profile, and form modes', () => {
      expect(getSecretModalSubtitle('list', 1)).toBe('1 Secret available across cluster');
      expect(getSecretModalSubtitle('list', 5)).toBe('5 Secrets available across cluster');
      expect(getSecretModalSubtitle('profile', 0, undefined, 'Staging')).toBe(
        'Canvas Profile: Staging • Evaluation Precedence Order'
      );
      expect(getSecretModalSubtitle('profile', 0, undefined, null)).toBe(
        'Canvas Profile: Active • Evaluation Precedence Order'
      );
      expect(getSecretModalSubtitle('form', 0, 'My Card')).toBe('Target card: My Card');
      expect(getSecretModalSubtitle('form', 0)).toBe('Configure Sensitive Key-Value Data');
    });
  });
});
