import { CommandContext } from './terminalCommands';
import { KubeIAMUser } from '../../types';

/**
 * Checks if the active identity has permission for a specific Kubernetes verb and resource.
 *
 * @param ctx - CommandContext object giving access to store state and logging.
 * @param verb - Action verb ('get', 'list', 'delete', 'update', 'create')
 * @param resource - Resource type ('pods', 'deployments', 'services', 'configmaps', 'secrets', 'roles', 'hpas', etc.)
 * @returns True if allowed, false if forbidden.
 */
export const checkRbacPermission = (
  ctx: CommandContext,
  verb: 'get' | 'list' | 'delete' | 'update' | 'create',
  resource: string
): boolean => {
  const store = ctx.getStoreState();
  const activeUser = store.activeIdentity || 'system:admin';

  // 1. system:admin has cluster-admin (*/*) privileges
  if (activeUser === 'system:admin' || activeUser === 'kubernetes-admin') {
    return true;
  }

  // 2. Check IAM User Policies
  const iamUsers: KubeIAMUser[] = store.iamUsers || [];
  const userObj = iamUsers.find((u) => u.username === activeUser);

  let isAllowedByPolicy = false;

  if (userObj) {
    const policyNames = userObj.policies.map((p) => p.name);

    if (policyNames.includes('AdministratorAccess')) {
      isAllowedByPolicy = true;
    } else if (verb === 'get' || verb === 'list') {
      // Read actions allowed for default policies
      isAllowedByPolicy = policyNames.length > 0;
    } else if (verb === 'delete' || verb === 'update' || verb === 'create') {
      if (policyNames.includes('PowerUserAccess')) {
        isAllowedByPolicy = true;
      } else if (['pods', 'deployments', 'replicasets'].includes(resource.toLowerCase()) && policyNames.includes('ContainerDeveloperPolicy')) {
        isAllowedByPolicy = true;
      } else if (['services', 'ingresses'].includes(resource.toLowerCase()) && policyNames.includes('NetworkingAdminPolicy')) {
        isAllowedByPolicy = true;
      } else if (['pvcs'].includes(resource.toLowerCase()) && policyNames.includes('StorageAdminPolicy')) {
        isAllowedByPolicy = true;
      }
    }
  }

  // 3. Check Canvas Attached Node Roles
  let isAllowedByCanvasRole = false;
  for (const node of ctx.nodes) {
    if (Array.isArray(node.data?.roles)) {
      for (const role of node.data.roles) {
        if (role.assignedUsers?.includes(activeUser)) {
          for (const rule of role.rules || []) {
            const resMatch = (rule.resources || []).includes('*') || (rule.resources || []).includes(resource.toLowerCase());
            const verbMatch = (rule.verbs || []).includes('*') || (rule.verbs || []).includes(verb);
            if (resMatch && verbMatch) {
              isAllowedByCanvasRole = true;
              break;
            }
          }
        }
      }
    }
  }

  if (isAllowedByPolicy || isAllowedByCanvasRole) {
    return true;
  }

  ctx.addActivityLog(`[API Server Auth] Certificate / Token Verified for User: "${activeUser}"`);
  ctx.addActivityLog(`Error from server (Forbidden): ${resource} is forbidden: User "${activeUser}" cannot ${verb} resource "${resource}" in API group ""`);
  return false;
};

/**
 * Extracts action verb and resource category from a kubectl command.
 *
 * @param cmd - Executed command string.
 * @returns Object with verb and resource, or null if command does not require RBAC evaluation.
 */
export const deriveVerbAndResource = (cmd: string): { verb: 'get' | 'list' | 'delete' | 'update' | 'create'; resource: string } | null => {
  const trimmed = cmd.trim();

  // Match 'kubectl get ...'
  const getMatch = /^kubectl\s+get\s+([a-z0-9-]+)\b/i.exec(trimmed);
  if (getMatch) {
    const rawRes = getMatch[1].toLowerCase();
    let res = rawRes;
    if (['pod', 'pods'].includes(rawRes)) res = 'pods';
    if (['deploy', 'deployment', 'deployments'].includes(rawRes)) res = 'deployments';
    if (['svc', 'service', 'services'].includes(rawRes)) res = 'services';
    if (['cm', 'configmap', 'configmaps'].includes(rawRes)) res = 'configmaps';
    if (['secret', 'secrets'].includes(rawRes)) res = 'secrets';
    if (['role', 'roles', 'rolebinding', 'rolebindings'].includes(rawRes)) res = 'roles';
    return { verb: 'get', resource: res };
  }

  // Match 'kubectl delete ...'
  const deleteMatch = /^kubectl\s+delete\s+([a-z0-9-]+)\b/i.exec(trimmed);
  if (deleteMatch) {
    const rawRes = deleteMatch[1].toLowerCase();
    let res = rawRes;
    if (['pod', 'pods'].includes(rawRes)) res = 'pods';
    return { verb: 'delete', resource: res };
  }

  // Match 'kubectl scale ...', 'kubectl set image ...', 'kubectl rollout ...'
  if (/^kubectl\s+(scale|set\s+image|rollout)\b/i.test(trimmed)) {
    return { verb: 'update', resource: 'deployments' };
  }

  // Match 'kubectl describe ...'
  const describeMatch = /^kubectl\s+describe\s+([a-z0-9-]+)\b/i.exec(trimmed);
  if (describeMatch) {
    const rawRes = describeMatch[1].toLowerCase();
    let res = rawRes;
    if (['pod', 'pods'].includes(rawRes)) res = 'pods';
    if (['deploy', 'deployment', 'deployments'].includes(rawRes)) res = 'deployments';
    if (['cm', 'configmap', 'configmaps'].includes(rawRes)) res = 'configmaps';
    if (['secret', 'secrets'].includes(rawRes)) res = 'secrets';
    if (['role', 'roles', 'rolebinding'].includes(rawRes)) res = 'roles';
    return { verb: 'get', resource: res };
  }

  // Match 'kubectl logs ...'
  if (/^kubectl\s+logs\b/i.test(trimmed)) {
    return { verb: 'get', resource: 'pods' };
  }

  return null;
};

