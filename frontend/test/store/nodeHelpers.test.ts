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

    it('deletes nodes when onDelete is called', () => {
      const node = { id: 'node-1', type: 'Pod', data: {} } as any;
      useFlowStore.setState({ nodes: [node] });
      const deleteNodesSpy = vi.spyOn(useFlowStore.getState(), 'deleteNodes');

      const handlers = attachHandlers('node-1', () => useFlowStore.getState());
      handlers.onDelete();

      expect(deleteNodesSpy).toHaveBeenCalledWith([node]);
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

    it('syncs deployments and replicasets during hydration', () => {
        const nodes = [
            { id: 'd1', type: 'Deployment', data: { label: 'dep-1', replicas: 1 } },
            { id: 'p1', type: 'Pod', parentId: 'd1', data: { label: 'pod-1' } }
        ];
        const get = () => useFlowStore.getState();

        const hydrated = hydrateNodes(nodes, get);

        // Deployment should be updated and pods should be synced
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
      expect(laidOut).toHaveLength(3); // Should have created 3 pods
    });
  });

  describe('syncContainerSize', () => {
    it('resizes container to fit children', () => {
      const container = { id: 'c1', type: 'Namespace', position: { x: 0, y: 0 }, width: 100, height: 100 } as any;
      const child = { id: 'child1', type: 'Pod', parentId: 'c1', position: { x: 200, y: 200 }, width: 100, height: 100 } as any;

      const nextNodes = syncContainerSize('c1', [container, child]);
      const updatedContainer = nextNodes.find(n => n.id === 'c1');

      expect(updatedContainer.width).toBeGreaterThan(200);
      expect(updatedContainer.height).toBeGreaterThan(200);
    });

    it('shifts container and children if child is at negative position', () => {
        const container = { id: 'c1', type: 'Namespace', position: { x: 100, y: 100 }, width: 300, height: 300 } as any;
        const child = { id: 'child1', type: 'Pod', parentId: 'c1', position: { x: -50, y: -50 }, width: 100, height: 100 } as any;

        const nextNodes = syncContainerSize('c1', [container, child]);
        const updatedContainer = nextNodes.find(n => n.id === 'c1');
        const updatedChild = nextNodes.find(n => n.id === 'child1');

        expect(updatedContainer.position.x).toBeLessThan(100);
        expect(updatedChild.position.x).toBeGreaterThanOrEqual(0);
    });
  });
});
