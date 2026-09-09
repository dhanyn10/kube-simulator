import { useState, useEffect, useRef } from 'react';
import { Node } from '@xyflow/react';
import { K8sRoleItem, K8sRoleRule, K8sResourceType, KubeIAMUser } from '../../types';
import { useFlowStore } from '../../store';
import { sanitizeSlug } from '../../lib/utils';

export const COMMON_SUGGESTIONS: Record<string, string[]> = {
  resources: ['pods', 'deployments', 'services', 'configmaps', 'secrets', 'persistentvolumeclaims', '*'],
  verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete', '*'],
  apiGroups: ['', 'apps', 'batch', 'storage.k8s.io', '*'],
};

export const DEFAULT_VERBS = ['get', 'list', 'watch'];

export const SINGLE_CHILD_TYPE_MAP: Record<string, string> = {
  Pod: 'pods',
  Service: 'services',
  ConfigMap: 'configmaps',
  Secret: 'secrets',
  PVC: 'persistentvolumeclaims',
  Ingress: 'ingresses',
  HPA: 'horizontalpodautoscalers',
};

/**
 * Derives API groups based on a list of Kubernetes resource names.
 */
export const deriveApiGroupsFromResources = (resources: string[]): string[] => {
  const groups = new Set<string>();
  for (const res of resources) {
    const r = res.toLowerCase();
    if (['deployments', 'statefulsets', 'daemonsets', 'replicasets'].includes(r)) {
      groups.add('apps');
    } else if (['jobs', 'cronjobs'].includes(r)) {
      groups.add('batch');
    } else if (['ingresses', 'ingressclasses', 'networkpolicies'].includes(r)) {
      groups.add('networking.k8s.io');
    } else if (['horizontalpodautoscalers', 'hpa'].includes(r)) {
      groups.add('autoscaling');
    } else if (['storageclasses', 'volumeattachments'].includes(r)) {
      groups.add('storage.k8s.io');
    } else if (['roles', 'rolebindings', 'clusterroles', 'clusterrolebindings'].includes(r)) {
      groups.add('rbac.authorization.k8s.io');
    } else {
      groups.add('');
    }
  }
  return Array.from(groups);
};

export const deriveDeploymentResources = (targetNode: Node, allNodes: Node[]): string[] => {
  const childPods = allNodes.filter((n) => n.parentId === targetNode.id && n.type === 'Pod');
  const replicas = (targetNode.data?.replicas as number) ?? 0;
  if (childPods.length > 0 || replicas > 0) {
    return ['deployments', 'pods'];
  }
  return ['deployments'];
};

export const collectNamespaceChildResources = (child: Node, allNodes: Node[], resSet: Set<string>): void => {
  if (child.type === 'Deployment') {
    resSet.add('deployments');
    const grandChildren = allNodes.filter((n) => n.parentId === child.id && n.type === 'Pod');
    const replicas = (child.data?.replicas as number) ?? 0;
    if (grandChildren.length > 0 || replicas > 0) {
      resSet.add('pods');
    }
    return;
  }

  const resource = SINGLE_CHILD_TYPE_MAP[child.type || ''];
  if (resource) {
    resSet.add(resource);
  }
};

export const deriveNamespaceResources = (targetNode: Node, allNodes: Node[]): string[] => {
  const children = allNodes.filter((n) => n.parentId === targetNode.id);
  if (children.length === 0) {
    return ['namespaces'];
  }
  const resSet = new Set<string>();
  for (const child of children) {
    collectNamespaceChildResources(child, allNodes, resSet);
  }
  return resSet.size > 0 ? Array.from(resSet) : ['namespaces'];
};

export const deriveResourcesFromTargetNode = (targetNode: Node | undefined, allNodes: Node[]): string[] => {
  if (!targetNode) return ['pods', 'deployments'];

  let effectiveTarget = targetNode;
  if (targetNode.type === 'Pod' && targetNode.parentId) {
    const parentDep = allNodes.find((n) => n.id === targetNode.parentId && n.type === 'Deployment');
    if (parentDep) {
      effectiveTarget = parentDep;
    }
  }

  const type = effectiveTarget.type as string;

  if (type === 'Deployment') {
    return deriveDeploymentResources(effectiveTarget, allNodes);
  }

  if (type === 'Namespace') {
    return deriveNamespaceResources(effectiveTarget, allNodes);
  }

  const mappedResource = SINGLE_CHILD_TYPE_MAP[type];
  if (mappedResource) {
    return [mappedResource];
  }

  return [type.toLowerCase() + 's'];
};

/**
 * Checks whether an IAM user has Full Access permissions.
 */
export const isUserFullAccess = (user: KubeIAMUser): boolean => {
  return user.accessType === 'Full Access' || Boolean(user.policies?.some((p) => p.name === 'AdministratorAccess'));
};

/**
 * Checks if policy set matches targeted resource categories.
 */
export const checkPolicyResourceMatch = (resourcesSet: Set<string>, policyNames: Set<string>): boolean => {
  const isDevResource = Array.from(resourcesSet).some((r) =>
    ['pods', 'deployments', 'replicasets', 'configmaps', 'secrets', 'horizontalpodautoscalers', 'hpa'].includes(r)
  );
  const isNetResource = Array.from(resourcesSet).some((r) =>
    ['services', 'ingresses', 'networking'].includes(r)
  );
  const isStorageResource = Array.from(resourcesSet).some((r) =>
    ['persistentvolumeclaims', 'pvcs', 'storage'].includes(r)
  );

  if (isDevResource && policyNames.has('ContainerDeveloperPolicy')) return true;
  if (isNetResource && policyNames.has('NetworkingAdminPolicy')) return true;
  if (isStorageResource && policyNames.has('StorageAdminPolicy')) return true;
  if (policyNames.has('ReadOnlyAccess')) return true;

  return resourcesSet.size === 0;
};

