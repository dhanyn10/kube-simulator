import { describe, it, expect } from 'vitest';
import {
  getStepBadgeClass,
  getStepTextClass,
  getPolicyRowClass,
  getLastUsedActivityClass,
  getUserCardBgClass,
  getAdminCardBgClass,
  formatDateWithSeconds,
  getAttachedRolesForUser,
} from '@/activities/modals/kubeIamHelpers';

describe('kubeIamHelpers', () => {
  it('computes step badge class correctly for active, completed, dark, and light states', () => {
    expect(getStepBadgeClass(1, 1, true)).toContain('bg-emerald-600');
    expect(getStepBadgeClass(1, 2, true)).toContain('text-emerald-400');
    expect(getStepBadgeClass(2, 1, true)).toContain('bg-slate-800');
    expect(getStepBadgeClass(2, 1, false)).toContain('bg-slate-100');
  });

  it('computes step text class correctly for active, dark, and light states', () => {
    expect(getStepTextClass(1, 1, true)).toBe('text-emerald-400');
    expect(getStepTextClass(1, 2, true)).toBe('text-slate-300');
    expect(getStepTextClass(1, 2, false)).toBe('text-slate-700');
  });

  it('computes policy row class correctly', () => {
    expect(getPolicyRowClass(true, true)).toContain('bg-emerald-500/10');
    expect(getPolicyRowClass(true, false)).toContain('bg-emerald-50');
    expect(getPolicyRowClass(false, true)).toContain('hover:bg-slate-800/40');
    expect(getPolicyRowClass(false, false)).toContain('hover:bg-slate-50');
  });

  it('computes last used activity class correctly', () => {
    expect(getLastUsedActivityClass(true, true)).toBe('text-emerald-400');
    expect(getLastUsedActivityClass(false, true)).toBe('text-slate-400');
    expect(getLastUsedActivityClass(false, false)).toBe('text-slate-600');
  });

  it('computes user card and admin card background classes', () => {
    expect(getUserCardBgClass(true, true)).toContain('bg-emerald-950/30');
    expect(getUserCardBgClass(true, false)).toContain('bg-emerald-50/80');
    expect(getUserCardBgClass(false, true)).toContain('bg-slate-800/60');
    expect(getUserCardBgClass(false, false)).toContain('bg-slate-50');

    expect(getAdminCardBgClass(true, true)).toContain('bg-emerald-950/30');
    expect(getAdminCardBgClass(true, false)).toContain('bg-emerald-50/80');
    expect(getAdminCardBgClass(false, true)).toContain('bg-slate-800/60');
    expect(getAdminCardBgClass(false, false)).toContain('bg-slate-50');
  });

  it('formats dates with seconds or returns default for missing timestamp', () => {
    expect(formatDateWithSeconds()).toBe('System Default');
    const ts = 1672531200000;
    const formatted = formatDateWithSeconds(ts);
    expect(formatted).not.toBe('System Default');
    expect(formatted).toContain(new Date(ts).toLocaleDateString());
  });

  it('scans nodes for assigned roles for a given user', () => {
    const nodes = [
      {
        id: 'node-1',
        type: 'Pod',
        data: {
          label: 'app-pod',
          roles: [
            { id: 'r-1', name: 'pod-reader', assignedUsers: ['dev-user'], createdAt: 1000 },
            { id: 'r-2', name: 'pod-writer', assignedUsers: ['admin-user'], createdAt: 2000 },
          ],
        },
      },
      {
        id: 'node-2',
        type: 'Deployment',
        data: {
          // No label provided -> falls back to node.id
          roles: [
            { id: 'r-3', name: 'dep-reader', assignedUsers: ['dev-user'] },
          ],
        },
      },
      {
        id: 'node-3',
        type: 'Service',
        data: {},
      },
    ] as any[];

    const devRoles = getAttachedRolesForUser(nodes, 'dev-user');
    expect(devRoles).toHaveLength(2);
    expect(devRoles[0]).toEqual({
      nodeId: 'node-1',
      nodeLabel: 'app-pod',
      nodeType: 'Pod',
      roleId: 'r-1',
      roleName: 'pod-reader',
      createdAt: 1000,
    });
    expect(devRoles[1].nodeLabel).toBe('node-2');

    const adminRoles = getAttachedRolesForUser(nodes, 'admin-user');
    expect(adminRoles).toHaveLength(1);

    const nonExistent = getAttachedRolesForUser(nodes, 'nobody');
    expect(nonExistent).toHaveLength(0);
  });
});
