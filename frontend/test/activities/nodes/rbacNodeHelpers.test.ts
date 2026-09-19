import { describe, it, expect } from 'vitest';
import {
  isNodeAccessForbidden,
  isResourceAllowedByIamPolicies,
  isResourceAllowedByCanvasRoles,
  mapNodeTypeToResource,
} from '@/activities/nodes/rbacNodeHelpers';
import { KubeIAMUser } from '@/types';

describe('rbacNodeHelpers', () => {
  const adminUser: KubeIAMUser = {
    id: '1',
    username: 'admin-user',
    policies: [{ name: 'AdministratorAccess', description: 'Admin' }],
    roles: [],
  };

  const readOnlyUser: KubeIAMUser = {
    id: '2',
    username: 'readonly-user',
    policies: [{ name: 'ReadOnlyAccess', description: 'Read Only' }],
    roles: [],
  };

  const powerUser: KubeIAMUser = {
    id: '3',
    username: 'power-user',
    policies: [{ name: 'PowerUserAccess', description: 'Power User' }],
    roles: [],
  };

  const devUser: KubeIAMUser = {
    id: '4',
    username: 'dev-user',
    policies: [{ name: 'ContainerDeveloperPolicy', description: 'Dev' }],
    roles: [],
  };

  const netUser: KubeIAMUser = {
    id: '5',
    username: 'net-user',
    policies: [{ name: 'NetworkingAdminPolicy', description: 'Networking' }],
    roles: [],
  };

  const storageUser: KubeIAMUser = {
    id: '6',
    username: 'storage-user',
    policies: [{ name: 'StorageAdminPolicy', description: 'Storage' }],
    roles: [],
  };

  it('maps node types to standard Kubernetes resource names correctly', () => {
    expect(mapNodeTypeToResource('Pod')).toBe('pods');
    expect(mapNodeTypeToResource('Deployment')).toBe('deployments');
    expect(mapNodeTypeToResource('ReplicaSet')).toBe('replicasets');
    expect(mapNodeTypeToResource('Service')).toBe('services');
    expect(mapNodeTypeToResource('Ingress')).toBe('ingresses');
    expect(mapNodeTypeToResource('PVC')).toBe('pvcs');
    expect(mapNodeTypeToResource('ConfigMap')).toBe('configmaps');
    expect(mapNodeTypeToResource('Secret')).toBe('secrets');
    expect(mapNodeTypeToResource('Role')).toBe('roles');
    expect(mapNodeTypeToResource('')).toBe('');
    expect(mapNodeTypeToResource(undefined)).toBe('');
  });

  it('allows system:admin and kubernetes-admin unconditionally', () => {
    expect(isNodeAccessForbidden('system:admin', [devUser], 'Service')).toBe(false);
    expect(isNodeAccessForbidden('kubernetes-admin', [devUser], 'Service')).toBe(false);
  });

  it('evaluates Full Access / ReadOnly / PowerUser policies', () => {
    expect(isResourceAllowedByIamPolicies(adminUser, 'services')).toBe(true);
    expect(isResourceAllowedByIamPolicies(readOnlyUser, 'services')).toBe(true);
    expect(isResourceAllowedByIamPolicies(powerUser, 'services')).toBe(true);

    expect(isNodeAccessForbidden('admin-user', [adminUser], 'Service')).toBe(false);
    expect(isNodeAccessForbidden('readonly-user', [readOnlyUser], 'Service')).toBe(false);
    expect(isNodeAccessForbidden('power-user', [powerUser], 'Service')).toBe(false);
  });

  it('evaluates ContainerDeveloperPolicy for workloads and configs', () => {
    expect(isResourceAllowedByIamPolicies(devUser, 'pods')).toBe(true);
    expect(isResourceAllowedByIamPolicies(devUser, 'deployments')).toBe(true);
    expect(isResourceAllowedByIamPolicies(devUser, 'replicasets')).toBe(true);
    expect(isResourceAllowedByIamPolicies(devUser, 'configmaps')).toBe(true);
    expect(isResourceAllowedByIamPolicies(devUser, 'secrets')).toBe(true);

    expect(isResourceAllowedByIamPolicies(devUser, 'services')).toBe(false);
    expect(isResourceAllowedByIamPolicies(devUser, 'pvcs')).toBe(false);

    expect(isNodeAccessForbidden('dev-user', [devUser], 'Pod')).toBe(false);
    expect(isNodeAccessForbidden('dev-user', [devUser], 'Deployment')).toBe(false);
    expect(isNodeAccessForbidden('dev-user', [devUser], 'Service')).toBe(true);
  });

  it('evaluates NetworkingAdminPolicy for networking components', () => {
    expect(isResourceAllowedByIamPolicies(netUser, 'services')).toBe(true);
    expect(isResourceAllowedByIamPolicies(netUser, 'ingresses')).toBe(true);
    expect(isResourceAllowedByIamPolicies(netUser, 'pods')).toBe(false);

    expect(isNodeAccessForbidden('net-user', [netUser], 'Service')).toBe(false);
    expect(isNodeAccessForbidden('net-user', [netUser], 'Ingress')).toBe(false);
    expect(isNodeAccessForbidden('net-user', [netUser], 'Pod')).toBe(true);
  });

  it('evaluates StorageAdminPolicy for storage components', () => {
    expect(isResourceAllowedByIamPolicies(storageUser, 'pvcs')).toBe(true);
    expect(isResourceAllowedByIamPolicies(storageUser, 'pods')).toBe(false);

    expect(isNodeAccessForbidden('storage-user', [storageUser], 'PVC')).toBe(false);
    expect(isNodeAccessForbidden('storage-user', [storageUser], 'Pod')).toBe(true);
  });

  it('grants permission if node has direct attached Role matching activeUser', () => {
    const nodeData = {
      roles: [
        {
          name: 'svc-role',
          assignedUsers: ['dev-user'],
          rules: [{ apiGroups: [''], resources: ['services'], verbs: ['get'] }],
        },
      ],
    };

    expect(isResourceAllowedByCanvasRoles(nodeData, 'dev-user', 'services')).toBe(true);
    expect(isNodeAccessForbidden('dev-user', [devUser], 'Service', nodeData)).toBe(false);
  });

  it('grants permission if canvas standalone Role card matches activeUser and resource', () => {
    const standaloneRoleNode = {
      id: 'role-1',
      type: 'Role',
      data: {
        assignedUsers: ['dev-user'],
        rules: [{ apiGroups: [''], resources: ['services'], verbs: ['get'] }],
      },
    };

    const allNodes = [standaloneRoleNode];

    expect(isResourceAllowedByCanvasRoles({}, 'dev-user', 'services', allNodes)).toBe(true);
    expect(isNodeAccessForbidden('dev-user', [devUser], 'Service', {}, allNodes)).toBe(false);
  });

  it('denies access if user is not found in iamUsers list and has no role bindings', () => {
    expect(isNodeAccessForbidden('unknown-user', [devUser], 'Pod')).toBe(true);
  });
});
