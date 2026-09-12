import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useRoleModal,
  deriveApiGroupsFromResources,
  deriveDeploymentResources,
  deriveNamespaceResources,
  deriveResourcesFromTargetNode,
  isUserFullAccess,
  checkPolicyResourceMatch,
  isUserAvailableForRole,
} from '@/activities/modals/useRoleModal';
import { useFlowStore } from '@/store';
import { Node } from '@xyflow/react';
import { KubeIAMUser, K8sRoleItem } from '@/types';

describe('useRoleModal helpers', () => {
  describe('deriveApiGroupsFromResources', () => {
    it('maps resource names to expected API groups', () => {
      expect(deriveApiGroupsFromResources(['deployments', 'jobs', 'ingresses', 'hpa', 'storageclasses', 'roles', 'pods'])).toEqual(
        expect.arrayContaining(['apps', 'batch', 'networking.k8s.io', 'autoscaling', 'storage.k8s.io', 'rbac.authorization.k8s.io', ''])
      );
    });
  });

  describe('deriveDeploymentResources', () => {
    it('returns deployments and pods when child pods or replicas exist', () => {
      const depNode: Node = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 2 } };
      expect(deriveDeploymentResources(depNode, [])).toEqual(['deployments', 'pods']);

      const depNodeZero: Node = { id: 'd2', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 0 } };
      expect(deriveDeploymentResources(depNodeZero, [])).toEqual(['deployments']);
    });
  });

  describe('deriveNamespaceResources', () => {
    it('returns namespaces when no children exist or lists child resources', () => {
      const nsNode: Node = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      expect(deriveNamespaceResources(nsNode, [])).toEqual(['namespaces']);

      const depChild: Node = { id: 'dep1', parentId: 'ns1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 1 } };
      const svcChild: Node = { id: 'svc1', parentId: 'ns1', type: 'Service', position: { x: 0, y: 0 }, data: {} };
      expect(deriveNamespaceResources(nsNode, [depChild, svcChild])).toEqual(
        expect.arrayContaining(['deployments', 'pods', 'services'])
      );
    });
  });

  describe('deriveResourcesFromTargetNode', () => {
    it('returns default pods/deployments when targetNode is undefined', () => {
      expect(deriveResourcesFromTargetNode(undefined, [])).toEqual(['pods', 'deployments']);
    });

    it('handles Pod with parent Deployment', () => {
      const depNode: Node = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 1 } };
      const podNode: Node = { id: 'pod1', parentId: 'dep1', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      expect(deriveResourcesFromTargetNode(podNode, [depNode, podNode])).toEqual(['deployments', 'pods']);
    });
  });

  describe('isUserFullAccess and isUserAvailableForRole', () => {
    const adminUser: KubeIAMUser = {
      id: 'u1',
      username: 'admin',
      accessType: 'Full Access',
      policies: [],
    };
    const devUser: KubeIAMUser = {
      id: 'u2',
      username: 'dev',
      accessType: 'Managed Access',
      policies: [{ id: 'p1', name: 'ContainerDeveloperPolicy', description: '' }],
    };

    it('identifies Full Access users correctly', () => {
      expect(isUserFullAccess(adminUser)).toBe(true);
      expect(isUserFullAccess(devUser)).toBe(false);
    });

    it('checks policy resource matches', () => {
      expect(checkPolicyResourceMatch(new Set(['pods']), new Set(['ContainerDeveloperPolicy']))).toBe(true);
      expect(checkPolicyResourceMatch(new Set(['services']), new Set(['NetworkingAdminPolicy']))).toBe(true);
      expect(checkPolicyResourceMatch(new Set(['persistentvolumeclaims']), new Set(['StorageAdminPolicy']))).toBe(true);
      expect(checkPolicyResourceMatch(new Set(['pods']), new Set(['ReadOnlyAccess']))).toBe(true);
      expect(checkPolicyResourceMatch(new Set(), new Set())).toBe(true);
    });

    it('checks availability of IAM users for roles', () => {
      expect(isUserAvailableForRole(adminUser, undefined, [])).toBe(true);
      expect(isUserAvailableForRole(devUser, undefined, [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }])).toBe(true);

      const noPolicyUser: KubeIAMUser = { id: 'u3', username: 'none', accessType: 'Managed Access', policies: [] };
      expect(isUserAvailableForRole(noPolicyUser, undefined, [])).toBe(false);
    });
  });
});

