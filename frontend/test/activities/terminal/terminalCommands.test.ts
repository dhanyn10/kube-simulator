import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleAdminCommands,
  handleApplyCommand,
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
} from '@/activities/terminal/terminalCommands';

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

      expect(handleGetSecretsCommand('kubectl get pods', mockCtx)).toBe(false);
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

      expect(handleDescribeSecretCommand('kubectl describe pod my-pod', mockCtx)).toBe(false);
    });

    it('handleDescribeSecretCommand describes all secrets when target name is omitted', () => {
      activityLogs = [];
      let handled = handleDescribeSecretCommand('kubectl describe secret', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('Name:         app-sec'))).toBe(true);

      mockCtx.nodes = [];
      activityLogs = [];
      handled = handleDescribeSecretCommand('kubectl describe secrets', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No secrets found'))).toBe(true);
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

      expect(handleGetConfigMapsCommand('kubectl get pods', mockCtx)).toBe(false);
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

      expect(handleDescribeConfigMapCommand('kubectl describe pod my-pod', mockCtx)).toBe(false);
    });

    it('handleDescribeConfigMapCommand describes all configmaps when target name is omitted', () => {
      activityLogs = [];
      let handled = handleDescribeConfigMapCommand('kubectl describe cm', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('Name:         app-cm'))).toBe(true);

      mockCtx.nodes = [];
      activityLogs = [];
      handled = handleDescribeConfigMapCommand('kubectl describe configmaps', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No configmaps found'))).toBe(true);
    });
  });

  describe('Role & RoleBinding Commands', () => {
    it('handleGetRolesCommand handles rolebindings and roles', () => {
      // Role with assigned users to cover line 659
      mockCtx.nodes.push({ id: 'assigned-role-node', type: 'Pod', data: { label: 'pod-assigned', roles: [{ name: 'assigned-role', assignedUsers: ['alice', 'bob'] }] } } as any);

      let handled = handleGetRolesCommand('kubectl get rolebindings', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('User/alice, User/bob'))).toBe(true);

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

      expect(handleGetRolesCommand('kubectl get pods', mockCtx)).toBe(false);
    });

    it('handleDescribeRoleCommand describes existing or missing role and rolebinding', () => {
      let handled = handleDescribeRoleCommand('kubectl describe role reader-role', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('Name:') && l.includes('reader-role'))).toBe(true);

      handled = handleDescribeRoleCommand('kubectl describe rolebinding reader-role-binding', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('RoleRef:'))).toBe(true);

      handled = handleDescribeRoleCommand('kubectl describe role unknown-role', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('role "unknown-role" not found'))).toBe(true);

      expect(handleDescribeRoleCommand('kubectl describe pod my-pod', mockCtx)).toBe(false);
    });

    it('handleDescribeRoleCommand describes all roles or rolebindings when target name is omitted', () => {
      activityLogs = [];
      let handled = handleDescribeRoleCommand('kubectl describe roles', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('reader-role'))).toBe(true);

      activityLogs = [];
      handled = handleDescribeRoleCommand('kubectl describe rolebindings', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('reader-role-binding'))).toBe(true);

      mockCtx.nodes = [];
      activityLogs = [];
      handled = handleDescribeRoleCommand('kubectl describe roles', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No roles found'))).toBe(true);

      handled = handleDescribeRoleCommand('kubectl describe rolebindings', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No rolebindings found'))).toBe(true);
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

      expect(handleDescribeDeploymentCommand('kubectl describe pod my-pod', mockCtx)).toBe(false);
    });

    it('handleDescribeDeploymentCommand describes all deployments when target name is omitted', () => {
      activityLogs = [];
      let handled = handleDescribeDeploymentCommand('kubectl describe deploy', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('my-dep'))).toBe(true);

      mockCtx.nodes = [];
      activityLogs = [];
      handled = handleDescribeDeploymentCommand('kubectl describe deployment', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No deployments found'))).toBe(true);
    });

    it('handleScaleCommand handles scaling deployment, replicaset, or not found', () => {
      let handled = handleScaleCommand('kubectl scale deployment/my-dep --replicas=5', mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.updateNodeData).toHaveBeenCalledWith('deploy-1', { replicas: 5 });

      // Add ReplicaSet node
      mockCtx.nodes.push({ id: 'rs-1', type: 'ReplicaSet', data: { label: 'my-rs', replicas: 2 } } as any);
      handled = handleScaleCommand('kubectl scale replicaset/my-rs --replicas=4', mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.updateNodeData).toHaveBeenCalledWith('rs-1', { replicas: 4 });

      handled = handleScaleCommand('kubectl scale deployment/unknown-dep --replicas=5', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment "unknown-dep" not found'))).toBe(true);

      expect(handleScaleCommand('kubectl get pods', mockCtx)).toBe(false);
    });

    it('handleSetImageCommand initiates rollout or handles missing deployment', () => {
      let handled = handleSetImageCommand('kubectl set image deployment/my-dep app=nginx:1.25', mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.updateNodeData).toHaveBeenCalledWith('deploy-1', expect.objectContaining({ rolloutTargetImage: 'nginx:1.25' }));

      handled = handleSetImageCommand('kubectl set image deployment/unknown-dep app=nginx:1.25', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment "unknown-dep" not found'))).toBe(true);

      expect(handleSetImageCommand('kubectl get pods', mockCtx)).toBe(false);
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

      expect(handleRolloutStatusCommand('kubectl get pods', mockCtx)).toBe(false);
    });

    it('handleRolloutHistoryCommand lists revision history', () => {
      let handled = handleRolloutHistoryCommand('kubectl rollout history deployment/my-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('REVISION'))).toBe(true);

      handled = handleRolloutHistoryCommand('kubectl rollout history deployment/unknown-dep', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment "unknown-dep" not found'))).toBe(true);

      expect(handleRolloutHistoryCommand('kubectl get pods', mockCtx)).toBe(false);
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

      expect(handleRolloutUndoCommand('kubectl get pods', mockCtx)).toBe(false);
    });

    it('handleDeletePodCommand deletes standalone pod or self-heals deployment pod', () => {
      // Standalone pod deletion
      let handled = handleDeletePodCommand('kubectl delete pod my-pod', mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.deleteNodes).toHaveBeenCalledWith([mockCtx.nodes[0]]);

      // Deployment child pod self-healing with sibling pod to cover line 536 (!isNew)
      const childPod1 = { id: 'child-1', type: 'Pod', parentId: 'deploy-1', data: { label: 'my-dep-pod-1' } };
      const childPod2 = { id: 'child-2', type: 'Pod', parentId: 'deploy-1', data: { label: 'my-dep-pod-2' } };
      mockCtx.nodes.push(childPod1 as any, childPod2 as any);

      handled = handleDeletePodCommand('kubectl delete pod my-dep-pod-1', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('[self-healing]'))).toBe(true);

      handled = handleDeletePodCommand('kubectl delete pod unknown-pod', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('pod "unknown-pod" not found'))).toBe(true);

      expect(handleDeletePodCommand('kubectl get pods', mockCtx)).toBe(false);
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

      expect(handleGetAllCommand('kubectl get pods', mockCtx)).toBe(false);
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

      // Update to lower version warning (e.g. 0.2 vs 0.4 where compareVersions returns -1)
      handleAdminCommands('try version update 0.2.0', mockCtx);
      expect(activityLogs.some(l => l.includes('Dev-Mode Warning'))).toBe(true);

      // Update to equal version warning (e.g. 0.5.0 vs 0.5.0 where compareVersions returns 0)
      activityLogs = [];
      storeState.simulatedCurrentVersion = '0.5.0';
      handleAdminCommands('try version update 0.5.0', mockCtx);
      expect(activityLogs.some(l => l.includes('Dev-Mode Warning'))).toBe(true);

      // compareVersions where v1 > v2 (e.g. 0.6.0 vs 0.5.0 returning 1)
      activityLogs = [];
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

      // compareVersions return 0 when version strings match exactly
      activityLogs = [];
      storeState.simulatedCurrentVersion = 'v1.0.0';
      handleAdminCommands('try version update v1.0.0', mockCtx);
      expect(activityLogs.some(l => l.includes('Dev-Mode Warning'))).toBe(true);
    });

    it('blocks try commands when unauthenticated', () => {
      activityLogs = [];
      handleAdminCommands('try status', mockCtx);
      expect(activityLogs.some(l => l.includes('Admin mode is inactive'))).toBe(true);
    });
  });

  describe('handleApplyCommand and edge cases', () => {
    it('handleApplyCommand outputs created resources or empty message', () => {
      let handled = handleApplyCommand('kubectl apply -f k8s-manifest.yaml', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('deployment.apps/my-dep created'))).toBe(true);
      expect(activityLogs.some(l => l.includes('ingress.networking.k8s.io/my-ing created'))).toBe(true);

      mockCtx.nodes = [];
      activityLogs = [];
      handled = handleApplyCommand('kubectl apply -f k8s-manifest.yaml', mockCtx);
      expect(handled).toBe(true);
      expect(activityLogs.some(l => l.includes('No resources defined in the manifest.'))).toBe(true);

      expect(handleApplyCommand('kubectl get pods', mockCtx)).toBe(false);
    });

    it('handleDeletePodCommand deletes pod inside a non-Deployment parent (e.g. Namespace)', () => {
      const nsPod = { id: 'ns-pod-1', type: 'Pod', parentId: 'ns-1', data: { label: 'ns-pod' } };
      mockCtx.nodes = [nsPod as any, { id: 'ns-1', type: 'Namespace', data: {} } as any];

      const handled = handleDeletePodCommand('kubectl delete pod ns-pod', mockCtx);
      expect(handled).toBe(true);
      expect(mockCtx.deleteNodes).toHaveBeenCalledWith([nsPod]);
    });

    it('processVersionCurrentCmd queries current version when target version is missing', () => {
      storeState.isAdminAuthenticated = true;
      activityLogs = [];
      handleAdminCommands('try version current', mockCtx);
      expect(activityLogs.some(l => l.includes('Current assumed version'))).toBe(true);
    });

    it('covers all remaining terminalCommands uncovered conditions', () => {
      // 1. getResourceGroup via handleApplyCommand for HPA, ReplicaSet, Ingress, Pod
      mockCtx.nodes = [
        { id: 'hpa-node', type: 'HPA', data: { label: 'my-hpa' } },
        { id: 'rs-node', type: 'ReplicaSet', data: { label: 'my-rs' } },
        { id: 'ing-node', type: 'Ingress', data: { label: 'my-ing' } },
        { id: 'pod-node-unlabelled', type: 'Pod', data: {} } // n.data.label is missing -> falls back to n.id
      ] as any;
      activityLogs = [];
      handleApplyCommand('kubectl apply -f manifest.yaml', mockCtx);
      expect(activityLogs.some(l => l.includes('hpa.autoscaling/my-hpa created'))).toBe(true);
      expect(activityLogs.some(l => l.includes('replicaset.apps/my-rs created'))).toBe(true);
      expect(activityLogs.some(l => l.includes('ingress.networking.k8s.io/my-ing created'))).toBe(true);
      expect(activityLogs.some(l => l.includes('pod/pod-node-unlabelled created'))).toBe(true);

      // 2. Secret matching by s.id, missing s.type (Opaque fallback), and missing n.data.label (n.id fallback)
      mockCtx.nodes = [{ id: 'unlabelled-sec-owner', type: 'Pod', data: { secrets: [{ id: 'sec-id-123', name: 'Secret-By-ID', secretData: [{ key: 'KEY' }] }] } }] as any;
      activityLogs = [];
      handleDescribeSecretCommand('kubectl describe secret sec-id-123', mockCtx);
      expect(activityLogs.some(l => l.includes('Name:         Secret-By-ID'))).toBe(true);
      expect(activityLogs.some(l => l.includes('Type:         Opaque'))).toBe(true);
      expect(activityLogs.some(l => l.includes('Attached To:  unlabelled-sec-owner'))).toBe(true);

      // Secret data entry with missing value (0 bytes fallback)
      mockCtx.nodes = [{ id: 'owner1', type: 'Pod', data: { secrets: [{ id: 'sec-null-val', name: 'sec-null-val', secretData: [{ key: 'EMPTY_KEY', value: null }] }] } }] as any;
      activityLogs = [];
      handleDescribeSecretCommand('kubectl describe secret sec-null-val', mockCtx);
      expect(activityLogs.some(l => l.includes('EMPTY_KEY: 0 bytes'))).toBe(true);

      // 3. ConfigMap matching by cm.id and missing n.data.label (n.id fallback)
      mockCtx.nodes = [{ id: 'unlabelled-cm-owner', type: 'Pod', data: { configMaps: [{ id: 'cm-id-456', name: 'CM-By-ID', configData: [{ key: 'PORT', value: '8080' }] }] } }] as any;
      activityLogs = [];
      handleDescribeConfigMapCommand('kubectl describe cm cm-id-456', mockCtx);
      expect(activityLogs.some(l => l.includes('Name:         CM-By-ID'))).toBe(true);
      expect(activityLogs.some(l => l.includes('Attached To:  unlabelled-cm-owner'))).toBe(true);

      // 4. compareVersions semver parsing edge cases (equal semver returning 0, non-numeric parts, default version fallbacks)
      storeState.isAdminAuthenticated = true;
      storeState.simulatedCurrentVersion = 'v1.0.0';
      activityLogs = [];
      handleAdminCommands('try version update v1.0.0', mockCtx); // compareVersions('1.0.0', '1.0.0') returns 0 -> line 238
      expect(activityLogs.some(l => l.includes('Dev-Mode Warning'))).toBe(true);

      storeState.simulatedCurrentVersion = undefined; // falls back to '0.4.0'
      activityLogs = [];
      handleAdminCommands('try version update', mockCtx); // targetVersion falls back to '0.5.0'
      expect(activityLogs.some(l => l.includes('Simulated New Version v0.5.0 Available'))).toBe(true);

      // processVersionCurrentCmd clearing updateInfo when latestVersion <= targetVersion
      storeState.simulatedUpdateInfo = { latestVersion: '0.5.0', releaseUrl: 'http://test' };
      handleAdminCommands('try version current 0.6.0', mockCtx);
      expect(storeState.simulatedUpdateInfo).toBeNull();

      // 5. Admin command keywords: try clear, try update clear, admin logout
      storeState.isAdminAuthenticated = true;
      handleAdminCommands('try clear', mockCtx);
      expect(storeState.simulatedCurrentVersion).toBeNull();

      storeState.isAdminAuthenticated = true;
      handleAdminCommands('try update clear', mockCtx);
      expect(storeState.simulatedCurrentVersion).toBeNull();

      storeState.isAdminAuthenticated = true;
      handleAdminCommands('admin logout', mockCtx);
      expect(storeState.isAdminAuthenticated).toBe(false);

      // 6. Admin mode active: help command vs non-help commands
      storeState.isAdminAuthenticated = true;
      expect(handleAdminCommands('help', mockCtx)).toBe(false);

      activityLogs = [];
      expect(handleAdminCommands('kubectl get pods', mockCtx)).toBe(true);
      expect(activityLogs.some(l => l.includes('You are currently in Admin Mode'))).toBe(true);

      // Admin command dispatch returning false for handleAdminCommands line 361
      storeState.isAdminAuthenticated = false;
      storeState.isAwaitingAdminPassword = false;
      expect(handleAdminCommands('kubectl get pods', mockCtx)).toBe(false);

      // handleAdminCommands line 238 compareVersions equal version check
      storeState.isAdminAuthenticated = true;
      storeState.simulatedCurrentVersion = '1.0.0';
      activityLogs = [];
      handleAdminCommands('try version update 1.0.0', mockCtx);
      expect(activityLogs.some(l => l.includes('Dev-Mode Warning'))).toBe(true);

      // 7. handleDescribeRoleDetails with assignedUsers.length === 0 in rolebinding describe
      mockCtx.nodes = [{ id: 'unassigned-role-owner', type: 'Pod', data: { roles: [{ id: 'r-unassigned', name: 'unassigned-role', assignedUsers: [] }] } }] as any;
      activityLogs = [];
      handleDescribeRoleCommand('kubectl describe rolebinding unassigned-role-binding', mockCtx);
      expect(activityLogs.some(l => l.includes('<none>'))).toBe(true);

      // Rolebindings describe all with zero assignedUsers
      activityLogs = [];
      handleDescribeRoleCommand('kubectl describe rolebindings', mockCtx);
      expect(activityLogs.some(l => l.includes('ServiceAccount/default'))).toBe(true);

      // 7b. Role with assignedUsers in describe role and rolebindings
      mockCtx.nodes = [{ id: 'assigned-role-owner', type: 'Pod', data: { label: 'pod1', roles: [{ id: 'r-assigned', name: 'assigned-role', assignedUsers: ['alice', 'bob'] }] } }] as any;
      activityLogs = [];
      handleDescribeRoleCommand('kubectl describe rolebinding assigned-role-binding', mockCtx);
      expect(activityLogs.some(l => l.includes('Kind: User, Name: alice'))).toBe(true);

      activityLogs = [];
      handleDescribeRoleCommand('kubectl describe rolebindings', mockCtx);
      expect(activityLogs.some(l => l.includes('User/alice'))).toBe(true);

      // 8. handleDescribeDeploymentCommand default fallbacks (replicas = 1, image = 'nginx:latest')
      mockCtx.nodes = [
        { id: 'dep-no-data', type: 'Deployment', data: {} }
      ] as any;
      activityLogs = [];
      handleDescribeDeploymentCommand('kubectl describe deploy', mockCtx);
      expect(activityLogs.some(l => l.includes('1 desired | 1 updated | 1 total'))).toBe(true);

      activityLogs = [];
      handleDescribeDeploymentCommand('kubectl describe deploy dep-no-data', mockCtx);
      expect(activityLogs.some(l => l.includes('nginx:latest'))).toBe(true);

      // 9. handleGetAllCommand with service missing port (falls back to 80) and attached HPA
      mockCtx.nodes = [
        { id: 'svc-no-port', type: 'Service', data: { label: 'no-port-svc' } },
        { id: 'owner-hpa', type: 'Deployment', data: { label: 'owner-dep', hpas: [{ name: 'att-hpa', minReplicas: 1, maxReplicas: 5 }] } }
      ] as any;
      activityLogs = [];
      handleGetAllCommand('kubectl get all', mockCtx);
      expect(activityLogs.some(l => l.includes('80/TCP'))).toBe(true);
      expect(activityLogs.some(l => l.includes('att-hpa'))).toBe(true);
    });
  });
});
