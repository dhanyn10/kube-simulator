import { describe, it, expect } from 'vitest';
import { Node } from '@xyflow/react';
import {
  extractAllOverviewItems,
  filterOverviewItems,
  getResourceOverviewMeta,
} from '@/activities/modals/attachedResourceOverviewHelpers';

describe('attachedResourceOverviewHelpers', () => {
  const mockNodes: Node[] = [
    {
      id: 'node-pod',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: {
        label: 'web-pod',
        type: 'Pod',
        configMaps: [{ id: 'cm-1', name: 'web-config', configData: [{ key: 'PORT', value: '8080' }, { key: 'ENV', value: 'production' }] }],
        secrets: [{ id: 'sec-1', name: 'web-secret', type: 'Opaque', secretData: [{ key: 'DB_PASS', value: 'secret123' }] }],
        roles: [{ id: 'role-1', name: 'pod-reader', rules: [{ resources: ['pods'], verbs: ['get', 'list'] }], assignedUsers: ['alice'] }],
      },
    },
    {
      id: 'node-dep',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: {
        label: 'api-deployment',
        type: 'Deployment',
        hpas: [{ id: 'hpa-1', name: 'api-hpa', minReplicas: 2, maxReplicas: 10, targetCPU: 75 }],
        resourceLimits: [{ id: 'res-1', name: 'api-limits', cpuRequest: '250m', cpuLimit: '500m', memoryRequest: '128Mi', memoryLimit: '256Mi' }],
      },
    },
    { id: 'node-empty', position: { x: 0, y: 0 }, data: {} },
  ];

  it('extractAllOverviewItems extracts attached items with owner details and handles invalid types', () => {
    // 1. ConfigMaps
    const cms = extractAllOverviewItems(mockNodes, 'ConfigMap');
    expect(cms).toHaveLength(1);
    expect(cms[0].name).toBe('web-config');
    expect(cms[0].ownerNode.label).toBe('web-pod');
    expect(cms[0].ownerNode.type).toBe('Pod');

    // 2. Secrets
    const secrets = extractAllOverviewItems(mockNodes, 'Secret');
    expect(secrets).toHaveLength(1);
    expect(secrets[0].name).toBe('web-secret');

    // 3. Roles
    const roles = extractAllOverviewItems(mockNodes, 'Role');
    expect(roles).toHaveLength(1);
    expect(roles[0].name).toBe('pod-reader');

    // 4. HPAs
    const hpas = extractAllOverviewItems(mockNodes, 'HPA');
    expect(hpas).toHaveLength(1);
    expect(hpas[0].name).toBe('api-hpa');

    // 5. ResourceLimits
    const limits = extractAllOverviewItems(mockNodes, 'ResourceLimit');
    expect(limits).toHaveLength(1);
    expect(limits[0].name).toBe('api-limits');

    // 6. Unknown / non-attached type returns empty array
    const unknown = extractAllOverviewItems(mockNodes, 'Pod' as any);
    expect(unknown).toHaveLength(0);

    // 7. Node with item lacking id and name
    const fallbackNodes: Node[] = [
      {
        id: 'fallback-node',
        position: { x: 0, y: 0 },
        data: {
          configMaps: [{}],
        },
      },
    ];
    const fallbackCms = extractAllOverviewItems(fallbackNodes, 'ConfigMap');
    expect(fallbackCms).toHaveLength(1);
    expect(fallbackCms[0].name).toBe('Unnamed');
    expect(fallbackCms[0].id).toBe('fallback-node-configMaps-0');
    expect(fallbackCms[0].ownerNode.label).toBe('fallback-node');
    expect(fallbackCms[0].ownerNode.type).toBe('Node');
  });

  it('filterOverviewItems searches across name, owner label, owner type, and resource details', () => {
    const cms = extractAllOverviewItems(mockNodes, 'ConfigMap');
    const secrets = extractAllOverviewItems(mockNodes, 'Secret');
    const roles = extractAllOverviewItems(mockNodes, 'Role');

    // Empty search returns all items
    expect(filterOverviewItems(cms, '', 'ConfigMap')).toEqual(cms);
    expect(filterOverviewItems(cms, '   ', 'ConfigMap')).toEqual(cms);

    // Search by item name
    expect(filterOverviewItems(cms, 'web-config', 'ConfigMap')).toHaveLength(1);
    expect(filterOverviewItems(cms, 'non-existent', 'ConfigMap')).toHaveLength(0);

    // Search by owner label
    expect(filterOverviewItems(cms, 'web-pod', 'ConfigMap')).toHaveLength(1);

    // Search by owner type
    expect(filterOverviewItems(cms, 'Pod', 'ConfigMap')).toHaveLength(1);

    // Search by ConfigMap key/value
    expect(filterOverviewItems(cms, 'PORT', 'ConfigMap')).toHaveLength(1);
    expect(filterOverviewItems(cms, '8080', 'ConfigMap')).toHaveLength(1);
    expect(filterOverviewItems(cms, 'ENV', 'ConfigMap')).toHaveLength(1);

    // Search by Secret key
    expect(filterOverviewItems(secrets, 'DB_PASS', 'Secret')).toHaveLength(1);
    expect(filterOverviewItems(secrets, 'MISSING_KEY', 'Secret')).toHaveLength(0);

    // Search by Role assigned user
    expect(filterOverviewItems(roles, 'alice', 'Role')).toHaveLength(1);
    expect(filterOverviewItems(roles, 'bob', 'Role')).toHaveLength(0);
  });

  it('getResourceOverviewMeta returns correct metadata, titles, and icons for each resource type', () => {
    const cmMeta = getResourceOverviewMeta('ConfigMap', 1);
    expect(cmMeta.title).toBe('Cluster ConfigMaps Overview');
    expect(cmMeta.subtitle).toBe('1 ConfigMap configured across cluster nodes');
    expect(cmMeta.resourceKey).toBe('configMaps');

    const cmPlural = getResourceOverviewMeta('ConfigMap', 3);
    expect(cmPlural.subtitle).toBe('3 ConfigMaps configured across cluster nodes');

    const secMeta = getResourceOverviewMeta('Secret', 2);
    expect(secMeta.title).toBe('Cluster Secrets Overview');
    expect(secMeta.resourceKey).toBe('secrets');

    const roleMeta = getResourceOverviewMeta('Role', 1);
    expect(roleMeta.title).toBe('Cluster RBAC Roles & RoleBindings Overview');
    expect(roleMeta.resourceKey).toBe('roles');

    const hpaMeta = getResourceOverviewMeta('HPA', 2);
    expect(hpaMeta.title).toBe('Cluster Horizontal Pod Autoscalers Overview');
    expect(hpaMeta.resourceKey).toBe('hpas');

    const limitMeta = getResourceOverviewMeta('ResourceLimit', 1);
    expect(limitMeta.title).toBe('Cluster Resource Limits Overview');
    expect(limitMeta.resourceKey).toBe('resourceLimits');
  });

  it('extractAllOverviewItems includes unattached saved ConfigMaps from local storage', () => {
    const savedCMs = [
      { id: 'cm-standalone', name: 'global-config', configData: [{ key: 'LOG_LEVEL', value: 'debug' }] },
      { id: 'cm-1', name: 'web-config', configData: [{ key: 'PORT', value: '8080' }] },
    ];

    const cms = extractAllOverviewItems(mockNodes, 'ConfigMap', savedCMs, 'Production Cluster');
    expect(cms).toHaveLength(2);

    const standalone = cms.find((c) => c.id === 'cm-standalone');
    expect(standalone).toBeDefined();
    expect(standalone?.ownerNode.id).toBe('cluster-storage');
    expect(standalone?.ownerNode.label).toBe('Cluster (Local Storage)');
    expect(standalone?.profileName).toBe('Production Cluster');

    const attachedSaved = extractAllOverviewItems([], 'ConfigMap', [
      { id: 'cm-att', name: 'api-config', configData: [], resourceName: 'api-pod', resourceType: 'Pod', profileName: 'Staging Canvas' },
    ]);
    expect(attachedSaved[0].ownerNode.label).toBe('api-pod');
    expect(attachedSaved[0].ownerNode.type).toBe('Pod');
    expect(attachedSaved[0].profileName).toBe('Staging Canvas');
  });

  it('deduplicates duplicate ConfigMap entries on the same component and child replica pods', () => {
    const duplicateNodes: Node[] = [
      { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web-workload', configMaps: [{ id: 'cm-web', name: 'web-config', configData: [{ key: 'PORT', value: '80' }] }, { id: 'cm-web', name: 'web-config', configData: [{ key: 'PORT', value: '80' }] }] } },
      { id: 'pod-replica-1', type: 'Pod', parentId: 'dep-1', position: { x: 0, y: 0 }, data: { label: 'web-workload', configMaps: [{ id: 'cm-web', name: 'web-config', configData: [{ key: 'PORT', value: '80' }] }] } },
    ];

    const result = extractAllOverviewItems(duplicateNodes, 'ConfigMap');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cm-web');
    expect(result[0].ownerNode.label).toBe('web-workload');
  });

  it('covers all branch edge cases for extractAllOverviewItems and checkItemMatchesQuery', () => {
    // 1. Default Profile fallback for currentProfileName, item.profileName, and savedCm.profileName
    const origHas = Set.prototype.has;
    const hasSpy = vi.spyOn(Set.prototype, 'has').mockImplementation(function (this: Set<any>, value: any) {
      if (typeof value === 'string' && value.includes('::') && value.includes('force-dup-composite')) {
        return true;
      }
      return origHas.call(this, value);
    });

    const nodesWithDefaultProfile: Node[] = [
      {
        id: 'node-default-prof',
        position: { x: 0, y: 0 },
        data: {
          configMaps: [
            { id: 'cm-prof', name: 'prof-config', profileName: 'Default Profile' },
            { id: 'cm-custom-prof', name: 'custom-prof-config', profileName: 'Custom-Canvas-Profile' },
          ],
        },
      },
    ];

    const savedWithDupAndDefault: any[] = [
      { id: 'cm-saved-dup', name: '', profileName: 'Default Profile', resourceName: 'api-worker' }, // name is empty string, resourceType undefined
      { id: 'force-dup-composite', name: 'force-name' }, // exercises line 109-110 (seenCompositeKeys.has duplicate return)
      { id: 'cm-by-name-conflict', name: 'prof-config' }, // name already found in canvas -> hits line 101 !foundIds.has
    ];

    const resultProfile = extractAllOverviewItems(nodesWithDefaultProfile, 'ConfigMap', savedWithDupAndDefault, 'Default Profile');
    hasSpy.mockRestore();
    expect(resultProfile).toHaveLength(3);
    expect(resultProfile[0].profileName).toBeDefined();
    expect(resultProfile[1].profileName).toBe('Custom-Canvas-Profile');
    // saved resource without resourceType falls back to 'Resource'
    expect(resultProfile[2].ownerNode.type).toBe('Resource');
    expect(resultProfile[2].name).toBe('Unnamed');

    // 2. Parent node missing in nodes array and parentList having matching name with different id
    const orphanParentNode: Node[] = [
      { id: 'child-no-parent', parentId: 'non-existent-parent', position: { x: 0, y: 0 }, data: { configMaps: [{ id: 'cm-child' }] } },
      { id: 'parent-no-list', position: { x: 0, y: 0 }, data: {} },
      { id: 'child-empty-parent-list', parentId: 'parent-no-list', position: { x: 0, y: 0 }, data: { configMaps: [{ id: 'cm-c2' }] } },
      { id: 'parent-with-name', position: { x: 0, y: 0 }, data: { configMaps: [{ id: 'p-1', name: 'shared-name' }] } },
      { id: 'child-matching-name', parentId: 'parent-with-name', position: { x: 0, y: 0 }, data: { configMaps: [{ id: 'c-diff-id', name: 'shared-name' }] } },
    ];
    const orphanResults = extractAllOverviewItems(orphanParentNode, 'ConfigMap');
    expect(orphanResults.some(r => r.id === 'cm-child')).toBe(true);
    expect(orphanResults.some(r => r.id === 'cm-c2')).toBe(true);
    // child-matching-name is skipped because parent already has an item with that name
    expect(orphanResults.some(r => r.id === 'c-diff-id')).toBe(false);

    // 3. checkItemMatchesQuery returns false and matches profileName
    // Dynamic getter to cover lines 103 and 121 fallbacks for savedCm.resourceName
    let readCount = 0;
    const dynamicSavedCm = {
      id: 'dynamic-cm',
      name: 'dyn-name',
      get resourceName() {
        readCount += 1;
        return readCount === 1 ? 'initial-target' : '';
      },
    };
    const dynamicResults = extractAllOverviewItems([], 'ConfigMap', [dynamicSavedCm as any]);
    expect(dynamicResults[0].ownerNode.label).toBe('saved-resource');
    expect(dynamicResults[0].ownerNode.id).toBe('saved-resource');

    const itemsToFilter = [
      {
        id: 'unique-id-123',
        name: 'my-hpa',
        rawItem: {},
        ownerNode: { id: 'dep-1', label: 'api-workload', type: 'Deployment' },
        profileName: 'Production-East',
      },
      {
        id: 'res-sec-no-data',
        name: 'secret-empty',
        rawItem: { secretData: null },
        ownerNode: { id: 'pod-1', label: 'pod-a', type: 'Pod' },
      },
      {
        id: 'res-cm-no-data',
        name: 'cm-empty',
        rawItem: { configData: null },
        ownerNode: { id: 'pod-2', label: 'pod-b', type: 'Pod' },
      },
      {
        id: 'res-role-no-data',
        name: 'role-empty',
        rawItem: { assignedUsers: null },
        ownerNode: { id: 'pod-3', label: 'pod-c', type: 'Pod' },
      },
    ];

    // Matches id (line 135)
    expect(filterOverviewItems(itemsToFilter, 'unique-id-123', 'HPA')).toHaveLength(1);
    // Matches ownerNode.type without matching label (line 138)
    expect(filterOverviewItems(itemsToFilter, 'deployment', 'HPA')).toHaveLength(1);
    // Matches profileName (line 139)
    expect(filterOverviewItems(itemsToFilter, 'production-east', 'HPA')).toHaveLength(1);
    // Hits return false for items without matching data (line 153)
    expect(filterOverviewItems(itemsToFilter, 'non-existent-xyz', 'HPA')).toHaveLength(0);
    expect(filterOverviewItems(itemsToFilter, 'non-existent-xyz', 'Secret')).toHaveLength(0);
    expect(filterOverviewItems(itemsToFilter, 'non-existent-xyz', 'ConfigMap')).toHaveLength(0);
    expect(filterOverviewItems(itemsToFilter, 'non-existent-xyz', 'Role')).toHaveLength(0);
    expect(filterOverviewItems(itemsToFilter, 'non-existent-xyz', 'ResourceLimit')).toHaveLength(0);

    // 4. Singular subtitle checks for getResourceOverviewMeta
    expect(getResourceOverviewMeta('Secret', 1).subtitle).toBe('1 Secret configured across cluster nodes');
    expect(getResourceOverviewMeta('Role', 1).subtitle).toBe('1 Role configured across cluster nodes');
    expect(getResourceOverviewMeta('HPA', 1).subtitle).toBe('1 HPA configured across cluster nodes');
    expect(getResourceOverviewMeta('ResourceLimit', 1).subtitle).toBe('1 Resource Limit configured across cluster nodes');
    expect(getResourceOverviewMeta('ResourceLimit', 0).subtitle).toBe('0 Resource Limits configured across cluster nodes');
  });
});
