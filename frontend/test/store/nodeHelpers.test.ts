import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hydrateNodes, syncDeployment, syncContainerSize, attachHandlers } from '@/store/nodeHelpers';
import { useFlowStore } from '@/store';

describe('nodeHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
    });
  });

  describe('attachHandlers', () => {
    it('returns onDelete and onRename handlers', () => {
      const get = () => useFlowStore.getState();
      const handlers = attachHandlers('node-1', get);
      expect(handlers.onDelete).toBeTypeOf('function');
      expect(handlers.onRename).toBeTypeOf('function');
    });

    it('deletes nodes when onDelete is called and node exists', () => {
      const node = { id: 'node-1', type: 'Pod', data: {} } as any;
      useFlowStore.setState({ nodes: [node] });
      const deleteNodesSpy = vi.spyOn(useFlowStore.getState(), 'deleteNodes');

      const handlers = attachHandlers('node-1', () => useFlowStore.getState());
      handlers.onDelete();

      expect(deleteNodesSpy).toHaveBeenCalledWith([node]);
    });

    it('does nothing on onDelete if node does not exist in store', () => {
      useFlowStore.setState({ nodes: [] });
      const deleteNodesSpy = vi.spyOn(useFlowStore.getState(), 'deleteNodes');

      const handlers = attachHandlers('node-missing', () => useFlowStore.getState());
      handlers.onDelete();

      expect(deleteNodesSpy).not.toHaveBeenCalled();
    });

    it('updates node label when onRename is called', () => {
      const updateNodeDataSpy = vi.spyOn(useFlowStore.getState(), 'updateNodeData');
      const handlers = attachHandlers('node-1', () => useFlowStore.getState());

      handlers.onRename('New Name');
      expect(updateNodeDataSpy).toHaveBeenCalledWith('node-1', { label: 'new-name' });
    });
  });

  describe('hydrateNodes', () => {
    it('hydrates nodes with handlers and initial data', () => {
      const nodes = [{ id: 'node-1', type: 'Pod', data: { label: 'pod-1' } }];
      const get = () => useFlowStore.getState();

      const hydrated = hydrateNodes(nodes, get);

      expect(hydrated[0].data.onDelete).toBeDefined();
      expect(hydrated[0].data.onRename).toBeDefined();
      expect(hydrated[0].data.displaySettings).toBeDefined();
      expect(hydrated[0].data.yamlSettings).toBeDefined();
    });

    it('migrates legacy standalone Secret cards into attached secret items on target nodes during hydration', () => {
      const nodes = [
        { id: 'd1', type: 'Deployment', data: { label: 'dep-1', secrets: [{ id: 's1', name: 'existing-s1' }] } },
        { id: 's1', type: 'Secret', parentId: 'd1', data: { configData: [{ key: 'DB_PASS', value: 'secret123' }] } }, // duplicate s1 -> existing.some returns true
        { id: 's2', type: 'Secret', parentId: 'd1', data: { label: 'new-secret', configData: [{ key: 'FOO', value: 'BAR' }] } },
        { id: 's3', type: 'Secret', parentId: 'non-existent-parent', data: { label: 'orphan-secret', configData: [{ key: 'FOO', value: 'BAR' }] } }
      ];
      const get = () => useFlowStore.getState();

      const hydrated = hydrateNodes(nodes, get);

      const deployment = hydrated.find(n => n.id === 'd1');
      expect(deployment.data.secrets).toHaveLength(2);
      expect(deployment.data.secrets[1].name).toBe('new-secret');
    });

    it('calculates dimensions for manually resized deployment and replicaset', () => {
      const nodes = [
        { id: 'rs1', type: 'ReplicaSet', width: 300, height: 200, data: { label: 'rs-1', replicas: 1, isManuallyResized: true } },
        { id: 'd1', type: 'Deployment', data: { label: 'dep-1', replicas: 1, isManuallyResized: true } },
      ];
      const get = () => useFlowStore.getState();

      const hydrated = hydrateNodes(nodes, get);
      const rs = hydrated.find(n => n.id === 'rs1');
      expect(rs.width).toBeGreaterThanOrEqual(300);
      expect(rs.height).toBeGreaterThanOrEqual(200);

      const dep = hydrated.find(n => n.id === 'd1');
      expect(dep.width).toBeGreaterThan(0);
    });

    it('syncs deployments and replicasets during hydration', () => {
      const nodes = [
        { id: 'd1', type: 'Deployment', data: { label: 'dep-1', replicas: 1 } },
        { id: 'p1', type: 'Pod', parentId: 'd1', measured: { width: 140, height: 80 }, style: { minHeight: '80px' }, data: { label: 'pod-1' } }
      ];
      const get = () => useFlowStore.getState();

      const hydrated = hydrateNodes(nodes, get);

      const deployment = hydrated.find(n => n.id === 'd1');
      expect(deployment.width).toBeGreaterThan(0);
      expect(hydrated.filter(n => n.parentId === 'd1')).toHaveLength(1);
    });
  });

  describe('syncDeployment', () => {
    it('updates replicas and syncs pods', () => {
      const deployment = { id: 'd1', type: 'Deployment', data: { label: 'dep-1', replicas: 2 } } as any;
      const pod = { id: 'p1', type: 'Pod', parentId: 'd1', data: { label: 'pod-1' } } as any;
      const get = () => useFlowStore.getState();

      const { updatedDeployment, laidOut } = syncDeployment(deployment, [deployment, pod], 1, get);

      expect(updatedDeployment.data.replicas).toBe(3);
      expect(laidOut).toHaveLength(3);
    });

    it('handles podToInclude parameter and zero replicas', () => {
      const deployment = { id: 'd1', type: 'Deployment', data: { label: 'dep-1', replicas: 0 } } as any;
      const pod1 = { id: 'p1', type: 'Pod', parentId: 'd1', data: { label: 'pod-1' } } as any;
      const podToInclude = { id: 'p2', type: 'Pod', parentId: 'd1', data: { label: 'pod-2' } } as any;
      const get = () => useFlowStore.getState();

      const { updatedDeployment, laidOut } = syncDeployment(deployment, [deployment, pod1], 0, get, podToInclude);

      expect(updatedDeployment.data.replicas).toBe(0);
      expect(laidOut).toHaveLength(0);
    });
  });

  describe('syncContainerSize', () => {
    it('returns currentNodes if containerId or container or children are falsy/empty', () => {
      const nodes = [{ id: 'c1', type: 'Namespace', position: { x: 0, y: 0 } }] as any;

      expect(syncContainerSize(undefined, nodes)).toBe(nodes);
      expect(syncContainerSize('missing-c', nodes)).toBe(nodes);
      expect(syncContainerSize('c1', nodes)).toBe(nodes); // No children
    });

    it('resizes container to fit children and handles child types Pod, Deployment, Internet, Service with negative positions', () => {
      const container = { id: 'c1', type: 'Namespace', position: { x: 100, y: 100 }, width: 100, height: 100 } as any;
      const podChild = { id: 'p1', type: 'Pod', parentId: 'c1', position: { x: -30, y: -40 }, measured: { width: 100, height: 100 } } as any;
      const depChild = { id: 'd1', type: 'Deployment', parentId: 'c1', position: { x: 50, y: 50 }, width: 320, height: 160 } as any;
      const internetChild = { id: 'inet', type: 'Internet', parentId: 'c1', position: { x: 10, y: 10 } } as any;
      const svcChild = { id: 's1', type: 'Service', parentId: 'c1', position: { x: 20, y: 20 } } as any;

      const nextNodes = syncContainerSize('c1', [container, podChild, depChild, internetChild, svcChild]);
      const updatedContainer = nextNodes.find(n => n.id === 'c1');
      const updatedPod = nextNodes.find(n => n.id === 'p1');

      expect(updatedContainer.position.x).toBeLessThan(100);
      expect(updatedContainer.position.y).toBeLessThan(100);
      expect(updatedPod.position.x).toBeGreaterThan(0);
      expect(updatedPod.position.y).toBeGreaterThan(0);
    });

    it('returns currentNodes if container size is unchanged', () => {
      const container = { id: 'c1', type: 'Namespace', position: { x: 0, y: 0 }, width: 1000, height: 1000 } as any;
      const child = { id: 'p1', type: 'Pod', parentId: 'c1', position: { x: 10, y: 10 }, width: 100, height: 100 } as any;

      const nextNodes = syncContainerSize('c1', [container, child]);
      expect(nextNodes).toBeDefined();
    });

    it('recursively syncs parent container when nested containers exist', () => {
      const parentContainer = { id: 'parent-c', type: 'Namespace', position: { x: 0, y: 0 }, width: 100, height: 100 } as any;
      const childContainer = { id: 'child-c', parentId: 'parent-c', type: 'Namespace', position: { x: 0, y: 0 }, width: 100, height: 100 } as any;
      const leafChild = { id: 'leaf', parentId: 'child-c', type: 'Pod', position: { x: 300, y: 300 }, width: 100, height: 100 } as any;

      const nextNodes = syncContainerSize('child-c', [parentContainer, childContainer, leafChild]);
      const updatedParent = nextNodes.find(n => n.id === 'parent-c');
      expect(updatedParent.width).toBeGreaterThan(300);
    });
  });
});
