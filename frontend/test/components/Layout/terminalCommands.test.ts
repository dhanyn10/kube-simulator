import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleAdminCommands,
  handleScaleCommand,
  handleSetImageCommand,
  handleGetAllCommand,
  handleGetRolesCommand,
  handleDescribeRoleCommand,
  handleDescribeDeploymentCommand,
  CommandContext
} from '@/components/Layout/terminalCommands';

describe('terminalCommands', () => {
  let mockCtx: CommandContext;
  let activityLogs: string[];
  let storeState: any;

  beforeEach(() => {
    activityLogs = [];
    storeState = {
      isAdminAuthenticated: false,
      isAwaitingAdminPassword: false,
      simulatedCurrentVersion: '0.3.0',
      simulatedUpdateInfo: null,
      setSimulatedUpdateInfo: (info: any) => { storeState.simulatedUpdateInfo = info; },
      setSimulatedCurrentVersion: (ver: any) => { storeState.simulatedCurrentVersion = ver; },
    };

    mockCtx = {
      nodes: [
        { id: 'pod-1', type: 'Pod', data: { label: 'my-pod', status: 'ready' } },
        { id: 'deploy-1', type: 'Deployment', data: { label: 'my-dep', replicas: 3, image: 'nginx:latest' } },
        { id: 'role-node', type: 'Pod', data: { label: 'app-pod', roles: [{ name: 'reader-role', rules: [{ resources: ['pods'], apiGroups: [''], verbs: ['get'] }] }] } },
      ] as any,
      isSimulating: true,
      updateNodeData: vi.fn(),
      addActivityLog: (line: string) => { activityLogs.push(line); },
      deleteNodes: vi.fn(),
      getStoreState: () => storeState,
      setStoreState: (newState: any) => { Object.assign(storeState, newState); },
    };
  });

  it('handleGetAllCommand lists all resources', () => {
    const handled = handleGetAllCommand('kubectl get all', mockCtx);
    expect(handled).toBe(true);
    expect(activityLogs.some(line => line.includes('pod/my-pod'))).toBe(true);
    expect(activityLogs.some(line => line.includes('deployment.apps/my-dep'))).toBe(true);
  });

  it('handleGetRolesCommand and handleDescribeRoleCommand', () => {
    const handledGet = handleGetRolesCommand('kubectl get roles', mockCtx);
    expect(handledGet).toBe(true);
    expect(activityLogs.some(line => line.includes('reader-role'))).toBe(true);

    const handledDescribe = handleDescribeRoleCommand('kubectl describe role reader-role', mockCtx);
    expect(handledDescribe).toBe(true);
    expect(activityLogs.some(line => line.includes('Name:         reader-role'))).toBe(true);
  });

  it('handleDescribeDeploymentCommand describes deployment', () => {
    const handled = handleDescribeDeploymentCommand('kubectl describe deployment my-dep', mockCtx);
    expect(handled).toBe(true);
    expect(activityLogs.some(line => line.includes('Name:                   my-dep'))).toBe(true);
  });

  it('handleScaleCommand scales deployment', () => {
    const handled = handleScaleCommand('kubectl scale deployment/my-dep --replicas=5', mockCtx);
    expect(handled).toBe(true);
    expect(mockCtx.updateNodeData).toHaveBeenCalledWith('deploy-1', { replicas: 5 });
  });

  it('handleSetImageCommand initiates rolling update', () => {
    const handled = handleSetImageCommand('kubectl set image deployment/my-dep app=nginx:1.25', mockCtx);
    expect(handled).toBe(true);
    expect(mockCtx.updateNodeData).toHaveBeenCalledWith('deploy-1', expect.objectContaining({ rolloutTargetImage: 'nginx:1.25' }));
  });

  it('handleAdminCommands handles admin authentication and test commands', () => {
    handleAdminCommands('kubesim admin', mockCtx);
    expect(storeState.isAwaitingAdminPassword).toBe(true);

    handleAdminCommands('admin123', mockCtx);
    expect(storeState.isAdminAuthenticated).toBe(true);

    handleAdminCommands('try version update 0.4.0', mockCtx);
    expect(storeState.simulatedUpdateInfo?.latestVersion).toBe('0.4.0');

    handleAdminCommands('exit', mockCtx);
    expect(storeState.isAdminAuthenticated).toBe(false);
  });
});