/**
 * Performs API Server Auth & Authz evaluation before executing operational kubectl commands.
 *
 * @param cmd - Executed command string.
 * @param ctx - CommandContext object.
 * @returns True if allowed or non-RBAC command, false if forbidden.
 */
export const evaluateRbacForCommand = (cmd: string, ctx: CommandContext): boolean => {
  const derived = deriveVerbAndResource(cmd);
  if (!derived) return true;

  const allowed = checkRbacPermission(ctx, derived.verb, derived.resource);
  if (allowed) {
    const store = ctx.getStoreState();
    const activeUser = store.activeIdentity || 'system:admin';
    ctx.addActivityLog(`[API Server Auth] Certificate / Token Verified for User: "${activeUser}"`);
  }
  return allowed;
};

/**
 * Handles `kubectl config` commands (get-contexts, current-context, view, use-context).
 *
 * @param cmd - Executed command string.
 * @param ctx - CommandContext object.
 * @returns True if handled, false otherwise.
 */
export const handleKubectlConfigCommand = (
  cmd: string,
  ctx: CommandContext
): boolean => {
  const match = /^kubectl\s+config\s+([a-z0-9-]+)(?:\s+([a-zA-Z0-9_:-]+))?/i.exec(cmd.trim());
  if (!match) return false;

  const subCmd = match[1].toLowerCase();
  const arg = match[2];
  const store = ctx.getStoreState();
  const activeUser = store.activeIdentity || 'system:admin';
  const iamUsers: KubeIAMUser[] = store.iamUsers || [];

  const availableUsers = ['system:admin', ...iamUsers.map((u) => u.username)];

  if (subCmd === 'current-context') {
    ctx.addActivityLog(activeUser);
    return true;
  }

  if (subCmd === 'get-contexts') {
    ctx.addActivityLog(`${"CURRENT".padEnd(8)} ${"NAME".padEnd(20)} ${"CLUSTER".padEnd(16)} ${"AUTHINFO".padEnd(20)} NAMESPACE`);
    availableUsers.forEach((u) => {
      const isCurrent = u === activeUser ? '*' : ' ';
      ctx.addActivityLog(`${isCurrent.padEnd(8)} ${u.padEnd(20)} kube-cluster     ${u.padEnd(20)} default`);
    });
    return true;
  }

  if (subCmd === 'use-context') {
    if (!arg) {
      ctx.addActivityLog(`error: context name is required. Usage: kubectl config use-context <user-context>`);
      return true;
    }
    const targetUser = availableUsers.find((u) => u.toLowerCase() === arg.toLowerCase());
    if (targetUser) {
      ctx.setStoreState({ activeIdentity: targetUser });
      if (globalThis.go?.main?.App?.SaveSetting) {
        globalThis.go.main.App.SaveSetting('active_identity', targetUser);
      }
      ctx.addActivityLog(`[API Server Auth] Certificate / Token Verified for User: "${targetUser}"`);
      ctx.addActivityLog(`Switched to context "${targetUser}".`);
    } else {
      ctx.addActivityLog(`error: no context exists with the name: "${arg}".`);
      ctx.addActivityLog(`Available contexts: ${availableUsers.join(', ')}`);
    }
    return true;
  }

  if (subCmd === 'view') {
    ctx.addActivityLog(`apiVersion: v1`);
    ctx.addActivityLog(`kind: Config`);
    ctx.addActivityLog(`current-context: ${activeUser}`);
    ctx.addActivityLog(`clusters:`);
    ctx.addActivityLog(`- cluster:`);
    ctx.addActivityLog(`    certificate-authority-data: [CLUSTER_CA_CERTIFICATE]`);
    ctx.addActivityLog(`    server: https://127.0.0.1:6443`);
    ctx.addActivityLog(`  name: kube-cluster`);
    ctx.addActivityLog(`contexts:`);
    availableUsers.forEach((u) => {
      ctx.addActivityLog(`- context:`);
      ctx.addActivityLog(`    cluster: kube-cluster`);
      ctx.addActivityLog(`    user: ${u}`);
      ctx.addActivityLog(`  name: ${u}`);
    });
    ctx.addActivityLog(`users:`);
    availableUsers.forEach((u) => {
      ctx.addActivityLog(`- name: ${u}`);
      ctx.addActivityLog(`  user:`);
      ctx.addActivityLog(`    client-certificate-data: [X509_CERTIFICATE_OR_BEARER_TOKEN]`);
    });
    return true;
  }

  return false;
};
