import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleAdminCommands,
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
  handleGetConfigMapsCommand,
  handleDescribeConfigMapCommand,
  handleGetSecretsCommand,
  handleDescribeSecretCommand,
  CommandContext
} from '@/activity/terminal/terminalCommands';

describe('terminalCommands', () => {
  let mockCtx: CommandContext;
  let activityLogs: string[];
  let storeState: any;

  beforeEach(() => {
    activityLogs = [];
    storeState = {
      isAdminAuthenticated: false,
      isAwaitingAdminPassword: false,
      simulatedCurrentVersion: '0.4.0',
      simulatedUpdateInfo: null,
      setSimulatedUpdateInfo: (info: any) => { storeState.simulatedUpdateInfo = info; },
      setSimulatedCurrentVersion: (ver: any) => { storeState.simulatedCurrentVersion = ver; },
    };

    mockCtx = {
      nodes: [
        { id: 'pod-1', type: 'Pod', data: { label: 'my-pod', status: 'ready' } },
        { id: 'deploy-1', type: 'Deployment', data: { label: 'my-dep', replicas: 3, image: 'nginx:latest' } },
        { id: 'role-node', type: 'Pod', data: { label: 'app-pod', roles: [{ name: 'reader-role', rules: [{ resources: ['pods'], apiGroups: [''], verbs: ['get'] }] }] } },
        { id: 'cm-node', type: 'Deployment', data: { label: 'cm-dep', configMaps: [{ name: 'app-cm', configData: [{ key: 'ENV', value: 'prod' }] }, { name: 'empty-cm', configData: [] }] } },
        { id: 'secret-node', type: 'Deployment', data: { label: 'sec-dep', secrets: [{ name: 'app-sec', secretType: 'Opaque', secretData: [{ key: 'PASS', value: 'secret123' }] }, { name: 'empty-sec', secretType: 'Opaque', secretData: [] }] } },
        { id: 'hpa-node', type: 'Deployment', data: { label: 'hpa-dep', hpas: [{ name: 'app-hpa', minReplicas: 2, maxReplicas: 10, targetCPU: 80 }] } },
        { id: 'svc-1', type: 'Service', data: { label: 'my-svc', port: 8080 } },
        { id: 'ing-1', type: 'Ingress', data: { label: 'my-ing', ingressHost: 'app.test' } },
        { id: 'hpa-1', type: 'HPA', data: { label: 'my-hpa', minReplicas: 2, maxReplicas: 8 } },
      ] as any,
      isSimulating: true,
      updateNodeData: vi.fn(),
      addActivityLog: (line: string) => { activityLogs.push(line); },
      deleteNodes: vi.fn(),
      getStoreState: () => storeState,
      setStoreState: (newState: any) => { Object.assign(storeState, newState); },
    };
  });

  describe('Secrets Commands', () => {
    it('handleGetSecretsCommand displays secrets or empty message', () => {
      let handled = handleGetSecretsCommand('kubectl get secret', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('app-sec'))).toBe(true);

      mockCtx.nodes = [];
      activityLogs = [];
      handled = handleGetSecretsCommand('kubectl get secrets', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No secrets found'))).toBe(true);
    });

    it('handleDescribeSecretCommand describes secret with key-value data or not found', () => {
      let handled = handleDescribeSecretCommand('kubectl describe secret app-sec', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('Name:         app-sec'))).toBe(true);
      expect(activityLogs.some(l => l.includes('PASS:'))).toBe(true);

      handled = handleDescribeSecretCommand('kubectl describe secret empty-sec', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('<none>'))).toBe(true);

      handled = handleDescribeSecretCommand('kubectl describe secret missing-sec', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('secret "missing-sec" not found'))).toBe(true);
    });
  });


  describe('ConfigMap Commands', () => {
    it('handleGetConfigMapsCommand displays configmaps or empty message', () => {
      let handled = handleGetConfigMapsCommand('kubectl get cm', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('app-cm'))).toBe(true);

      mockCtx.nodes = [];
      activityLogs = [];
      handled = handleGetConfigMapsCommand('kubectl get configmap', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No configmaps found'))).toBe(true);
    });

    it('handleDescribeConfigMapCommand describes configmap with key-value data or not found', () => {
      let handled = handleDescribeConfigMapCommand('kubectl describe cm app-cm', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('Name:         app-cm'))).toBe(true);
      expect(activityLogs.some(l => l.includes('ENV:'))).toBe(true);

      handled = handleDescribeConfigMapCommand('kubectl describe cm empty-cm', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('<none>'))).toBe(true);

      handled = handleDescribeConfigMapCommand('kubectl describe cm missing-cm', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('configmap "missing-cm" not found'))).toBe(true);
    });
  });

  describe('Role & RoleBinding Commands', () => {
    it('handleGetRolesCommand handles rolebindings and roles', () => {
      let handled = handleGetRolesCommand('kubectl get rolebindings', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('reader-role-binding'))).toBe(true);

      handled = handleGetRolesCommand('kubectl get roles', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('reader-role'))).toBe(true);

      mockCtx.nodes = [];
      activityLogs = [];
      handled = handleGetRolesCommand('kubectl get rolebindings', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No rolebindings found'))).toBe(true);

      handled = handleGetRolesCommand('kubectl get roles', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No roles found'))).toBe(true);
    });

    it('handleDescribeRoleCommand describes existing or missing role', () => {
      let handled = handleDescribeRoleCommand('kubectl describe role reader-role', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('Name:         reader-role'))).toBe(true);

      handled = handleDescribeRoleCommand('kubectl describe role unknown-role', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('role "unknown-role" not found'))).toBe(true);
    });
  });

  describe('Deployment & Pod Commands', () => {
    it('handleDescribeDeploymentCommand describes deployment or not found', () => {
      let handled = handleDescribeDeploymentCommand('kubectl describe deployment my-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('Name:                   my-dep'))).toBe(true);

      handled = handleDescribeDeploymentCommand('kubectl describe deployment unknown-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment "unknown-dep" not found'))).toBe(true);
    });

    it('handleScaleCommand handles scaling deployment or not found', () => {
      let handled = handleScaleCommand('kubectl scale deployment/my-dep --replicas=5', mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.updateNodeData).toHaveBeenCalledWith('deploy-1', { replicas: 5 });

      handled = handleScaleCommand('kubectl scale deployment/unknown-dep --replicas=5', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment "unknown-dep" not found'))).toBe(true);
    });

    it('handleSetImageCommand initiates rollout or handles missing deployment', () => {
      let handled = handleSetImageCommand('kubectl set image deployment/my-dep app=nginx:1.25', mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.updateNodeData).toHaveBeenCalledWith('deploy-1', expect.objectContaining({ rolloutTargetImage: 'nginx:1.25' }));

      handled = handleSetImageCommand('kubectl set image deployment/unknown-dep app=nginx:1.25', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment "unknown-dep" not found'))).toBe(true);
    });

    it('handleRolloutStatusCommand checks rollout status or missing deployment', () => {
      let handled = handleRolloutStatusCommand('kubectl rollout status deployment/my-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('successfully rolled out'))).toBe(true);

      mockCtx.nodes[1].data.isRollingUpdate = true;
      mockCtx.nodes[1].data.rolloutStatus = 'Updating...';
      handled = handleRolloutStatusCommand('kubectl rollout status deployment/my-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('Waiting for deployment'))).toBe(true);

      handled = handleRolloutStatusCommand('kubectl rollout status deployment/unknown-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment "unknown-dep" not found'))).toBe(true);
    });

    it('handleRolloutHistoryCommand lists revision history', () => {
      let handled = handleRolloutHistoryCommand('kubectl rollout history deployment/my-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('REVISION'))).toBe(true);

      handled = handleRolloutHistoryCommand('kubectl rollout history deployment/unknown-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment "unknown-dep" not found'))).toBe(true);
    });

    it('handleRolloutUndoCommand undos rollout or handles insufficient revisions', () => {
      mockCtx.nodes[1].data.rolloutRevisions = ['v1', 'v2'];
      let handled = handleRolloutUndoCommand('kubectl rollout undo deployment/my-dep', mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.updateNodeData).toHaveBeenCalled();

      mockCtx.nodes[1].data.rolloutRevisions = ['v1'];
      activityLogs = [];
      handled = handleRolloutUndoCommand('kubectl rollout undo deployment/my-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No previous revision found'))).toBe(true);

      handled = handleRolloutUndoCommand('kubectl rollout undo deployment/unknown-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment "unknown-dep" not found'))).toBe(true);
    });

    it('handleDeletePodCommand deletes standalone pod or self-heals deployment pod', () => {
      // Standalone pod deletion
      let handled = handleDeletePodCommand('kubectl delete pod my-pod', mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.deleteNodes).toHaveBeenCalledWith([mockCtx.nodes[0]]);

      // Deployment child pod self-healing
      const childPod = { id: 'child-1', type: 'Pod', parentId: 'deploy-1', data: { label: 'my-dep-pod-1' } };
      mockCtx.nodes.push(childPod as any);
      handled = handleDeletePodCommand('kubectl delete pod my-dep-pod-1', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('[self-healing]'))).toBe(true);

      handled = handleDeletePodCommand('kubectl delete pod unknown-pod', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('pod "unknown-pod" not found'))).toBe(true);
    });

    it('handleGetAllCommand displays all resources when simulating or not', () => {
      let handled = handleGetAllCommand('kubectl get all', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('pod/my-pod'))).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment.apps/my-dep'))).toBe(true);
      expect(activityLogs.some(l => l.includes('service/my-svc'))).toBe(true);
      expect(activityLogs.some(l => l.includes('ingress.networking.k8s.io/my-ing'))).toBe(true);
      expect(activityLogs.some(l => l.includes('horizontalpodautoscaler.autoscaling/my-hpa'))).toBe(true);

      mockCtx.isSimulating = false;
      activityLogs = [];
      handled = handleGetAllCommand('kubectl get all', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('0/1'))).toBe(true);
    });
  });

  describe('Admin Commands', () => {
    it('handles admin login flow and password entry', () => {
      handleAdminCommands('kubesim admin', mockCtx);
      expect(storeState.isAwaitingAdminPassword).toBe(true);

      // Wrong password
      handleAdminCommands('wrongpass', mockCtx);
      expect(storeState.isAdminAuthenticated).toBe(false);

      handleAdminCommands('kubesim admin', mockCtx);
      // Valid password
      handleAdminCommands('admin123', mockCtx);
      expect(storeState.isAdminAuthenticated).toBe(true);

      // Already authenticated
      activityLogs = [];
      handleAdminCommands('kubesim admin', mockCtx);
      expect(activityLogs.some(l => l.includes('Already authenticated'))).toBe(true);
    });

    it('handles admin version simulation commands', () => {
      storeState.isAdminAuthenticated = true;

      // Update to lower or equal version warning
      handleAdminCommands('try version update 0.2.0', mockCtx);
      expect(activityLogs.some(l => l.includes('Dev-Mode Warning'))).toBe(true);

      // Update to higher version
      handleAdminCommands('try version update 0.6.0', mockCtx);
      expect(storeState.simulatedUpdateInfo?.latestVersion).toBe('0.6.0');

      // Set current version
      handleAdminCommands('try version current 0.5.0', mockCtx);
      expect(storeState.simulatedCurrentVersion).toBe('0.5.0');

      // Check status
      activityLogs = [];
      handleAdminCommands('try status', mockCtx);
      expect(activityLogs.some(l => l.includes('Current Version: v0.5.0'))).toBe(true);

      // Clear versions
      handleAdminCommands('try version clear', mockCtx);
      expect(storeState.simulatedCurrentVersion).toBeNull();

      handleAdminCommands('try clear', mockCtx);
      expect(storeState.simulatedUpdateInfo).toBeNull();

      // Logout
      handleAdminCommands('exit', mockCtx);
      expect(storeState.isAdminAuthenticated).toBe(false);

      // Re-login and test logout keyword
      storeState.isAdminAuthenticated = true;
      handleAdminCommands('logout', mockCtx);
      expect(storeState.isAdminAuthenticated).toBe(false);
    });

    it('handles admin error cases for invalid semver and unknown try commands', () => {
      storeState.isAdminAuthenticated = true;

      // Unknown try subcommand
      activityLogs = [];
      handleAdminCommands('try unknown-subcommand', mockCtx);
      expect(activityLogs.some(l => l.includes('Unknown command'))).toBe(true);
    });

    it('blocks try commands when unauthenticated', () => {
      activityLogs = [];
      handleAdminCommands('try status', mockCtx);
      expect(activityLogs.some(l => l.includes('Admin mode is inactive'))).toBe(true);
    });
  });
});