describe('useRoleModal hook', () => {
  const onClose = vi.fn();
  const onSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'node-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'Web Deployment', replicas: 1 } },
      ],
      iamUsers: [
        { id: 'u1', username: 'admin', accessType: 'Full Access', policies: [] },
        { id: 'u2', username: 'dev-bob', accessType: 'Managed Access', policies: [{ id: 'p1', name: 'ContainerDeveloperPolicy', description: '' }] },
      ],
      setKubeIamModalOpen: vi.fn(),
    });
  });

  it('initializes state for new role vs existing initialRole', () => {
    // New role
    const { result, rerender } = renderHook((props) => useRoleModal(props), {
      initialProps: {
        isOpen: true,
        targetNodeId: 'node-1',
        initialRole: null,
        onClose,
        onSave,
      },
    });

    expect(result.current.roleName).toContain('role-');
    expect(result.current.assignedUsers).toContain('admin');

    // Initial role provided
    const initialRole: K8sRoleItem = {
      id: 'r1',
      name: 'existing-role',
      rules: [{ apiGroups: ['apps'], resources: ['deployments'], verbs: ['get'] }],
      assignedUsers: ['dev-bob'],
      createdAt: 1000,
    };

    rerender({
      isOpen: true,
      targetNodeId: 'node-1',
      initialRole,
      onClose,
      onSave,
    });

    expect(result.current.roleName).toBe('existing-role');
    expect(result.current.assignedUsers).toContain('dev-bob');
  });

  it('supports adding, removing, updating rules, and user assignments', () => {
    const { result } = renderHook(() =>
      useRoleModal({
        isOpen: true,
        targetNodeId: 'node-1',
        initialRole: null,
        onClose,
        onSave,
      })
    );

    act(() => {
      result.current.handleAddRule();
    });
    expect(result.current.rules).toHaveLength(2);

    act(() => {
      result.current.handleUpdateRuleTags(0, 'resources', ['services']);
    });
    expect(result.current.rules[0].resources).toEqual(['services']);

    act(() => {
      result.current.handleRemoveRule(1);
    });
    expect(result.current.rules).toHaveLength(1);

    act(() => {
      result.current.toggleUserAssignment('dev-bob');
    });
    expect(result.current.assignedUsers).toContain('dev-bob');

    // Toggling full access user does not remove them
    act(() => {
      result.current.toggleUserAssignment('admin');
    });
    expect(result.current.assignedUsers).toContain('admin');
  });

  it('handles user search query filtering and saving role', () => {
    const { result } = renderHook(() =>
      useRoleModal({
        isOpen: true,
        targetNodeId: 'node-1',
        initialRole: null,
        onClose,
        onSave,
      })
    );

    act(() => {
      result.current.setUserSearchQuery('bob');
    });
    expect(result.current.filteredAvailableUsers).toHaveLength(1);

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedUsers: expect.arrayContaining(['admin']),
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('handles handleOpenIamModal and user dropdown outside click listener', () => {
    const { result } = renderHook(() =>
      useRoleModal({
        isOpen: true,
        targetNodeId: 'node-1',
        initialRole: null,
        onClose,
        onSave,
      })
    );

    const dropdownEl = document.createElement('div');
    document.body.appendChild(dropdownEl);
    (result.current.userDropdownRef as any).current = dropdownEl;

    act(() => {
      result.current.setIsUserDropdownOpen(true);
    });

    // Outside click event
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(result.current.isUserDropdownOpen).toBe(false);

    act(() => {
      result.current.handleOpenIamModal();
    });
    expect(onClose).toHaveBeenCalled();
    expect(useFlowStore.getState().setKubeIamModalOpen).toHaveBeenCalledWith(true);

    document.body.removeChild(dropdownEl);
  });
});
