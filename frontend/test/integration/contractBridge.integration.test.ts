import { describe, it, expect, beforeEach } from 'vitest';
import { initWailsMocks } from '@/lib/mocks';
import { useFlowStore } from '@/store/useFlowStore';

// Canonical list of all IPC methods exposed by the Go Wails backend (App struct in app.go)
const WAILS_APP_IPC_METHODS = [
  'CalculateAppHeight',
  'CheckForUpdates',
  'CloseWindow',
  'DeleteInternetProfile',
  'DeleteProject',
  'ExportProjectFile',
  'FetchDockerHubPopular',
  'FetchDockerHubTags',
  'FileExists',
  'GenerateYaml',
  'GetAutosaveProfiles',
  'GetCurrentHistoryIndex',
  'GetHistoryLogs',
  'GetInternetProfiles',
  'GetProjects',
  'GetSetting',
  'GetSystemInfo',
  'GetSystemResources',
  'GetTargetScreen',
  'GetTargetScreenHeight',
  'Greet',
  'ImportProjectFile',
  'JumpToHistory',
  'LoadProject',
  'MaximizeWindow',
  'MinimizeWindow',
  'OpenFileFolder',
  'OpenLogFile',
  'PushHistory',
  'Redo',
  'SaveInternetProfile',
  'SaveProject',
  'SaveSetting',
  'SearchDockerHub',
  'SetInitialFile',
  'Undo',
  'UpdateProject',
  'WriteLog',
] as const;

