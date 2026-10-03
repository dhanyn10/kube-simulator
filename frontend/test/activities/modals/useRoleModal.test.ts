import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useRoleModal,
  deriveApiGroupsFromResources,
  deriveDeploymentResources,
  deriveNamespaceResources,
  collectNamespaceChildResources,
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

    it('covers rolebindings, clusterroles, clusterrolebindings and unmapped resources for rbac and core api groups', () => {
      expect(deriveApiGroupsFromResources(['rolebindings', 'clusterroles', 'clusterrolebindings', 'unknown_res'])).toEqual(
        expect.arrayContaining(['rbac.authorization.k8s.io', ''])
      );
    });
  });

  describe('deriveDeploymentResources', () => {
    it('returns deployments and pods when child pods or replicas exist', () => {
      const depNode: Node = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 2 } };
      expect(deriveDeploymentResources(depNode, [])).toEqual(['deployments', 'pods']);

      const depNodeZero: Node = { id: 'd2', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 0 } };
      expect(deriveDeploymentResources(depNodeZero, [])).toEqual(['deployments']);

      const depWithPodZeroRep: Node = { id: 'd3', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 0 } };
      const childPod: Node = { id: 'p1', parentId: 'd3', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      expect(deriveDeploymentResources(depWithPodZeroRep, [childPod])).toEqual(['deployments', 'pods']);
    });
  });

  describe('deriveNamespaceResources', () => {
    it('returns namespaces when no children exist or lists child resources', () => {
      const nsNode: Node = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      expect(deriveNamespaceResources(nsNode, [])).toEqual(['namespaces']);

      const depChild: Node = { id: 'dep1', parentId: 'ns1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 1 } };
      const svcChild: Node = { id: 'svc1', parentId: 'ns1', type: 'Service', position: { x: 0, y: 0 }, data: {} };
      const unknownChild: Node = { id: 'u1', parentId: 'ns1', type: 'UnknownType', position: { x: 0, y: 0 }, data: {} };
      expect(deriveNamespaceResources(nsNode, [depChild, svcChild, unknownChild])).toEqual(
        expect.arrayContaining(['deployments', 'pods', 'services'])
      );

      // Namespace with Deployment child that has grandchild pods
      const depChild2: Node = { id: 'dep2', parentId: 'ns1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 0 } };
      const podGrandchild: Node = { id: 'pod1', parentId: 'dep2', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      expect(deriveNamespaceResources(nsNode, [depChild2, podGrandchild])).toEqual(
        expect.arrayContaining(['deployments', 'pods'])
      );

      // Namespace with children of type ConfigMap, Secret, PVC, Ingress, HPA
      const cmChild: Node = { id: 'cm1', parentId: 'ns2', type: 'ConfigMap', position: { x: 0, y: 0 }, data: {} };
      const secChild: Node = { id: 'sec1', parentId: 'ns2', type: 'Secret', position: { x: 0, y: 0 }, data: {} };
      const pvcChild: Node = { id: 'pvc1', parentId: 'ns2', type: 'PVC', position: { x: 0, y: 0 }, data: {} };
      const ingChild: Node = { id: 'ing1', parentId: 'ns2', type: 'Ingress', position: { x: 0, y: 0 }, data: {} };
      const hpaChild: Node = { id: 'hpa1', parentId: 'ns2', type: 'HPA', position: { x: 0, y: 0 }, data: {} };
      const nsNode2: Node = { id: 'ns2', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      expect(deriveNamespaceResources(nsNode2, [cmChild, secChild, pvcChild, ingChild, hpaChild])).toEqual(
        expect.arrayContaining(['configmaps', 'secrets', 'persistentvolumeclaims', 'ingresses', 'horizontalpodautoscalers'])
      );

      // Namespace with unmapped children returning default ['namespaces']
      const unmappedChild: Node = { id: 'un1', parentId: 'ns3', type: 'UnknownType', position: { x: 0, y: 0 }, data: {} };
      const nsNode3: Node = { id: 'ns3', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      expect(deriveNamespaceResources(nsNode3, [unmappedChild])).toEqual(['namespaces']);
    });

  it('covers collectNamespaceChildResources for non-Deployment nodes and missing child types', () => {
    const resSet = new Set<string>();

    // 1. Child with missing type or unknown type
    const noTypeChild: Node = { id: 'c1', type: undefined, position: { x: 0, y: 0 }, data: {} };
    collectNamespaceChildResources(noTypeChild, [], resSet);
    expect(resSet.size).toBe(0);

    // 2. Child with SINGLE_CHILD_TYPE_MAP type (e.g. Service -> services)
    const svcChild: Node = { id: 'c2', type: 'Service', position: { x: 0, y: 0 }, data: {} };
    collectNamespaceChildResources(svcChild, [], resSet);
    expect(resSet.has('services')).toBe(true);

    // 3. Child is Deployment without child pods or replicas
    const depChild: Node = { id: 'c3', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
    collectNamespaceChildResources(depChild, [], resSet);
    expect(resSet.has('deployments')).toBe(true);
    expect(resSet.has('pods')).toBe(false);
  });

  it('covers checkPolicyResourceMatch with ReadOnlyAccess policy', () => {
    const resourcesSet = new Set(['pods']);
    const policyNames = new Set(['ReadOnlyAccess']);
    expect(checkPolicyResourceMatch(resourcesSet, policyNames)).toBe(true);
  });
  });

  describe('deriveResourcesFromTargetNode', () => {
    it('returns default pods/deployments when targetNode is undefined', () => {
      expect(deriveResourcesFromTargetNode(undefined, [])).toEqual(['pods', 'deployments']);
    });

    it('handles Pod with parent Deployment and custom unmapped node types', () => {
      const depNode: Node = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 1 } };
      const podNode: Node = { id: 'pod1', parentId: 'dep1', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      expect(deriveResourcesFromTargetNode(podNode, [depNode, podNode])).toEqual(['deployments', 'pods']);

      const standalonePod: Node = { id: 'pod-standalone', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      expect(deriveResourcesFromTargetNode(standalonePod, [standalonePod])).toEqual(['pods']);

      const nsNode: Node = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      expect(deriveResourcesFromTargetNode(nsNode, [])).toEqual(['namespaces']);

      const customNode: Node = { id: 'c1', type: 'CustomWidget', position: { x: 0, y: 0 }, data: {} };
      expect(deriveResourcesFromTargetNode(customNode, [])).toEqual(['customwidgets']);

      const rsParentPod: Node = { id: 'pod-rs', parentId: 'rs1', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      const rsNode: Node = { id: 'rs1', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: {} };
      expect(deriveResourcesFromTargetNode(rsParentPod, [rsNode, rsParentPod])).toEqual(['pods']);
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

      const adminByPolicy: KubeIAMUser = {
        id: 'u3',
        username: 'admin2',
        accessType: 'Managed Access',
        policies: [{ id: 'p1', name: 'AdministratorAccess', description: '' }],
      };
      expect(isUserFullAccess(adminByPolicy)).toBe(true);
    });

    it('checks policy resource matches', () => {
      expect(checkPolicyResourceMatch(new Set(['pods']), new Set(['ContainerDeveloperPolicy']))).toBe(true);
      expect(checkPolicyResourceMatch(new Set(['services']), new Set(['NetworkingAdminPolicy']))).toBe(true);
      expect(checkPolicyResourceMatch(new Set(['persistentvolumeclaims']), new Set(['StorageAdminPolicy']))).toBe(true);
    expect(checkPolicyResourceMatch(new Set(['pvcs']), new Set(['StorageAdminPolicy']))).toBe(true);
    expect(checkPolicyResourceMatch(new Set(['storage']), new Set(['StorageAdminPolicy']))).toBe(true);
      expect(checkPolicyResourceMatch(new Set(['pods']), new Set(['ReadOnlyAccess']))).toBe(true);
      expect(checkPolicyResourceMatch(new Set(), new Set())).toBe(true);
      expect(checkPolicyResourceMatch(new Set(['pods']), new Set(['NetworkingAdminPolicy']))).toBe(false);
    });

    it('checks availability of IAM users for roles including PowerUserAccess and wildcard resources', () => {
      expect(isUserAvailableForRole(adminUser, undefined, [])).toBe(true);
      expect(isUserAvailableForRole(devUser, undefined, [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }])).toBe(true);

      const powerUser: KubeIAMUser = { id: 'u3', username: 'power', accessType: 'Managed Access', policies: [{ id: 'p2', name: 'PowerUserAccess', description: '' }] };
      expect(isUserAvailableForRole(powerUser, undefined, [])).toBe(true);

      expect(isUserAvailableForRole(devUser, undefined, [{ apiGroups: [''], resources: ['*'], verbs: ['*'] }])).toBe(true);

      const noPolicyUser: KubeIAMUser = { id: 'u4', username: 'none', accessType: 'Managed Access', policies: [] };
      expect(isUserAvailableForRole(noPolicyUser, undefined, [])).toBe(false);

      const svcTargetNode: Node = { id: 's1', type: 'Service', position: { x: 0, y: 0 }, data: {} };
      expect(isUserAvailableForRole(devUser, svcTargetNode, [])).toBe(false);

      const adminPolicyUser: KubeIAMUser = { id: 'u5', username: 'adminPolicy', accessType: 'Managed Access', policies: [{ id: 'p3', name: 'AdministratorAccess', description: '' }] };
      expect(isUserAvailableForRole(adminPolicyUser, undefined, [])).toBe(true);

      // User with undefined policies array
      const undefinedPoliciesUser: KubeIAMUser = { id: 'u6', username: 'undefPol', accessType: 'Managed Access', policies: undefined as any };
      expect(isUserAvailableForRole(undefinedPoliciesUser, undefined, [])).toBe(false);

      // Target node Pod whose parent is NOT a Deployment
      const nsParentPod: Node = { id: 'pod-ns', parentId: 'ns-1', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      const nsParentNode: Node = { id: 'ns-1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
      expect(isUserAvailableForRole(devUser, nsParentPod, [])).toBe(true);
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
      rules: [], // empty rules array
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

    // Initial role with non-empty rules provided
    const initialRoleWithRules: K8sRoleItem = {
      id: 'r2',
      name: 'custom-role',
      rules: [{ apiGroups: ['apps'], resources: ['deployments'], verbs: ['get'] }],
      assignedUsers: ['dev-bob'],
      createdAt: 1000,
    };

    rerender({
      isOpen: true,
      targetNodeId: 'node-1',
      initialRole: initialRoleWithRules,
      onClose,
      onSave,
    });

    expect(result.current.roleName).toBe('custom-role');
    expect(result.current.rules).toEqual([{ apiGroups: ['apps'], resources: ['deployments'], verbs: ['get'] }]);

    // Initial role with empty name and undefined rules/assignedUsers
    const initialRoleNoName: K8sRoleItem = {
      id: 'r3',
      name: '',
      rules: undefined as any,
      assignedUsers: undefined as any,
      createdAt: 1000,
    };

    rerender({
      isOpen: true,
      targetNodeId: 'node-1',
      initialRole: initialRoleNoName,
      onClose,
      onSave,
    });

    expect(result.current.roleName).toBe('app-reader-role');
    expect(result.current.rules).toHaveLength(1);
    expect(result.current.assignedUsers).toContain('admin');
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

    // Update rule tags on non-matching index
    act(() => {
      result.current.handleUpdateRuleTags(99, 'verbs', ['get']);
    });

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

  it('handles user search query filtering by username, accessType, or policy, and handles saving role with empty rules', () => {
    const { result } = renderHook(() =>
      useRoleModal({
        isOpen: true,
        targetNodeId: 'node-1',
        initialRole: null,
        onClose,
        onSave,
      })
    );

    // Search by username
    act(() => {
      result.current.setUserSearchQuery('bob');
    });
    expect(result.current.filteredAvailableUsers).toHaveLength(1);

    // Search by accessType
    act(() => {
      result.current.setUserSearchQuery('Full Access');
    });
    expect(result.current.filteredAvailableUsers).toHaveLength(1);

    // Search by policy name
    act(() => {
      result.current.setUserSearchQuery('ContainerDeveloperPolicy');
    });
    expect(result.current.filteredAvailableUsers).toHaveLength(1);

    // Remove all rules and save role
    act(() => {
      result.current.handleRemoveRule(0);
    });
    expect(result.current.rules).toHaveLength(0);

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        rules: [{ apiGroups: [''], resources: ['*'], verbs: ['*'] }],
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
