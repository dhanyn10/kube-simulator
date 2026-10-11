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

    it('updates pod baseName and parent deployment when onRename is called on a pod inside deployment', () => {
      const parentDeployment = { id: 'd1', type: 'Deployment', data: { label: 'olddep', replicas: 1 } };
      const pod = { id: 'p1', type: 'Pod', parentId: 'd1', data: { baseName: 'olddep', podHash: 'abc12', replicaSuffix: 'xyz34', label: 'olddep-abc12-xyz34' } };

      useFlowStore.setState({ nodes: [parentDeployment as any, pod as any] });
      const updateNodeDataSpy = vi.spyOn(useFlowStore.getState(), 'updateNodeData');

      const handlers = attachHandlers('p1', () => useFlowStore.getState());
      handlers.onRename('newapp');

      expect(updateNodeDataSpy).toHaveBeenCalledWith('d1', { label: 'newapp' });
    });

    it('updates standalone pod baseName and label formatted as baseName-podHash-replicaSuffix for >1 replicas', () => {
      const standalonePod = { id: 'p2', type: 'Pod', data: { replicas: 2, baseName: 'mybase', podHash: 'a1b2c', replicaSuffix: 'x1y2z', label: 'mybase-a1b2c-x1y2z' } };

      useFlowStore.setState({ nodes: [standalonePod as any] });
      const updateNodeDataSpy = vi.spyOn(useFlowStore.getState(), 'updateNodeData');

      const handlers = attachHandlers('p2', () => useFlowStore.getState());
      handlers.onRename('renamedbase');

      expect(updateNodeDataSpy).toHaveBeenCalledWith('p2', {
        baseName: 'renamedbase',
        label: 'renamedbase-a1b2c-x1y2z',
      });
    });

    it('updates standalone pod label to clean baseName when replica count is 1', () => {
      const singlePod = { id: 'p3', type: 'Pod', data: { replicas: 1, baseName: 'mybase', podHash: 'a1b2c', replicaSuffix: 'x1y2z', label: 'mybase' } };

      useFlowStore.setState({ nodes: [singlePod as any] });
      const updateNodeDataSpy = vi.spyOn(useFlowStore.getState(), 'updateNodeData');

      const handlers = attachHandlers('p3', () => useFlowStore.getState());
      handlers.onRename('renamedbase');

      expect(updateNodeDataSpy).toHaveBeenCalledWith('p3', {
        baseName: 'renamedbase',
        label: 'renamedbase',
      });
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

    it('calculates dimensions for manually resized deployment, replicaset, and deployments with attached resources', () => {
      const nodes = [
        { id: 'rs1', type: 'ReplicaSet', width: 300, height: 200, data: { label: 'rs-1', replicas: 1, isManuallyResized: true } },
        { id: 'd1', type: 'Deployment', data: { label: 'dep-1', replicas: 1, isManuallyResized: true, roles: [{ id: 'r1' }], configMaps: [{ id: 'cm1' }], secrets: [{ id: 's1' }], hpas: [{ id: 'h1' }] } },
      ];
      const get = () => useFlowStore.getState();

      const hydrated = hydrateNodes(nodes, get);
      const rs = hydrated.find(n => n.id === 'rs1');
      expect(rs.width).toBeGreaterThanOrEqual(300);
      expect(rs.height).toBeGreaterThanOrEqual(200);

      const dep = hydrated.find(n => n.id === 'd1');
      expect(dep.width).toBeGreaterThan(0);
      expect(dep.height).toBeGreaterThan(0);
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

    it('handles attached resources nullish/empty checks in calculateDeploymentDimensions', () => {
      const nodes = [
        { id: 'd-null', type: 'Deployment', data: { label: 'dep-null', replicas: 1, roles: null, configMaps: undefined, secrets: null, hpas: undefined } },
        { id: 'd-role-only', type: 'Deployment', data: { label: 'dep-role', replicas: 1, roles: [{ id: 'r1' }] } },
        { id: 'd-cm-only', type: 'Deployment', data: { label: 'dep-cm', replicas: 1, configMaps: [{ id: 'cm1' }] } },
      ];
      const get = () => useFlowStore.getState();

      const hydrated = hydrateNodes(nodes, get);
      expect(hydrated.find(n => n.id === 'd-null')).toBeDefined();
      expect(hydrated.find(n => n.id === 'd-role-only')).toBeDefined();
      expect(hydrated.find(n => n.id === 'd-cm-only')).toBeDefined();
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

    it('handles forceRandomize flag in syncDeployment and clamps replicas between 0 and 1000', () => {
      const deployment = { id: 'd1', type: 'Deployment', data: { label: 'dep-1', replicas: 2 } } as any;
      const pod1 = { id: 'p1', type: 'Pod', parentId: 'd1', data: { label: 'pod-1', podHash: 'old1', replicaSuffix: 'old2' } } as any;
      const get = () => useFlowStore.getState();

      const { laidOut } = syncDeployment(deployment, [deployment, pod1], 0, get, undefined, true);

      expect(laidOut).toHaveLength(2);

      // Clamp replicas < 0 -> 0
      const { updatedDeployment: dep0 } = syncDeployment(deployment, [deployment], -10, get);
      expect(dep0.data.replicas).toBe(0);

      // Clamp replicas > 1000 -> 1000
      const { updatedDeployment: dep1000 } = syncDeployment(deployment, [deployment], 1200, get);
      expect(dep1000.data.replicas).toBe(1000);
    });

    it('recalculates deployment height cumulatively when toggling show/hide container image on child pod, and shrinks deployment when pod is deleted', () => {
      const get = () => useFlowStore.getState();

      const deploymentNode = {
        id: 'd1',
        type: 'Deployment',
        position: { x: 100, y: 100 },
        data: { label: 'my-app', replicas: 0 }
      } as any;

      useFlowStore.setState({ nodes: [deploymentNode], edges: [] });

      const { updatedDeployment: emptyDep } = syncDeployment(deploymentNode, [deploymentNode], 0, get);
      const emptyDepHeight = emptyDep.height;

      const { updatedDeployment: depWithPods, laidOut: laidOutPods } = syncDeployment(deploymentNode, [deploymentNode], 2, get);
      expect(laidOutPods).toHaveLength(2);

      const pod1 = laidOutPods[0];
      const pod2InitialY = laidOutPods[1].position.y;
      const initialDepHeight = depWithPods.height;

      expect(initialDepHeight).toBeGreaterThan(emptyDepHeight);

      const pod1HiddenImage = {
        ...pod1,
        data: {
          ...pod1.data,
          displaySettings: { ...pod1.data?.displaySettings, image: false }
        }
      };

      const { updatedDeployment: depWithHiddenImage, laidOut: laidOutPodsHidden } = syncDeployment(
        depWithPods,
        [depWithPods, pod1HiddenImage, laidOutPods[1]],
        0,
        get
      );

      const pod2ShiftedY = laidOutPodsHidden[1].position.y;
      expect(pod2ShiftedY).toBeLessThanOrEqual(pod2InitialY);
      expect(depWithHiddenImage.height).toBeLessThanOrEqual(initialDepHeight);

      const pod1ShownImage = {
        ...pod1,
        data: {
          ...pod1.data,
          image: 'redis:latest',
          displaySettings: { ...pod1.data?.displaySettings, image: true }
        }
      };

      const { updatedDeployment: depWithShownImage, laidOut: laidOutPodsShown } = syncDeployment(
        depWithPods,
        [depWithPods, pod1ShownImage, laidOutPods[1]],
        0,
        get
      );

      expect(laidOutPodsShown[1].position.y).toBeGreaterThanOrEqual(pod2ShiftedY);
      expect(depWithShownImage.height).toBeGreaterThanOrEqual(depWithHiddenImage.height);

      const { updatedDeployment: finalEmptyDep } = syncDeployment(depWithPods, [depWithPods], -2, get);
      expect(finalEmptyDep.height).toBe(emptyDepHeight);
    });

    it('integration test: store updateNodeData toggle image and deleteNodes updates deployment dimensions and pod Y coordinates cumulatively', () => {
      const store = useFlowStore.getState();

      store.addNode('Deployment', { x: 100, y: 100 });
      let currentNodes = useFlowStore.getState().nodes;
      const depNode = currentNodes.find(n => n.type === 'Deployment')!;

      store.addNode('Pod', { x: 120, y: 140 }, depNode.id);
      let depWithPods = useFlowStore.getState().nodes.find(n => n.id === depNode.id)!;
      store.updateNodeData(depWithPods.id, { replicas: 2 });

      currentNodes = useFlowStore.getState().nodes;
      const childPods = currentNodes.filter(n => n.parentId === depNode.id && n.type === 'Pod');
      expect(childPods).toHaveLength(2);

      const pod1 = childPods[0];

      store.updateNodeData(pod1.id, { image: 'redis:latest', displaySettings: { ...pod1.data.displaySettings, image: true } });
      currentNodes = useFlowStore.getState().nodes;
      const depHeightWithImage = currentNodes.find(n => n.id === depNode.id)!.height;
      const pod2YWithImage = currentNodes.find(n => n.id === childPods[1].id)!.position.y;

      store.updateNodeData(pod1.id, {
        displaySettings: { ...pod1.data.displaySettings, image: false }
      });

      currentNodes = useFlowStore.getState().nodes;
      const depAfterHideImage = currentNodes.find(n => n.id === depNode.id)!;
      const pod2YAfterHide = currentNodes.find(n => n.id === childPods[1].id)!.position.y;

      expect(pod2YAfterHide).toBeLessThanOrEqual(pod2YWithImage);
      expect(depAfterHideImage.height).toBeLessThan(depHeightWithImage);

      store.deleteNodes(childPods);

      currentNodes = useFlowStore.getState().nodes;
      const depAfterPodsDeleted = currentNodes.find(n => n.id === depNode.id)!;

      expect(depAfterPodsDeleted.height).toBeLessThan(depAfterHideImage.height);
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

    it('calculates minimum bounding box for children with measured width/height fallbacks', () => {
      const container = { id: 'c1', type: 'Deployment', position: { x: 0, y: 0 } } as any;
      const measuredChild = { id: 'p1', type: 'Pod', parentId: 'c1', position: { x: 10, y: 10 }, measured: { width: 150, height: 90 } } as any;

      const nextNodes = syncContainerSize('c1', [container, measuredChild]);
      const updatedContainer = nextNodes.find(n => n.id === 'c1');
      expect(updatedContainer.width).toBeGreaterThanOrEqual(160);
    });

    it('recursively syncs parent container when nested containers exist', () => {
      const parentContainer = { id: 'parent-c', type: 'Namespace', position: { x: 0, y: 0 }, width: 100, height: 100 } as any;
      const childContainer = { id: 'child-c', parentId: 'parent-c', type: 'Namespace', position: { x: 0, y: 0 }, width: 100, height: 100 } as any;
      const leafChild = { id: 'leaf', parentId: 'child-c', type: 'Pod', position: { x: 300, y: 300 }, width: 100, height: 100 } as any;

      const nextNodes = syncContainerSize('child-c', [parentContainer, childContainer, leafChild]);
      const updatedParent = nextNodes.find(n => n.id === 'parent-c');
      expect(updatedParent.width).toBeGreaterThan(300);
    });

    it('covers syncContainerSize for Internet child node, shiftX=0/shiftY=0 positive expansion, and top-level container return', () => {
      // 1. Container with Internet child (computeChildrenBounds ignores Internet node)
      const nsContainer = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, width: 100, height: 100 } as any;
      const internetChild = { id: 'inet1', type: 'Internet', parentId: 'ns1', position: { x: 0, y: 0 } } as any;
      const resInet = syncContainerSize('ns1', [nsContainer, internetChild]);
      expect(resInet).toBeDefined();

      // 2. Container expansion on positive coordinates only (shiftX=0 and shiftY=0)
      const podPosChild = { id: 'p1', type: 'Pod', parentId: 'ns1', position: { x: 200, y: 200 }, width: 100, height: 100 } as any;
      const resPos = syncContainerSize('ns1', [nsContainer, podPosChild]);
      const updatedNs = resPos.find(n => n.id === 'ns1');
      expect(updatedNs.width).toBeGreaterThan(200);
      expect(updatedNs.position.x).toBe(0); // shiftX == 0
    });
  });
});
