import { describe, it, expect, vi } from 'vitest';
import { Node } from '@xyflow/react';
import {
  handleScaleCommand,
  handleSetImageCommand,
  handleRolloutStatusCommand,
  handleRolloutHistoryCommand,
  handleRolloutUndoCommand,
  handleDeletePodCommand,
  handleGetAllCommand,
  handleGetRolesCommand,
  handleDescribeRoleCommand,
  handleDescribeDeploymentCommand,
  handleAdminCommands,
  CommandContext,
} from '@/components/Layout/terminalCommands';

describe('terminalCommands', () => {
  const createMockContext = (nodes: Node[] = []): { ctx: CommandContext; logs: string[]; store: any } => {
    const logs: string[] = [];
    const storeState: any = {
      isAdminAuthenticated: false,
      isAwaitingAdminPassword: false,
      simulatedCurrentVersion: '0.3.0',
      simulatedUpdateInfo: null,
      setSimulatedUpdateInfo: (info: any) => { storeState.simulatedUpdateInfo = info; },
      setSimulatedCurrentVersion: (ver: any) => { storeState.simulatedCurrentVersion = ver; },
    };

    const ctx: CommandContext = {
      nodes,
      isSimulating: true,
      updateNodeData: vi.fn(),
      addActivityLog: (msg: string) => logs.push(msg),
      deleteNodes: vi.fn(),
      getStoreState: () => storeState,
      setStoreState: (updates: any) => Object.assign(storeState, updates),
    };

    return { ctx, logs, store: storeState };
  };

  it('handleScaleCommand scales deployment or outputs not found', () => {
    const depNode: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web-dep', replicas: 2 } };
    const { ctx, logs } = createMockContext([depNode]);

    expect(handleScaleCommand('kubectl scale deployment/web-dep --replicas=5', ctx)).toBe(true);
    expect(ctx.updateNodeData).toHaveBeenCalledWith('dep-1', { replicas: 5 });
    expect(logs.some(l => l.includes('web-dep scaled'))).toBe(true);

    const { ctx: ctx2, logs: logs2 } = createMockContext([]);
    expect(handleScaleCommand('kubectl scale deployment/missing --replicas=5', ctx2)).toBe(true);
    expect(logs2.some(l => l.includes('NotFound'))).toBe(true);

    expect(handleScaleCommand('kubectl get pods', ctx)).toBe(false);
  });

  it('handleSetImageCommand updates deployment image or outputs not found', () => {
    const depNode: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web-dep', image: 'nginx:1.19' } };
    const { ctx, logs } = createMockContext([depNode]);

    expect(handleSetImageCommand('kubectl set image deployment/web-dep nginx=nginx:1.21', ctx)).toBe(true);
    expect(ctx.updateNodeData).toHaveBeenCalledWith('dep-1', expect.objectContaining({ rolloutTargetImage: 'nginx:1.21' }));
    expect(logs.some(l => l.includes('image updated'))).toBe(true);

    const { ctx: ctx2, logs: logs2 } = createMockContext([]);
    expect(handleSetImageCommand('kubectl set image deployment/missing nginx=1.0', ctx2)).toBe(true);
    expect(logs2.some(l => l.includes('NotFound'))).toBe(true);
  });

  it('handleRolloutStatusCommand reports rollout status or not found', () => {
    const depRolling: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web-dep', isRollingUpdate: true, rolloutStatus: 'Updating 1/3' } };
    const { ctx, logs } = createMockContext([depRolling]);

    expect(handleRolloutStatusCommand('kubectl rollout status deployment/web-dep', ctx)).toBe(true);
    expect(logs.some(l => l.includes('Waiting for deployment'))).toBe(true);

    depRolling.data.isRollingUpdate = false;
    expect(handleRolloutStatusCommand('kubectl rollout status deployment/web-dep', ctx)).toBe(true);
    expect(logs.some(l => l.includes('successfully rolled out'))).toBe(true);

    const { ctx: ctx2, logs: logs2 } = createMockContext([]);
    expect(handleRolloutStatusCommand('kubectl rollout status deployment/missing', ctx2)).toBe(true);
    expect(logs2.some(l => l.includes('NotFound'))).toBe(true);
  });

  it('handleRolloutHistoryCommand prints revisions or not found', () => {
    const depNode: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web-dep', rolloutRevisions: ['nginx:1.19', 'nginx:1.20'] } };
    const { ctx, logs } = createMockContext([depNode]);

    expect(handleRolloutHistoryCommand('kubectl rollout history deployment/web-dep', ctx)).toBe(true);
    expect(logs.some(l => l.includes('REVISION'))).toBe(true);

    const { ctx: ctx2, logs: logs2 } = createMockContext([]);
    expect(handleRolloutHistoryCommand('kubectl rollout history deployment/missing', ctx2)).toBe(true);
    expect(logs2.some(l => l.includes('NotFound'))).toBe(true);
  });

  it('handleRolloutUndoCommand rolls back image or outputs warning/not found', () => {
    const dep1Rev: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web-dep', rolloutRevisions: ['nginx:1.19'] } };
    const { ctx: ctx1, logs: logs1 } = createMockContext([dep1Rev]);

    expect(handleRolloutUndoCommand('kubectl rollout undo deployment/web-dep', ctx1)).toBe(true);
    expect(logs1.some(l => l.includes('No previous revision found'))).toBe(true);

    const dep2Rev: Node = { id: 'dep-2', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'app-dep', rolloutRevisions: ['nginx:1.19', 'nginx:1.20'] } };
    const { ctx: ctx2, logs: logs2 } = createMockContext([dep2Rev]);

    expect(handleRolloutUndoCommand('kubectl rollout undo deployment/app-dep', ctx2)).toBe(true);
    expect(logs2.some(l => l.includes('rolled back to revision'))).toBe(true);

    const { ctx: ctx3, logs: logs3 } = createMockContext([]);
    expect(handleRolloutUndoCommand('kubectl rollout undo deployment/missing', ctx3)).toBe(true);
    expect(logs3.some(l => l.includes('NotFound'))).toBe(true);
  });

  it('handleDeletePodCommand deletes standalone pod or triggers self-healing for deployment pod', () => {
    const standalonePod: Node = { id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'my-pod' } };
    const { ctx: ctx1 } = createMockContext([standalonePod]);

    expect(handleDeletePodCommand('kubectl delete pod my-pod', ctx1)).toBe(true);
    expect(ctx1.deleteNodes).toHaveBeenCalledWith([standalonePod]);

    const dep: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web-dep', replicas: 1 } };
    const childPod: Node = { id: 'pod-2', type: 'Pod', parentId: 'dep-1', position: { x: 10, y: 10 }, data: { label: 'child-pod' } };
    const { ctx: ctx2, logs: logs2 } = createMockContext([dep, childPod]);

    expect(handleDeletePodCommand('kubectl delete pod child-pod', ctx2)).toBe(true);
    expect(logs2.some(l => l.includes('self-healing'))).toBe(true);

    const { ctx: ctx3, logs: logs3 } = createMockContext([]);
    expect(handleDeletePodCommand('kubectl delete pod missing-pod', ctx3)).toBe(true);
    expect(logs3.some(l => l.includes('NotFound'))).toBe(true);
  });

  it('handleGetAllCommand lists all resources', () => {
    const nodes: Node[] = [
      { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'p1', status: 'ready' } },
      { id: 'p2', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'p2', status: 'pending' } },
      { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'd1', replicas: 2 } },
      { id: 's1', type: 'Service', position: { x: 0, y: 0 }, data: { label: 's1', port: 8080 } },
      { id: 'i1', type: 'Ingress', position: { x: 0, y: 0 }, data: { label: 'i1', ingressHost: 'test.local' } },
      { id: 'h1', type: 'HPA', position: { x: 0, y: 0 }, data: { label: 'h1', minReplicas: 1, maxReplicas: 5 } },
    ];
    const { ctx, logs } = createMockContext(nodes);

    expect(handleGetAllCommand('kubectl get all', ctx)).toBe(true);
    expect(logs.some(l => l.includes('pod/p1'))).toBe(true);
    expect(logs.some(l => l.includes('deployment.apps/d1'))).toBe(true);
    expect(logs.some(l => l.includes('service/s1'))).toBe(true);
    expect(logs.some(l => l.includes('ingress.networking.k8s.io/i1'))).toBe(true);
    expect(logs.some(l => l.includes('horizontalpodautoscaler.autoscaling/h1'))).toBe(true);
  });

  it('handleGetRolesCommand lists roles and rolebindings', () => {
    const { ctx: ctxEmpty, logs: logsEmpty } = createMockContext([]);
    expect(handleGetRolesCommand('kubectl get roles', ctxEmpty)).toBe(true);
    expect(logsEmpty.some(l => l.includes('No roles found'))).toBe(true);

    expect(handleGetRolesCommand('kubectl get rolebindings', ctxEmpty)).toBe(true);
    expect(logsEmpty.some(l => l.includes('No rolebindings found'))).toBe(true);

    const nodeWithRoles: Node = {
      id: 'dep-1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: {
        label: 'web-dep',
        roles: [{ id: 'r1', name: 'admin-role', rules: [] }],
      },
    };
    const { ctx, logs } = createMockContext([nodeWithRoles]);

    expect(handleGetRolesCommand('kubectl get roles', ctx)).toBe(true);
    expect(logs.some(l => l.includes('admin-role'))).toBe(true);

    expect(handleGetRolesCommand('kubectl get rolebindings', ctx)).toBe(true);
    expect(logs.some(l => l.includes('admin-role-binding'))).toBe(true);
  });

  it('handleDescribeRoleCommand describes role or outputs not found', () => {
    const nodeWithRoles: Node = {
      id: 'dep-1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: {
        label: 'web-dep',
        roles: [{ id: 'r1', name: 'pod-reader', rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }] }],
      },
    };
    const { ctx, logs } = createMockContext([nodeWithRoles]);

    expect(handleDescribeRoleCommand('kubectl describe role pod-reader', ctx)).toBe(true);
    expect(logs.some(l => l.includes('Name:         pod-reader'))).toBe(true);

    const { ctx: ctx2, logs: logs2 } = createMockContext([]);
    expect(handleDescribeRoleCommand('kubectl describe role missing-role', ctx2)).toBe(true);
    expect(logs2.some(l => l.includes('NotFound'))).toBe(true);
  });

  it('handleDescribeDeploymentCommand describes deployment or outputs not found', () => {
    const depNode: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web-dep', replicas: 3 } };
    const { ctx, logs } = createMockContext([depNode]);

    expect(handleDescribeDeploymentCommand('kubectl describe deployment web-dep', ctx)).toBe(true);
    expect(logs.some(l => l.includes('Name:                   web-dep'))).toBe(true);

    const { ctx: ctx2, logs: logs2 } = createMockContext([]);
    expect(handleDescribeDeploymentCommand('kubectl describe deployment missing', ctx2)).toBe(true);
    expect(logs2.some(l => l.includes('NotFound'))).toBe(true);
  });

  it('handleAdminCommands handles password authentication, session, and try commands', () => {
    const { ctx, logs, store } = createMockContext([]);

    // 1. Prompt password
    expect(handleAdminCommands('kubesim admin', ctx)).toBe(true);
    expect(store.isAwaitingAdminPassword).toBe(true);

    // 2. Incorrect password
    expect(handleAdminCommands('wrongpass', ctx)).toBe(true);
    expect(logs.some(l => l.includes('Incorrect password'))).toBe(true);

    // 3. Prompt again & enter correct password
    handleAdminCommands('kubesim admin', ctx);
    handleAdminCommands('admin', ctx);
    expect(store.isAdminAuthenticated).toBe(true);

    // 4. Already authenticated message
    handleAdminCommands('kubesim admin', ctx);
    expect(logs.some(l => l.includes('Already authenticated'))).toBe(true);

    // 5. Try version update lower version warning
    handleAdminCommands('try version update v0.2.0', ctx);
    expect(logs.some(l => l.includes('cannot be equal or lower'))).toBe(true);

    // 6. Try version update valid
    handleAdminCommands('try version update v0.5.0', ctx);
    expect(store.simulatedUpdateInfo.latestVersion).toBe('0.5.0');

    // 7. Try version current
    handleAdminCommands('try version current v0.6.0', ctx);
    expect(store.simulatedCurrentVersion).toBe('0.6.0');

    // 8. Try status
    handleAdminCommands('try status', ctx);
    expect(logs.some(l => l.includes('[Dev-Mode Status]'))).toBe(true);

    // 9. Try clear
    handleAdminCommands('try clear', ctx);
    expect(store.simulatedUpdateInfo).toBeNull();

    // 10. Logout
    handleAdminCommands('logout', ctx);
    expect(store.isAdminAuthenticated).toBe(false);
  });
});