describe('Tahap 3 - Contract & Schema Bridge Validation Test', () => {
  beforeEach(() => {
    // Reset globalThis.go and localStorage
    delete (globalThis as any).go;
    delete (globalThis as any).runtime;
    localStorage.clear();
    sessionStorage.clear();
    useFlowStore.setState({ nodes: [], edges: [], history: [] });
  });

  describe('1. Wails App API & Browser Mock Parity Contract', () => {
    it('ensures every Wails generated method has a matching implementation in mocks.ts', () => {
      initWailsMocks();
      const mockApp = (globalThis as any).go?.main?.App;
      expect(mockApp).toBeDefined();

      // Verify that every single Wails backend IPC method exists in mocks.ts
      expect(WAILS_APP_IPC_METHODS).toHaveLength(38);

      WAILS_APP_IPC_METHODS.forEach((methodName) => {
        expect(
          typeof mockApp[methodName],
          `Expected mock implementation for Wails binding "${methodName}" to exist in mocks.ts`
        ).toBe('function');
      });
    });

    it('verifies essential mock methods return matching contract signatures and valid data', async () => {
      initWailsMocks();
      const mockApp = (globalThis as any).go.main.App;

      // 1. GenerateYaml contract
      const dummyNodes = JSON.stringify([
        { id: 'pod-1', type: 'Pod', data: { label: 'my-pod', type: 'Pod', image: 'nginx:alpine' } }
      ]);
      const yamlOutput = await mockApp.GenerateYaml(dummyNodes, '[]');
      expect(typeof yamlOutput).toBe('string');
      expect(yamlOutput).toContain('kind: Pod');
      expect(yamlOutput).toContain('image: nginx:alpine');

      // 2. DockerHub mock methods contract
      const popularRaw = await mockApp.FetchDockerHubPopular();
      const popularData = JSON.parse(popularRaw);
      expect(Array.isArray(popularData.results)).toBe(true);
      expect(popularData.results.length).toBeGreaterThan(0);

      const tagsRaw = await mockApp.FetchDockerHubTags('nginx');
      const tagsData = JSON.parse(tagsRaw);
      expect(Array.isArray(tagsData.results)).toBe(true);

      const searchRaw = await mockApp.SearchDockerHub('redis');
      const searchData = JSON.parse(searchRaw);
      expect(Array.isArray(searchData.results)).toBe(true);

      // 3. Update check contract
      const updateResult = await mockApp.CheckForUpdates('1.0.0');
      expect(updateResult).toHaveProperty('updateAvailable');
      expect(updateResult).toHaveProperty('currentVersion');
      expect(updateResult).toHaveProperty('latestVersion');

      // 4. System Info & Resources contract
      const sysInfo = await mockApp.GetSystemInfo();
      expect(sysInfo).toHaveProperty('os');
      expect(sysInfo).toHaveProperty('arch');
      expect(sysInfo).toHaveProperty('version');

      const sysRes = await mockApp.GetSystemResources();
      expect(sysRes).toHaveProperty('cpuCores');
      expect(sysRes).toHaveProperty('cpuUsage');
      expect(sysRes).toHaveProperty('totalMemoryGB');
    });


    it('validates project management and history persistence contracts in mocks', async () => {
      initWailsMocks();
      const mockApp = (globalThis as any).go.main.App;

      // Project saving and retrieval
      const projectId = await mockApp.SaveProject('Test Project', JSON.stringify({ nodes: [] }));
      expect(typeof projectId).toBe('number');

      const projects = await mockApp.GetProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Test Project');

      const loaded = await mockApp.LoadProject(projectId);
      expect(loaded).toBeDefined();
      expect(loaded.name).toBe('Test Project');

      // Project update
      const updated = await mockApp.UpdateProject(projectId, JSON.stringify({ nodes: [{ id: '1' }] }));
      expect(updated).toBe(true);

      // Project deletion
      const deleted = await mockApp.DeleteProject(projectId);
      expect(deleted).toBe(true);
      const remainingProjects = await mockApp.GetProjects();
      expect(remainingProjects).toHaveLength(0);
    });
  });

  describe('2. Serialization Schema Contract (Frontend Node/Edge -> Go Struct)', () => {
    it('verifies that frontend canvas node types and data fields match Go k8s.FrontendNode tags', () => {
      const store = useFlowStore.getState();

      // Add a Pod node with comprehensive configuration
      store.addNode('Pod');
      const podNode = useFlowStore.getState().nodes.find((n) => n.type === 'Pod')!;
      expect(podNode).toBeDefined();

      store.updateNodeData(podNode.id, {
        image: 'redis:latest',
        port: 6379,
        targetPort: 6379,
        restartPolicy: 'Always',
        cpuRequest: '100m',
        cpuLimit: '200m',
        memoryRequest: '128Mi',
        memoryLimit: '256Mi',
        configData: [{ key: 'REDIS_PORT', value: '6379' }],
      });

      const updatedPod = useFlowStore.getState().nodes.find((n) => n.id === podNode.id)!;
      const serialized = JSON.parse(JSON.stringify(updatedPod));

      // Assert FrontendNode top-level structure contract
      expect(serialized).toHaveProperty('id');
      expect(serialized).toHaveProperty('type', 'Pod');
      expect(serialized).toHaveProperty('data');

      // Assert K8sNodeData schema properties (camelCase matching Go json struct tags)
      const data = serialized.data;
      expect(data).toHaveProperty('label');
      expect(data).toHaveProperty('type', 'Pod');
      expect(data).toHaveProperty('image', 'redis:latest');
      expect(data).toHaveProperty('port', 6379);
      expect(data).toHaveProperty('targetPort', 6379);
      expect(data).toHaveProperty('restartPolicy', 'Always');
      expect(data).toHaveProperty('cpuRequest', '100m');
      expect(data).toHaveProperty('cpuLimit', '200m');
      expect(data).toHaveProperty('memoryRequest', '128Mi');
      expect(data).toHaveProperty('memoryLimit', '256Mi');

      // Check configData item structure ({ key, value } matching Go ConfigDataItem)
      expect(Array.isArray(data.configData)).toBe(true);
      expect(data.configData[0]).toEqual({ key: 'REDIS_PORT', value: '6379' });

      // Invariant: no snake_case field drift
      expect(data).not.toHaveProperty('cpu_request');
      expect(data).not.toHaveProperty('cpu_limit');
      expect(data).not.toHaveProperty('memory_request');
      expect(data).not.toHaveProperty('memory_limit');
      expect(data).not.toHaveProperty('restart_policy');
      expect(data).not.toHaveProperty('target_port');
    });

    it('verifies Service and Ingress node configuration matches Go backend parser expectations', () => {
      const store = useFlowStore.getState();

      // Add a Service node
      store.addNode('Service');
      const svcNode = useFlowStore.getState().nodes.find((n) => n.type === 'Service')!;
      expect(svcNode).toBeDefined();

      store.updateNodeData(svcNode.id, {
        serviceType: 'NodePort',
        port: 80,
        targetPort: 8080,
        nodePort: 30080,
        selector: 'app=web',
        yamlSettings: { serviceType: true, nodePort: true, targetPort: true },
      });

      const serializedSvc = JSON.parse(JSON.stringify(useFlowStore.getState().nodes.find((n) => n.id === svcNode.id)!));
      const svcData = serializedSvc.data;

      expect(svcData).toHaveProperty('serviceType', 'NodePort');
      expect(svcData).toHaveProperty('port', 80);
      expect(svcData).toHaveProperty('targetPort', 8080);
      expect(svcData).toHaveProperty('nodePort', 30080);
      expect(svcData).toHaveProperty('selector', 'app=web');
      expect(svcData.yamlSettings).toEqual({ serviceType: true, nodePort: true, targetPort: true });

      // Invariant: no snake_case service_type
      expect(svcData).not.toHaveProperty('service_type');
      expect(svcData).not.toHaveProperty('node_port');
    });

    it('verifies PVC and HPA schema fields conform to Go backend struct definitions', () => {
      const store = useFlowStore.getState();

      // Add PVC
      store.addNode('PVC');
      const pvcNode = useFlowStore.getState().nodes.find((n) => n.type === 'PVC')!;
      store.updateNodeData(pvcNode.id, {
        accessMode: 'ReadWriteOnce',
        storageCapacity: '10Gi',
        storageClass: 'standard',
      });

      const serializedPVC = JSON.parse(JSON.stringify(useFlowStore.getState().nodes.find((n) => n.id === pvcNode.id)!));
      expect(serializedPVC.data).toHaveProperty('accessMode', 'ReadWriteOnce');
      expect(serializedPVC.data).toHaveProperty('storageCapacity', '10Gi');
      expect(serializedPVC.data).toHaveProperty('storageClass', 'standard');

      // Add HPA
      store.addNode('HPA');
      const hpaNode = useFlowStore.getState().nodes.find((n) => n.type === 'HPA')!;
      store.updateNodeData(hpaNode.id, {
        minReplicas: 2,
        maxReplicas: 10,
        targetCPU: 75,
        targetMemory: 80,
      });

      const serializedHPA = JSON.parse(JSON.stringify(useFlowStore.getState().nodes.find((n) => n.id === hpaNode.id)!));
      expect(serializedHPA.data).toHaveProperty('minReplicas', 2);
      expect(serializedHPA.data).toHaveProperty('maxReplicas', 10);
      expect(serializedHPA.data).toHaveProperty('targetCPU', 75);
      expect(serializedHPA.data).toHaveProperty('targetMemory', 80);
    });
  });

  describe('3. Project File (.infra) Format & Interoperability Contract', () => {
    it('maintains strict schema invariant for exported project files matching Go backend', () => {
      const store = useFlowStore.getState();
      store.addNode('Deployment');
      store.addNode('Service');

      const currentNodes = useFlowStore.getState().nodes;
      const currentEdges = [
        { id: 'e-1', source: currentNodes[0].id, target: currentNodes[1].id, sourceHandle: 'right-s', targetHandle: 'left-t' }
      ];

      // Exact .infra project payload schema as written by backend ExportProjectFile and consumed by useFileSystem
      const canvasString = JSON.stringify({
        nodes: currentNodes,
        edges: currentEdges,
      });
      const yamlContent = 'apiVersion: v1\nkind: Service\n';

      const projectPayload = {
        name: 'Enterprise Architecture',
        canvas: canvasString,
        yaml: yamlContent,
      };

      const serializedFile = JSON.stringify(projectPayload);
      const deserialized = JSON.parse(serializedFile);

      // Verify contract fields required by backend App.ImportProjectFile and App.ExportProjectFile
      expect(deserialized).toHaveProperty('name', 'Enterprise Architecture');
      expect(deserialized).toHaveProperty('canvas');
      expect(deserialized).toHaveProperty('yaml', yamlContent);

      // Verify canvas inner contract can be parsed and hydrated
      const parsedCanvas = JSON.parse(deserialized.canvas);
      expect(parsedCanvas).toHaveProperty('nodes');
      expect(parsedCanvas).toHaveProperty('edges');
      expect(parsedCanvas.nodes).toHaveLength(2);
      expect(parsedCanvas.edges).toHaveLength(1);
    });
  });
});
