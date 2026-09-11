import { Node } from '@xyflow/react';

export interface AttachedRoleInfo {
  readonly nodeId: string;
  readonly nodeLabel: string;
  readonly nodeType?: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly createdAt?: number;
}

/**
 * Computes step badge styling class based on active step state.
 */
export function getStepBadgeClass(step: number, currentStep: number, isDark: boolean): string {
  if (currentStep === step) {
    return 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20';
  }
  if (currentStep > step) {
    return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
  }
  if (isDark) {
    return 'bg-slate-800 text-slate-500';
  }
  return 'bg-slate-100 text-slate-400';
}

/**
 * Computes step text styling class based on active step state.
 */
export function getStepTextClass(step: number, currentStep: number, isDark: boolean): string {
  if (currentStep === step) {
    return 'text-emerald-400';
  }
  if (isDark) {
    return 'text-slate-300';
  }
  return 'text-slate-700';
}

/**
 * Computes policy table row styling class based on selection state.
 */
export function getPolicyRowClass(isSelected: boolean, isDark: boolean): string {
  if (isSelected) {
    if (isDark) {
      return 'bg-emerald-500/10 text-slate-200';
    }
    return 'bg-emerald-50 text-slate-900';
  }
  if (isDark) {
    return 'hover:bg-slate-800/40 text-slate-300';
  }
  return 'hover:bg-slate-50 text-slate-700';
}

/**
 * Computes last used activity badge text class.
 */
export function getLastUsedActivityClass(isActive: boolean, isDark: boolean): string {
  if (isActive) {
    return 'text-emerald-400';
  }
  if (isDark) {
    return 'text-slate-400';
  }
  return 'text-slate-600';
}

/**
 * Computes user card background class based on active state and color mode.
 */
export function getUserCardBgClass(isActive: boolean, isDark: boolean): string {
  if (isActive) {
    if (isDark) {
      return 'bg-emerald-950/30 border-emerald-500/50 hover:bg-emerald-900/40';
    }
    return 'bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100/60';
  }
  if (isDark) {
    return 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800';
  }
  return 'bg-slate-50 border-slate-200 hover:bg-slate-100/80';
}

/**
 * Computes system admin card background class based on active state and color mode.
 */
export function getAdminCardBgClass(isActive: boolean, isDark: boolean): string {
  if (isActive) {
    if (isDark) {
      return 'bg-emerald-950/30 border-emerald-500/50';
    }
    return 'bg-emerald-50/80 border-emerald-300';
  }
  if (isDark) {
    return 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800';
  }
  return 'bg-slate-50 border-slate-200 hover:bg-slate-100/80';
}

/**
 * Formats a numeric timestamp into a local date and time string with seconds.
 */
export function formatDateWithSeconds(ts?: number): string {
  if (!ts) return 'System Default';
  const date = new Date(ts);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

/**
 * Scans canvas nodes for roles assigned to a specific IAM username.
 */
export function getAttachedRolesForUser(nodes: readonly Node[], username: string): AttachedRoleInfo[] {
  const rolesList: AttachedRoleInfo[] = [];
  for (const node of nodes) {
    if (!Array.isArray(node.data?.roles)) continue;
    for (const role of (node.data.roles as any[])) {
      if (role.assignedUsers?.includes(username)) {
        rolesList.push({
          nodeId: node.id,
          nodeLabel: (node.data.label as string) || node.id,
          nodeType: node.type,
          roleId: role.id,
          roleName: role.name,
          createdAt: role.createdAt,
        });
      }
    }
  }
  return rolesList;
}
