import { CommandContext } from './terminalCommands';
import { KubeIAMUser } from '../../types';

/**
 * Evaluates whether an IAM user's policies allow a specific verb and resource.
 */
const checkIamPolicy = (
  user: KubeIAMUser,
  verb: string,
  resource: string
): boolean => {
  const policies = user.policies.map((p) => p.name);
  if (policies.includes('AdministratorAccess')) {
    return true;
  }
  if (verb === 'get' || verb === 'list') {
    return policies.length > 0;
  }
  if (policies.includes('PowerUserAccess')) {
    return true;
  }

  const res = resource.toLowerCase();
  const isDevAllowed = ['pods', 'deployments', 'replicasets'].includes(res) && policies.includes('ContainerDeveloperPolicy');
  const isNetAllowed = ['services', 'ingresses'].includes(res) && policies.includes('NetworkingAdminPolicy');
  const isStorageAllowed = ['pvcs'].includes(res) && policies.includes('StorageAdminPolicy');

  return isDevAllowed || isNetAllowed || isStorageAllowed;
};

/**
 * Evaluates whether canvas attached node roles allow a user verb and resource.
 */
const checkCanvasRoles = (
  nodes: readonly any[],
  activeUser: string,
  verb: string,
  resource: string
): boolean => {
  const targetRes = resource.toLowerCase();
  for (const node of nodes) {
    const roles = node.data?.roles;
    if (!Array.isArray(roles)) continue;

    for (const role of roles) {
      if (!role.assignedUsers?.includes(activeUser)) continue;
      for (const rule of role.rules || []) {
        const resMatch = (rule.resources || []).includes('*') || (rule.resources || []).includes(targetRes);
        const verbMatch = (rule.verbs || []).includes('*') || (rule.verbs || []).includes(verb);
        if (resMatch && verbMatch) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * Checks if the active identity has permission for a specific Kubernetes verb and resource.
 */
export const checkRbacPermission = (
  ctx: CommandContext,
  verb: 'get' | 'list' | 'delete' | 'update' | 'create',
  resource: string
): boolean => {
  const store = ctx.getStoreState();
  const activeUser = store.activeIdentity || 'system:admin';

  if (activeUser === 'system:admin' || activeUser === 'kubernetes-admin') {
    return true;
  }

  const iamUsers: KubeIAMUser[] = store.iamUsers || [];
  const userObj = iamUsers.find((u) => u.username === activeUser);

  const isAllowedByPolicy = userObj ? checkIamPolicy(userObj, verb, resource) : false;
  const isAllowedByCanvasRole = checkCanvasRoles(ctx.nodes, activeUser, verb, resource);

  if (isAllowedByPolicy || isAllowedByCanvasRole) {
    return true;
  }

  ctx.addActivityLog(`[API Server Auth] Certificate / Token Verified for User: "${activeUser}"`);
  ctx.addActivityLog(`Error from server (Forbidden): ${resource} is forbidden: User "${activeUser}" cannot ${verb} resource "${resource}" in API group ""`);
  return false;
};

const RESOURCE_ALIASES: Record<string, string> = {
  pod: 'pods',
  pods: 'pods',
  deploy: 'deployments',
  deployment: 'deployments',
  deployments: 'deployments',
  svc: 'services',
  service: 'services',
  services: 'services',
  cm: 'configmaps',
  configmap: 'configmaps',
  configmaps: 'configmaps',
  secret: 'secrets',
  secrets: 'secrets',
  role: 'roles',
  roles: 'roles',
  rb: 'roles',
  rolebinding: 'roles',
  rolebindings: 'roles',
};

/**
 * Normalizes raw CLI resource string input into a standard resource category name.
 */
const normalizeResourceName = (raw: string): string => {
  const key = raw.toLowerCase();
  return RESOURCE_ALIASES[key] || key;
};

/**
 * Extracts action verb and resource category from a kubectl command.
 */
export const deriveVerbAndResource = (cmd: string): { verb: 'get' | 'list' | 'delete' | 'update' | 'create'; resource: string } | null => {
  const trimmed = cmd.trim();

  const getMatch = /^kubectl\s+get\s+([a-z0-9-]+)\b/i.exec(trimmed);
  if (getMatch) {
    return { verb: 'get', resource: normalizeResourceName(getMatch[1]) };
  }

  const deleteMatch = /^kubectl\s+delete\s+([a-z0-9-]+)\b/i.exec(trimmed);
  if (deleteMatch) {
    return { verb: 'delete', resource: normalizeResourceName(deleteMatch[1]) };
  }

  if (/^kubectl\s+(scale|set\s+image|rollout)\b/i.test(trimmed)) {
    return { verb: 'update', resource: 'deployments' };
  }

  const describeMatch = /^kubectl\s+describe\s+([a-z0-9-]+)\b/i.exec(trimmed);
  if (describeMatch) {
    return { verb: 'get', resource: normalizeResourceName(describeMatch[1]) };
  }

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