/**
 * Determines if a Kube IAM user is eligible/available for assignment on a given target card / role.
 */
export const isUserAvailableForRole = (
  user: KubeIAMUser,
  targetNode: Node | undefined,
  rules: K8sRoleRule[]
): boolean => {
  if (isUserFullAccess(user)) return true;
  if (!user.policies || user.policies.length === 0) return false;

  const policyNames = new Set(user.policies.map((p) => p.name));
  if (policyNames.has('PowerUserAccess') || policyNames.has('AdministratorAccess')) {
    return true;
  }

  const resourcesSet = new Set<string>();
  if (targetNode) {
    const derived = deriveResourcesFromTargetNode(targetNode, []);
    derived.forEach((r) => resourcesSet.add(r.toLowerCase()));
  }
  for (const rule of rules) {
    (rule.resources || []).forEach((r) => resourcesSet.add(r.toLowerCase()));
  }

  if (resourcesSet.has('*')) return true;

  return checkPolicyResourceMatch(resourcesSet, policyNames);
};

export interface UseRoleModalParams {
  readonly isOpen: boolean;
  readonly targetNodeId: string | null;
  readonly initialRole?: K8sRoleItem | null;
  readonly onClose: () => void;
  readonly onSave: (roleItem: K8sRoleItem) => void;
}

export function useRoleModal({
  isOpen,
  targetNodeId,
  initialRole,
  onClose,
  onSave,
}: UseRoleModalParams) {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const iamUsers = useFlowStore((state) => state.iamUsers);
  const setKubeIamModalOpen = useFlowStore((state) => state.setKubeIamModalOpen);

  const [roleName, setRoleName] = useState<string>('app-reader-role');
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState<boolean>(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [rules, setRules] = useState<K8sRoleRule[]>([
    {
      apiGroups: ['apps', ''],
      resources: ['deployments', 'pods'],
      verbs: [...DEFAULT_VERBS],
    },
  ]);

  const targetNode = nodes.find((n) => n.id === targetNodeId);

  useEffect(() => {
    const fullAccessUsernames = iamUsers
      .filter(isUserFullAccess)
      .map((u) => u.username);

    if (initialRole) {
      setRoleName(initialRole.name || 'app-reader-role');
      const initialUsers = initialRole.assignedUsers || [];
      const combined = Array.from(new Set([...initialUsers, ...fullAccessUsernames]));
      setAssignedUsers(combined);
      setRules(initialRole.rules && initialRole.rules.length > 0 ? initialRole.rules : [
        { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] }
      ]);
    } else {
      setAssignedUsers(fullAccessUsernames);
      const derivedResources = deriveResourcesFromTargetNode(targetNode, nodes);
      const derivedApiGroups = deriveApiGroupsFromResources(derivedResources);

      const randomSuffix = crypto.randomUUID().split('-')[0];
      setRoleName(`role-${randomSuffix}`);
      setRules([
        {
          apiGroups: derivedApiGroups,
          resources: derivedResources,
          verbs: ['get', 'list', 'watch'],
        },
      ]);
    }
    setUserSearchQuery('');
    setIsUserDropdownOpen(false);
  }, [initialRole, isOpen, targetNodeId, nodes, iamUsers]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserDropdownOpen]);

  const availableUsers = iamUsers.filter((user) => isUserAvailableForRole(user, targetNode, rules));

  const filteredAvailableUsers = availableUsers.filter((user) => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase().trim();
    const matchUsername = user.username.toLowerCase().includes(q);
    const matchType = user.accessType.toLowerCase().includes(q);
    const matchPolicy = user.policies.some((p) => p.name.toLowerCase().includes(q));
    return matchUsername || matchType || matchPolicy;
  });

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRuleTags = (
    ruleIndex: number,
    field: 'apiGroups' | 'resources' | 'verbs',
    newTags: string[]
  ) => {
    setRules((prev) =>
      prev.map((rule, idx) => {
        if (idx !== ruleIndex) return rule;
        const updated = { ...rule, [field]: newTags };
        if (field === 'resources') {
          updated.apiGroups = deriveApiGroupsFromResources(newTags);
        }
        return updated;
      })
    );
  };

  const toggleUserAssignment = (username: string) => {
    const targetUser = iamUsers.find((u) => u.username === username);
    if (targetUser && isUserFullAccess(targetUser)) {
      return;
    }
    setAssignedUsers((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const handleOpenIamModal = () => {
    onClose();
    setKubeIamModalOpen(true);
  };

  const handleSave = () => {
    const roleItem: K8sRoleItem = {
      id: initialRole?.id || `role-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      name: sanitizeSlug(roleName) || 'unnamed-role',
      rules: rules.length > 0 ? rules : [{ apiGroups: [''], resources: ['*'], verbs: ['*'] }],
      assignedUsers,
      createdAt: initialRole?.createdAt || Date.now(),
    };
    onSave(roleItem);
    onClose();
  };

  return {
    colorMode,
    roleName,
    setRoleName,
    assignedUsers,
    userSearchQuery,
    setUserSearchQuery,
    isUserDropdownOpen,
    setIsUserDropdownOpen,
    userDropdownRef,
    rules,
    iamUsers,
    filteredAvailableUsers,
    handleAddRule,
    handleRemoveRule,
    handleUpdateRuleTags,
    toggleUserAssignment,
    handleOpenIamModal,
    handleSave,
  };
}
