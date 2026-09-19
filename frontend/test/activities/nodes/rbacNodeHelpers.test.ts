import { describe, it, expect } from 'vitest';
import {
  isNodeAccessForbidden,
  isResourceAllowedByIamPolicies,
  isResourceAllowedByCanvasRoles,
  mapNodeTypeToResource,
} from '@/activities/nodes/rbacNodeHelpers';
import { KubeIAMUser } from '@/types';

describe('rbacNodeHelpers', () => {
  const devUser: KubeIAMUser = {
    id: '1',
    username: 'dev-user',
    policies: [{ name: 'ContainerDeveloperPolicy', description: 'Dev Policy' }],
    roles: [],
  };

  const adminUser: KubeIAMUser = {
    id: '2',
    username: 'admin-user',
    policies: [{ name: 'AdministratorAccess', description: 'Admin Policy' }],
    roles: [],
  };

  it('maps node type to k8s resource name correctly', () => {
    expect(mapNodeTypeToResource('Pod')).toBe('pods');
    expect(mapNodeTypeToResource('Deployment')).toBe('deployments');
    expect(mapNodeTypeToResource('Service')).toBe('services');
    expect(mapNodeTypeToResource('PVC')).toBe('pvcs');
  });

  it('allows access for system:admin without restriction', () => {
    expect(isNodeAccessForbidden('system:admin', [devUser], 'Service')).toBe(false);
  });

  it('allows access for administrator access IAM user', () => {
    expect(isResourceAllowedByIamPolicies(adminUser, 'services')).toBe(true);
    expect(isNodeAccessForbidden('admin-user', [adminUser], 'Service')).toBe(false);
  });

  it('restricts dev user from accessing non-workload cards', () => {
    expect(isResourceAllowedByIamPolicies(devUser, 'services')).toBe(false);
    expect(isNodeAccessForbidden('dev-user', [devUser], 'Service')).toBe(true);
  });

  it('allows dev user to access workload cards (Pod, Deployment)', () => {
    expect(isResourceAllowedByIamPolicies(devUser, 'pods')).toBe(true);
    expect(isNodeAccessForbidden('dev-user', [devUser], 'Pod')).toBe(false);
  });

  it('allows access if canvas role is explicitly assigned to user', () => {
    const nodeData = {
      roles: [
        {
          name: 'service-reader',
          assignedUsers: ['dev-user'],
        },
      ],
    };

    expect(isResourceAllowedByCanvasRoles(nodeData, 'dev-user', 'services')).toBe(true);
    expect(isNodeAccessForbidden('dev-user', [devUser], 'Service', nodeData)).toBe(false);
  });
});
