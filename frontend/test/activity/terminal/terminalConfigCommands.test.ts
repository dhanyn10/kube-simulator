import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkRbacPermission,
  deriveVerbAndResource,
  handleKubectlConfigCommand,
  evaluateRbacForCommand,
} from '../../../src/activity/terminal/terminalConfigCommands';
import { CommandContext } from '../../../src/activity/terminal/terminalCommands';

describe('terminalConfigCommands', () => {
  let mockCtx: CommandContext;
  let activityLogs: string[];
  let storeState: any;

  beforeEach(() => {
    activityLogs = [];
    storeState = {
      activeIdentity: 'system:admin',
      iamUsers: [
        {
          id: 'u-1',
          username: 'budi',
          accessType: 'Managed Access',
          policies: [{ name: 'ContainerDeveloperPolicy', type: 'Default', description: 'Container dev' }],
        },
        {
          id: 'u-2',
          username: 'siti',
          accessType: 'Managed Access',
          policies: [{ name: 'ReadOnlyAccess', type: 'Default', description: 'Read only' }],
        },
      ],
    };

    mockCtx = {
      nodes: [
        {
          id: 'node-1',
          type: 'Pod',
          data: {
            label: 'web-pod',
            roles: [
              {
                id: 'role-1',
                name: 'pod-manager',
                assignedUsers: ['budi'],
                rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['*'] }],
              },
            ],
          },
          position: { x: 0, y: 0 },
        },
      ],
      isSimulating: true,
      addActivityLog: (line: string) => activityLogs.push(line),
      getStoreState: () => storeState,
      setStoreState: (partial: any) => {
        storeState = { ...storeState, ...partial };
      },
      updateNodeData: vi.fn(),
      deleteNodes: vi.fn(),
    };
  });

  describe('deriveVerbAndResource', () => {
    it('derives verb and resource for kubectl get pods', () => {
      const res = deriveVerbAndResource('kubectl get pods');
      expect(res).toEqual({ verb: 'get', resource: 'pods' });
    });

    it('derives verb and resource for kubectl delete pod', () => {
      const res = deriveVerbAndResource('kubectl delete pod web-pod');
      expect(res).toEqual({ verb: 'delete', resource: 'pods' });
    });

    it('derives verb and resource for kubectl scale', () => {
      const res = deriveVerbAndResource('kubectl scale deployment/api --replicas=3');
      expect(res).toEqual({ verb: 'update', resource: 'deployments' });
    });

    it('returns null for non-operational commands', () => {
      expect(deriveVerbAndResource('help')).toBeNull();
      expect(deriveVerbAndResource('kubectl config get-contexts')).toBeNull();
    });
  });

  describe('checkRbacPermission', () => {
    it('allows all commands for system:admin', () => {
      storeState.activeIdentity = 'system:admin';
      const allowed = checkRbacPermission(mockCtx, 'delete', 'pods');
      expect(allowed).toBe(true);
    });

    it('allows get pods for user with ReadOnlyAccess', () => {
      storeState.activeIdentity = 'siti';
      const allowed = checkRbacPermission(mockCtx, 'get', 'pods');
      expect(allowed).toBe(true);
    });

    it('forbids delete pods for user with ReadOnlyAccess', () => {
      storeState.activeIdentity = 'siti';
      const allowed = checkRbacPermission(mockCtx, 'delete', 'pods');
      expect(allowed).toBe(false);
      expect(activityLogs.some((l) => l.includes('Error from server (Forbidden)'))).toBe(true);
    });

    it('allows delete pods for budi via canvas role pod-manager', () => {
      storeState.activeIdentity = 'budi';
      const allowed = checkRbacPermission(mockCtx, 'delete', 'pods');
      expect(allowed).toBe(true);
    });
  });

  describe('handleKubectlConfigCommand', () => {
    it('handles kubectl config current-context', () => {
      storeState.activeIdentity = 'budi';
      const handled = handleKubectlConfigCommand('kubectl config current-context', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs).toContain('budi');
    });

    it('handles kubectl config get-contexts', () => {
      const handled = handleKubectlConfigCommand('kubectl config get-contexts', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some((l) => l.includes('system:admin'))).toBe(true);
      expect(activityLogs.some((l) => l.includes('budi'))).toBe(true);
    });

    it('handles kubectl config use-context <user>', () => {
      const handled = handleKubectlConfigCommand('kubectl config use-context budi', mockCtx);
      expect(handled).toBe(true);
      expect(storeState.activeIdentity).toBe('budi');
      expect(activityLogs.some((l) => l.includes('Switched to context "budi"'))).toBe(true);
    });

    it('handles kubectl config view', () => {
      const handled = handleKubectlConfigCommand('kubectl config view', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some((l) => l.includes('kind: Config'))).toBe(true);
    });
  });

  describe('evaluateRbacForCommand', () => {
    it('logs API Server auth and allows operational command for system:admin', () => {
      storeState.activeIdentity = 'system:admin';
      const allowed = evaluateRbacForCommand('kubectl get pods', mockCtx);
      expect(allowed).toBe(true);
      expect(activityLogs.some((l) => l.includes('[API Server Auth] Certificate / Token Verified for User: "system:admin"'))).toBe(true);
    });
  });
});
