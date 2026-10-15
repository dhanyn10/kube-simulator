import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkRbacPermission,
  deriveVerbAndResource,
  handleKubectlConfigCommand,
  evaluateRbacForCommand,
} from '@/activities/terminal/terminalConfigCommands';
import { CommandContext } from '@/activities/terminal/terminalCommands';

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
        {
          id: 'u-3',
          username: 'admin_user',
          accessType: 'Managed Access',
          policies: [{ name: 'AdministratorAccess', type: 'Default', description: 'Admin' }],
        },
        {
          id: 'u-4',
          username: 'power_user',
          accessType: 'Managed Access',
          policies: [{ name: 'PowerUserAccess', type: 'Default', description: 'Power user' }],
        },
        {
          id: 'u-5',
          username: 'net_user',
          accessType: 'Managed Access',
          policies: [{ name: 'NetworkingAdminPolicy', type: 'Default', description: 'Networking' }],
        },
        {
          id: 'u-6',
          username: 'storage_user',
          accessType: 'Managed Access',
          policies: [{ name: 'StorageAdminPolicy', type: 'Default', description: 'Storage' }],
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
      { cmd: 'kubectl describe service my-svc', expected: { verb: 'get', resource: 'services' } },
      { cmd: 'kubectl logs my-pod', expected: { verb: 'get', resource: 'pods' } },
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
      { identity: 'admin_user', verb: 'delete', resource: 'secrets', expectedAllowed: true, checkLog: false },
      { identity: 'power_user', verb: 'update', resource: 'deployments', expectedAllowed: true, checkLog: false },
      { identity: 'net_user', verb: 'update', resource: 'services', expectedAllowed: true, checkLog: false },
      { identity: 'storage_user', verb: 'delete', resource: 'pvcs', expectedAllowed: true, checkLog: false },
      { identity: 'siti', verb: 'get', resource: 'pods', expectedAllowed: true, checkLog: false },
      { identity: 'siti', verb: 'delete', resource: 'pods', expectedAllowed: false, checkLog: true },
      { identity: 'budi', verb: 'delete', resource: 'pods', expectedAllowed: true, checkLog: false },
      { identity: 'unknown_user', verb: 'get', resource: 'pods', expectedAllowed: false, checkLog: true },
    ])('evaluates RBAC permission for "$identity" attempting "$verb $resource"', ({ identity, verb, resource, expectedAllowed, checkLog }) => {
      storeState.activeIdentity = identity;
      const allowed = checkRbacPermission(mockCtx, verb as any, resource);
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
        cmd: 'kubectl config use-context',
        setup: () => {},
        verify: () => {
          expect(activityLogs.some((l) => l.includes('error: context name is required'))).toBe(true);
        },
      },
      {
        cmd: 'kubectl config use-context unknown_user',
        setup: () => {},
        verify: () => {
          expect(activityLogs.some((l) => l.includes('error: no context exists with the name'))).toBe(true);
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

    it('returns false for unsupported config subcommands or non-config commands', () => {
      expect(handleKubectlConfigCommand('kubectl config set-cluster', mockCtx)).toBe(false);
      expect(handleKubectlConfigCommand('kubectl get pods', mockCtx)).toBe(false);
    });
  });

  describe('evaluateRbacForCommand', () => {
    it('logs API Server auth and allows operational command for system:admin', () => {
      storeState.activeIdentity = 'system:admin';
      const allowed = evaluateRbacForCommand('kubectl get pods', mockCtx);
      expect(allowed).toBe(true);
      expect(activityLogs.some((l) => l.includes('[API Server Auth] Certificate / Token Verified for User: "system:admin"'))).toBe(true);
    });

    it('returns true for non-operational commands', () => {
      expect(evaluateRbacForCommand('kubectl config view', mockCtx)).toBe(true);
    });

    it('handles storeState object parameter or function parameter in evaluateRbacForCommand', () => {
      const mockCtxWithState = {
        ...mockCtx,
        getStoreState: () => ({
          activeIdentity: 'budi',
          iamUsers: storeState.iamUsers,
          nodes: mockCtx.nodes,
        }),
      };

      const result = evaluateRbacForCommand('kubectl get pods', mockCtxWithState as any);
      expect(result).toBe(true);
    });

    it('covers checkIamPolicy policy fallback, undefined rule/roles arrays, activeIdentity fallback, and SaveSetting backend IPC in use-context', () => {
      // 1. User without policies trying delete verb -> false
      storeState.activeIdentity = 'no_policy_user';
      storeState.iamUsers.push({ id: 'u-7', username: 'no_policy_user', accessType: 'Managed Access', policies: [] });
      expect(checkRbacPermission(mockCtx, 'delete', 'pods')).toBe(false);

      // 2. Nodes with non-array roles or undefined rules/assignedUsers for non-admin user
      const malformedNodesCtx: any = {
        ...mockCtx,
        nodes: [
          { id: 'n1', type: 'Pod', data: { roles: 'not-an-array' } },
          { id: 'n2', type: 'Pod', data: { roles: [{ name: 'r1' }] } }, // assignedUsers undefined
          { id: 'n3', type: 'Pod', data: { roles: [{ name: 'r2', assignedUsers: ['budi'] }] } }, // rules undefined
        ],
        getStoreState: () => ({ activeIdentity: 'no_policy_user', iamUsers: storeState.iamUsers }),
      };
      expect(checkRbacPermission(malformedNodesCtx, 'get', 'pods')).toBe(false);

      // 3. handleKubectlConfigCommand use-context with SaveSetting backend available
      (globalThis as any).go = {
        main: {
          App: {
            SaveSetting: vi.fn().mockResolvedValue(true),
          },
        },
      };

      const handled = handleKubectlConfigCommand('kubectl config use-context budi', mockCtx);
      expect(handled).toBe(true);
      expect((globalThis as any).go.main.App.SaveSetting).toHaveBeenCalledWith('active_identity', 'budi');

      delete (globalThis as any).go;
    });

    it('covers deriveVerbAndResource for ingresses, roles, rolebindings, configmaps, secrets, pvcs, hpas, and apply/set/rollout commands', () => {
      expect(deriveVerbAndResource('kubectl get ingresses')).toEqual({ verb: 'get', resource: 'ingresses' });
      expect(deriveVerbAndResource('kubectl get roles')).toEqual({ verb: 'get', resource: 'roles' });
      expect(deriveVerbAndResource('kubectl get rolebindings')).toEqual({ verb: 'get', resource: 'roles' });
      expect(deriveVerbAndResource('kubectl get configmaps')).toEqual({ verb: 'get', resource: 'configmaps' });
      expect(deriveVerbAndResource('kubectl get secrets')).toEqual({ verb: 'get', resource: 'secrets' });
      expect(deriveVerbAndResource('kubectl get pvcs')).toEqual({ verb: 'get', resource: 'pvcs' });
      expect(deriveVerbAndResource('kubectl get hpas')).toEqual({ verb: 'get', resource: 'hpas' });
      expect(deriveVerbAndResource('kubectl get unknownres')).toEqual({ verb: 'get', resource: 'unknownres' });
      expect(deriveVerbAndResource('kubectl set image deployment/web app=nginx')).toEqual({ verb: 'update', resource: 'deployments' });
      expect(deriveVerbAndResource('kubectl rollout status deploy/web')).toEqual({ verb: 'update', resource: 'deployments' });
    });

    it('covers checkRbacPermission verb wildcard, resource wildcard, and kubernetes-admin identity', () => {
      storeState.activeIdentity = 'kubernetes-admin';
      expect(checkRbacPermission(mockCtx, 'delete', 'secrets')).toBe(true);

      // Wildcard verb and resource matching in custom role
      storeState.activeIdentity = 'wildcard_user';
      storeState.iamUsers.push({ id: 'u-wild', username: 'wildcard_user', accessType: 'Managed Access', policies: [] });

      const wildcardRoleCtx: any = {
        ...mockCtx,
        nodes: [
          {
            id: 'n-wild',
            type: 'Pod',
            data: {
              roles: [
                {
                  name: 'all-access',
                  assignedUsers: ['wildcard_user'],
                  rules: [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }],
                },
              ],
            },
          },
        ],
        getStoreState: () => ({ activeIdentity: 'wildcard_user', iamUsers: storeState.iamUsers }),
      };

      expect(checkRbacPermission(wildcardRoleCtx, 'delete', 'deployments')).toBe(true);
    });

    it('covers checkIamPolicy non-matching policy branches, default activeIdentity fallback, and rule verb/resource non-matches', () => {
      // 1. checkIamPolicy for non-matching policy/verb/resource
      storeState.iamUsers.push({
        id: 'u-dev-only',
        username: 'dev_user',
        accessType: 'Managed Access',
        policies: [{ name: 'ContainerDeveloperPolicy', type: 'Default', description: 'Container dev' }],
      });
      storeState.activeIdentity = 'dev_user';

      // ContainerDeveloperPolicy allows pods/deployments/replicasets/configmaps/secrets, but NOT services/pvcs on delete
      expect(checkRbacPermission(mockCtx, 'delete', 'services')).toBe(false);
      expect(checkRbacPermission(mockCtx, 'delete', 'pvcs')).toBe(false);

      // 2. Default fallback for activeIdentity when activeIdentity is undefined or null in store
      storeState.activeIdentity = undefined;
      expect(checkRbacPermission(mockCtx, 'get', 'pods')).toBe(true);

      // 3. evaluateRbacForCommand fallback when activeIdentity is empty/undefined
      storeState.activeIdentity = undefined;
      expect(evaluateRbacForCommand('kubectl get pods', mockCtx)).toBe(true);

      // 4. Role rule evaluation when verb or resource does not match
      const mismatchedRoleCtx: any = {
        ...mockCtx,
        nodes: [
          {
            id: 'n-mismatch',
            type: 'Pod',
            data: {
              roles: [
                {
                  name: 'specific-role',
                  assignedUsers: ['user_mismatch'],
                  rules: [{ resources: ['pods'], verbs: ['get'] }],
                },
              ],
            },
          },
        ],
        getStoreState: () => ({
          activeIdentity: 'user_mismatch',
          iamUsers: [
            { id: 'u-mismatch', username: 'user_mismatch', accessType: 'Managed Access', policies: [] },
          ],
        }),
      };

      // Mismatched verb ('delete' vs 'get')
      expect(checkRbacPermission(mismatchedRoleCtx, 'delete', 'pods')).toBe(false);
      // Mismatched resource ('services' vs 'pods')
      expect(checkRbacPermission(mismatchedRoleCtx, 'get', 'services')).toBe(false);
    });

    it('covers NetworkingAdminPolicy, StorageAdminPolicy, and ContainerDeveloperPolicy allowed resources in checkIamPolicy', () => {
      // Dev user creating pods
      storeState.activeIdentity = 'budi'; // Has ContainerDeveloperPolicy
      expect(checkRbacPermission(mockCtx, 'create', 'pods')).toBe(true);
      expect(checkRbacPermission(mockCtx, 'create', 'deployments')).toBe(true);

      // Net user creating ingresses
      storeState.activeIdentity = 'net_user'; // Has NetworkingAdminPolicy
      expect(checkRbacPermission(mockCtx, 'create', 'ingresses')).toBe(true);

      // Storage user creating pvcs
      storeState.activeIdentity = 'storage_user'; // Has StorageAdminPolicy
      expect(checkRbacPermission(mockCtx, 'create', 'pvcs')).toBe(true);
    });
  });
});
