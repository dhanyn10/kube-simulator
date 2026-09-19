import { KubeIAMUser } from '@/types';

/**
 * Normalizes node resource category name based on node type.
 */
export const mapNodeTypeToResource = (nodeType?: string): string => {
  if (!nodeType) return '';
  const type = nodeType.toLowerCase();
  switch (type) {
    case 'pod':
      return 'pods';
    case 'deployment':
      return 'deployments';
    case 'replicaset':
      return 'replicasets';
    case 'service':
      return 'services';
    case 'ingress':
      return 'ingresses';
    case 'pvc':
      return 'pvcs';
    case 'configmap':
      return 'configmaps';
    case 'secret':
      return 'secrets';
    case 'role':
      return 'roles';
    default:
      return type;
  }
};

/**
 * Checks if an IAM user's policy allows access to a specific resource type.
 */
export const isResourceAllowedByIamPolicies = (
  user: KubeIAMUser,
  resource: string
): boolean => {
  const policies = user.policies?.map((p) => p.name) || [];
  if (policies.includes('AdministratorAccess')) {
    return true;
  }
  if (policies.includes('PowerUserAccess')) {
    return true;
  }

  const res = (resource || '').toLowerCase();
  if (policies.includes('ContainerDeveloperPolicy') && ['pods', 'deployments', 'replicasets'].includes(res)) {
    return true;
  }
  if (policies.includes('NetworkingAdminPolicy') && ['services', 'ingresses'].includes(res)) {
    return true;
  }
  if (policies.includes('StorageAdminPolicy') && ['pvcs'].includes(res)) {
    return true;
  }
  if (policies.includes('ReadOnlyAccess')) {
    return true;
  }

  return false;
};

/**
 * Checks if a node or canvas has roles attached/configured that grant permissions to activeUser for target resource.
 */
export const isResourceAllowedByCanvasRoles = (
  nodeData: any,
  activeUser: string,
  resource?: string,
  allNodes?: readonly any[]
): boolean => {
  const targetRes = (resource || '').toLowerCase();

  // 1. Check roles attached directly to the node
  const roles = nodeData?.roles;
  if (Array.isArray(roles) && roles.length > 0) {
    const isAllowed = roles.some((role: any) => {
      if (!Array.isArray(role.assignedUsers) || !role.assignedUsers.includes(activeUser)) return false;
      const rules = role.rules || [];
      if (rules.length === 0) return true;
      return rules.some((rule: any) => {
        const resources = rule.resources || [];
        return !targetRes || resources.includes('*') || resources.includes(targetRes);
      });
    });
    if (isAllowed) return true;
  }

  // 2. Check standalone Role nodes on the canvas
  if (Array.isArray(allNodes)) {
    const roleNodes = allNodes.filter((n) => n.type === 'Role');
    for (const roleNode of roleNodes) {
      const roleData = roleNode.data;
      if (!roleData) continue;
      const assignedUsers = roleData.assignedUsers;
      if (Array.isArray(assignedUsers) && assignedUsers.includes(activeUser)) {
        const rules = roleData.rules || [];
        if (rules.length === 0) return true;
        const matchesRule = rules.some((rule: any) => {
          const resources = rule.resources || [];
          return !targetRes || resources.includes('*') || resources.includes(targetRes);
        });
        if (matchesRule) return true;
      }
    }
  }

  return false;
};

/**
 * Evaluates whether a canvas node is forbidden for the currently active identity context.
 *
 * @param activeIdentity - Active user identity (e.g. 'system:admin' or IAM username)
 * @param iamUsers - List of IAM users from store
 * @param nodeType - Type of the canvas node (e.g. 'Pod', 'Service', 'Deployment')
 * @param nodeData - Node data object containing attached roles, label, etc.
 * @param allNodes - Optional array of all canvas nodes to evaluate standalone Role cards
 * @returns True if the node is forbidden (access restricted), false otherwise.
 */
export const isNodeAccessForbidden = (
  activeIdentity: string,
  iamUsers: readonly KubeIAMUser[],
  nodeType?: string,
  nodeData?: any,
  allNodes?: readonly any[]
): boolean => {
  if (!activeIdentity || activeIdentity === 'system:admin' || activeIdentity === 'kubernetes-admin') {
    return false;
  }

  const resource = mapNodeTypeToResource(nodeType);
  const userObj = iamUsers.find((u) => u.username === activeIdentity);

  // 1. Check IAM policy permissions
  const allowedByIam = userObj ? isResourceAllowedByIamPolicies(userObj, resource) : false;
  if (allowedByIam) {
    return false;
  }

  // 2. Check RoleBindings / Role rules attached or on canvas
  const allowedByRoleBinding = isResourceAllowedByCanvasRoles(nodeData, activeIdentity, resource, allNodes);
  if (allowedByRoleBinding) {
    return false;
  }

  return true;
};
