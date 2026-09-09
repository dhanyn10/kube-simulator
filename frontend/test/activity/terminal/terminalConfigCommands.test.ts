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
    it.each([
      { cmd: 'kubectl get pods', expected: { verb: 'get', resource: 'pods' } },
      { cmd: 'kubectl delete pod web-pod', expected: { verb: 'delete', resource: 'pods' } },
      { cmd: 'kubectl scale deployment/api --replicas=3', expected: { verb: 'update', resource: 'deployments' } },
    ])('derives verb and resource for "$cmd"', ({ cmd, expected }) => {
      expect(deriveVerbAndResource(cmd)).toEqual(expected);
    });

    it('returns null for non-operational commands', () => {
      expect(deriveVerbAndResource('help')).toBeNull();
      expect(deriveVerbAndResource('kubectl config get-contexts')).toBeNull();
    });
  });

  describe('checkRbacPermission', () => {
    it.each([
      { identity: 'system:admin', verb: 'delete', resource: 'pods', expectedAllowed: true, checkLog: false },
      { identity: 'siti', verb: 'get', resource: 'pods', expectedAllowed: true, checkLog: false },
      { identity: 'siti', verb: 'delete', resource: 'pods', expectedAllowed: false, checkLog: true },
      { identity: 'budi', verb: 'delete', resource: 'pods', expectedAllowed: true, checkLog: false },
    ])('evaluates RBAC permission for "$identity" attempting "$verb $resource"', ({ identity, verb, resource, expectedAllowed, checkLog }) => {
      storeState.activeIdentity = identity;
      const allowed = checkRbacPermission(mockCtx, verb, resource);
      expect(allowed).toBe(expectedAllowed);
      if (checkLog) {
        expect(activityLogs.some((l) => l.includes('Error from server (Forbidden)'))).toBe(true);
      }
    });
  });

  describe('handleKubectlConfigCommand', () => {
    it.each([
      {
        cmd: 'kubectl config current-context',
        setup: () => {
          storeState.activeIdentity = 'budi';
        },
        verify: () => {
          expect(activityLogs).toContain('budi');
        },
      },
      {
        cmd: 'kubectl config get-contexts',
        setup: () => {},
        verify: () => {
          expect(activityLogs.some((l) => l.includes('system:admin'))).toBe(true);
          expect(activityLogs.some((l) => l.includes('budi'))).toBe(true);
        },
      },
      {
        cmd: 'kubectl config use-context budi',
        setup: () => {},
        verify: () => {
          expect(storeState.activeIdentity).toBe('budi');
          expect(activityLogs.some((l) => l.includes('Switched to context "budi"'))).toBe(true);
        },
      },
      {
        cmd: 'kubectl config view',
        setup: () => {},
        verify: () => {
          expect(activityLogs.some((l) => l.includes('kind: Config'))).toBe(true);
        },
      },
    ])('handles subcommand "$cmd"', ({ cmd, setup, verify }) => {
      setup();
      const handled = handleKubectlConfigCommand(cmd, mockCtx);
      expect(handled).toBe(true);
      verify();
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
