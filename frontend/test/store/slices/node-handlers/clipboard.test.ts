import { describe, it, expect, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { useFlowStore } from '@/store/useFlowStore';

describe('Clipboard Handlers (Pod Copy-Paste Replicas)', () => {
  beforeEach(() => {
    // Reset store before each test
    useFlowStore.setState({
      nodes: [],
      edges: [],
      clipboard: null,
      lastActionId: 'init'
    });
    
    // Ensure crypto is available for ID generation and random values (Node/JSDOM)
    if (!global.crypto) (global as any).crypto = webcrypto;
  });

  it('increments Deployment replicas when a child Pod is copy-pasted', () => {
    const { addNode, updateNodeData, copyNodes, pasteNodes } = useFlowStore.getState();

    // 1. Create a Deployment
    addNode('Deployment', { x: 0, y: 0 });
    let nodes = useFlowStore.getState().nodes;
    const deployment = nodes.find(n => n.type === 'Deployment')!;
    
    // 2. Set replicas to 1 so it spawns a Pod
    updateNodeData(deployment.id, { replicas: 1 });
    nodes = useFlowStore.getState().nodes;
    const pod = nodes.find(n => n.type === 'Pod' && n.parentId === deployment.id)!;
    
    expect(pod).toBeDefined();
    expect(useFlowStore.getState().nodes.filter(n => n.type === 'Pod')).toHaveLength(1);

    // 3. Select the Pod and Copy it
    useFlowStore.setState({
      nodes: useFlowStore.getState().nodes.map(n => n.id === pod.id ? { ...n, selected: true } : n)
    });
    copyNodes();
    
    expect(useFlowStore.getState().clipboard?.nodes[0].id).toBe(pod.id);

    // 4. Paste it (While it's still selected)
    pasteNodes();

    // 5. Verify: Deployment replicas should be 2, and there should be 2 Pod nodes
    const updatedNodes = useFlowStore.getState().nodes;
    const updatedDeployment = updatedNodes.find(n => n.id === deployment.id)!;
    const podCount = updatedNodes.filter(n => n.type === 'Pod' && n.parentId === deployment.id).length;

    expect(updatedDeployment.data.replicas).toBe(2);
    expect(podCount).toBe(2);
    // Ensure NO extra independent Pod nodes were created
    expect(updatedNodes.filter(n => n.type === 'Pod')).toHaveLength(2);
  });

  it('transforms standalone Pod into ReplicaSet and increments replicas on copy-paste', () => {
    const { addNode, copyNodes, pasteNodes } = useFlowStore.getState();

    // 1. Create a standalone Pod
    addNode('Pod', { x: 0, y: 0 });
    let nodes = useFlowStore.getState().nodes;
    const pod = nodes.find(n => n.type === 'Pod' && !n.parentId)!;
    
    expect(pod.data.replicas).toBe(1);

    // 2. Select the Pod and Copy it
    useFlowStore.setState({
      nodes: useFlowStore.getState().nodes.map(n => n.id === pod.id ? { ...n, selected: true } : n)
    });
    copyNodes();

    // 3. Paste it (While it's still selected)
    pasteNodes();

    // 4. Verify: Pod should have transformed into a ReplicaSet
    const finalNodes = useFlowStore.getState().nodes;
    const group = finalNodes.find(n => n.type === 'ReplicaSet')!;
    const childPods = finalNodes.filter(n => n.type === 'Pod' && n.parentId === group.id);

    expect(group).toBeDefined();
    expect(group.data.replicas).toBe(2);
    expect(childPods).toHaveLength(2); // Should have 2 visual cards because threshold is now 1
  });

  it('creates a new node if pasted while no node is selected', () => {
    const { addNode, copyNodes, pasteNodes } = useFlowStore.getState();

    // 1. Create a Pod
    addNode('Pod', { x: 0, y: 0 });
    let nodes = useFlowStore.getState().nodes;
    const pod = nodes.find(n => n.type === 'Pod')!;

    // 2. Select and Copy
    useFlowStore.setState({
      nodes: useFlowStore.getState().nodes.map(n => n.id === pod.id ? { ...n, selected: true } : n)
    });
    copyNodes();

    // 3. DESELECT everything
    useFlowStore.setState({
      nodes: useFlowStore.getState().nodes.map(n => ({ ...n, selected: false }))
    });

    // 4. Paste
    pasteNodes();

    // 5. Verify: A second independent Pod should exist (total 2 independent nodes)
    const finalNodes = useFlowStore.getState().nodes;
    const standalonePods = finalNodes.filter(n => n.type === 'Pod' && !n.parentId);
    
    expect(standalonePods).toHaveLength(2);
    expect(finalNodes.find(n => n.type === 'ReplicaSet')).toBeUndefined();
  });

  it('increments ReplicaSet replicas when a child Pod in ReplicaSet is copy-pasted', () => {
    const { addNode, copyNodes, pasteNodes } = useFlowStore.getState();

    // 1. Create a standalone Pod
    addNode('Pod', { x: 0, y: 0 });
    let nodes = useFlowStore.getState().nodes;
    const pod = nodes.find(n => n.type === 'Pod' && !n.parentId)!;

    // 2. Select the Pod and copy-paste it to transform into a ReplicaSet
    useFlowStore.setState({
      nodes: useFlowStore.getState().nodes.map(n => n.id === pod.id ? { ...n, selected: true } : n)
    });
    copyNodes();
    pasteNodes();

    // 3. Verify it is now a ReplicaSet with 2 replicas
    let currentNodes = useFlowStore.getState().nodes;
    const replicaSet = currentNodes.find(n => n.type === 'ReplicaSet')!;
    expect(replicaSet.data.replicas).toBe(2);

    // 4. Select one of the child Pods inside the ReplicaSet
    const childPod = currentNodes.find(n => n.type === 'Pod' && n.parentId === replicaSet.id)!;
    useFlowStore.setState({
      nodes: useFlowStore.getState().nodes.map(n => n.id === childPod.id ? { ...n, selected: true } : { ...n, selected: false })
    });

    // 5. Copy and paste again!
    copyNodes();
    pasteNodes();

    // 6. Verify: ReplicaSet replicas should now be 3, and there should be 3 Pod nodes
    const finalNodes = useFlowStore.getState().nodes;
    const finalReplicaSet = finalNodes.find(n => n.type === 'ReplicaSet')!;
    const podCount = finalNodes.filter(n => n.type === 'Pod' && n.parentId === finalReplicaSet.id).length;

    expect(finalReplicaSet.data.replicas).toBe(3);
    expect(podCount).toBe(3);
  });

  it('correctly scales ReplicaSet replicas up to 1000 via updateNodeData', () => {
    const { addNode, updateNodeData } = useFlowStore.getState();

    // 1. Create a standalone Pod
    addNode('Pod', { x: 0, y: 0 });
    let nodes = useFlowStore.getState().nodes;
    const pod = nodes.find(n => n.type === 'Pod' && !n.parentId)!;

    // 2. Scale standalone Pod to 5 replicas
    updateNodeData(pod.id, { replicas: 5 });

    // 3. Verify it transformed into a ReplicaSet with 5 replicas
    let currentNodes = useFlowStore.getState().nodes;
    const replicaSet = currentNodes.find(n => n.type === 'ReplicaSet')!;
    expect(replicaSet).toBeDefined();
    expect(replicaSet.data.replicas).toBe(5);

    // 4. Update the replica count of the ReplicaSet to 1000
    updateNodeData(replicaSet.id, { replicas: 1000 });

    // 5. Verify: ReplicaSet has 1000 replicas
    const finalNodes = useFlowStore.getState().nodes;
    const finalReplicaSet = finalNodes.find(n => n.type === 'ReplicaSet')!;
    expect(finalReplicaSet.data.replicas).toBe(1000);
  });

  it('correctly updates replicas when updating through the Pod configuration logic', () => {
    const { addNode, updateNodeData } = useFlowStore.getState();

    // 1. Create a standalone Pod
    addNode('Pod', { x: 0, y: 0 });
    let nodes = useFlowStore.getState().nodes;
    const pod = nodes.find(n => n.type === 'Pod' && !n.parentId)!;

    // 2. Simulating Pod Configuration sidebar: user increases replica of standalone Pod to 2.
    // The target ID for standalone Pod (no parentId) is the Pod's ID.
    updateNodeData(pod.id, { replicas: 2 });

    // 3. Verify it is now a ReplicaSet with 2 replicas
    let currentNodes = useFlowStore.getState().nodes;
    const replicaSet = currentNodes.find(n => n.type === 'ReplicaSet')!;
    expect(replicaSet).toBeDefined();
    expect(replicaSet.data.replicas).toBe(2);

    // 4. Now, the user selects one of the child Pods in the ReplicaSet.
    // We simulate the Sidebar logic (getUpdateReplicasTargetId):
    const childPod = currentNodes.find(n => n.type === 'Pod' && n.parentId === replicaSet.id)!;
    const parent = currentNodes.find(n => n.id === childPod.parentId)!;
    
    // Ensure that it is correctly recognized as a controller (ReplicaSet)
    const isController = parent.type === 'Deployment' || parent.type === 'ReplicaSet' || parent.type === 'PodGroup';
    expect(isController).toBe(true);

    const targetId = isController ? childPod.parentId! : childPod.id;
    expect(targetId).toBe(replicaSet.id); // Must target the ReplicaSet ID!

    // 5. The UI calls updateNodeData with the ReplicaSet ID and the new replica count (e.g., 3)
    updateNodeData(targetId, { replicas: 3 });

    // 6. Verify: ReplicaSet replicas is now 3, and there are 3 Pods
    const finalNodes = useFlowStore.getState().nodes;
    const finalReplicaSet = finalNodes.find(n => n.type === 'ReplicaSet')!;
    const podCount = finalNodes.filter(n => n.type === 'Pod' && n.parentId === finalReplicaSet.id).length;

    expect(finalReplicaSet.data.replicas).toBe(3);
    expect(podCount).toBe(3);
  });

  it('copies child Pods when a Deployment is selected', () => {
    const { addNode, updateNodeData, copyNodes } = useFlowStore.getState();

    // 1. Create a Deployment
    addNode('Deployment', { x: 0, y: 0 });
    let nodes = useFlowStore.getState().nodes;
    const deployment = nodes.find(n => n.type === 'Deployment')!;

    // 2. Add a child Pod
    updateNodeData(deployment.id, { replicas: 1 });
    nodes = useFlowStore.getState().nodes;
    const pod = nodes.find(n => n.type === 'Pod' && n.parentId === deployment.id)!;

    // 3. Select ONLY the Deployment
    useFlowStore.setState({
      nodes: useFlowStore.getState().nodes.map(n => n.id === deployment.id ? { ...n, selected: true } : { ...n, selected: false })
    });

    // 4. Copy
    copyNodes();

    // 5. Verify: Clipboard should contain BOTH the Deployment and the Pod
    const clipboard = useFlowStore.getState().clipboard;
    expect(clipboard?.nodes.length).toBe(2);
    expect(clipboard?.nodes.find(n => n.id === deployment.id)).toBeDefined();
    expect(clipboard?.nodes.find(n => n.id === pod.id)).toBeDefined();
  });

  it('pastes nodes and edges correctly', () => {
    const { addNode, onConnect, copyNodes, pasteNodes } = useFlowStore.getState();

    // 1. Create two nodes and an edge
    addNode('Internet', { x: 0, y: 0 });
    addNode('Service', { x: 100, y: 0 });
    let nodes = useFlowStore.getState().nodes;
    const n1 = nodes[0];
    const n2 = nodes[1];

    onConnect({ source: n1.id, target: n2.id, sourceHandle: "a", targetHandle: "b" });

    // 2. Select both nodes
    useFlowStore.setState({
      nodes: useFlowStore.getState().nodes.map(n => ({ ...n, selected: true }))
    });

    // 3. Copy
    copyNodes();

    // 4. Paste
    pasteNodes();

    // 5. Verify: New edge should be created
    const finalEdges = useFlowStore.getState().edges;
    expect(finalEdges).toHaveLength(2);
    expect(finalEdges.filter(e => e.selected)).toHaveLength(1);
  });

  it('handles paste when clipboard is empty', () => {
    const { pasteNodes } = useFlowStore.getState();
    useFlowStore.setState({ clipboard: null });
    pasteNodes();
    expect(useFlowStore.getState().nodes).toHaveLength(0);

    useFlowStore.setState({ clipboard: { nodes: [], edges: [] } });
    pasteNodes();
    expect(useFlowStore.getState().nodes).toHaveLength(0);
  });

  it('tryIncrementPodReplicas returns false when pod labels do not match', () => {
    const { addNode, copyNodes, pasteNodes, updateNodeData } = useFlowStore.getState();

    // 1. Create Pod A and Copy it
    addNode('Pod', { x: 0, y: 0 });
    let nodes = useFlowStore.getState().nodes;
    const podA = nodes[0];
    updateNodeData(podA.id, { label: 'pod-a' });

    useFlowStore.setState({ nodes: useFlowStore.getState().nodes.map(n => ({ ...n, selected: true })) });
    copyNodes();

    // 2. Create Pod B and Select it (Deselect A)
    addNode('Pod', { x: 100, y: 100 });
    nodes = useFlowStore.getState().nodes;
    const podB = nodes.find(n => n.id !== podA.id)!;
    updateNodeData(podB.id, { label: 'pod-b' });

    useFlowStore.setState({
      nodes: useFlowStore.getState().nodes.map(n => ({ ...n, selected: n.id === podB.id }))
    });

    // 3. Paste. should NOT increment Pod B, but add a new copy of Pod A
    pasteNodes();

    const finalNodes = useFlowStore.getState().nodes;
    // Pod A, Pod B, and new Copy of Pod A = 3 nodes
    expect(finalNodes).toHaveLength(3);
    expect(finalNodes.filter(n => n.type === 'Pod')).toHaveLength(3);

    // Verify Pod B replicas remained 1
    const finalPodB = finalNodes.find(n => n.id === podB.id)!;
    expect(finalPodB.data.replicas).toBe(1);
  });
});

