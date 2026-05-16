import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFlowStore } from '@/store/useFlowStore';

describe('Clipboard Handlers (Pod Copy-Paste Replicas)', () => {
  beforeEach(() => {
    // Reset store before each test
    const state = useFlowStore.getState();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      clipboard: null,
      lastActionId: 'init'
    });
    
    // Mock crypto.randomUUID for consistent IDs if needed
    if (!global.crypto) {
      (global as any).crypto = {
        randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 9)
      };
    }
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
    expect(useFlowStore.getState().nodes.filter(n => n.type === 'Pod').length).toBe(1);

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
    expect(updatedNodes.filter(n => n.type === 'Pod').length).toBe(2);
  });

  it('transforms standalone Pod into PodGroup and increments replicas on copy-paste', () => {
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

    // 4. Verify: Pod should have transformed into a PodGroup
    const finalNodes = useFlowStore.getState().nodes;
    const group = finalNodes.find(n => n.type === 'PodGroup')!;
    const childPods = finalNodes.filter(n => n.type === 'Pod' && n.parentId === group.id);

    expect(group).toBeDefined();
    expect(group.data.replicas).toBe(2);
    expect(childPods.length).toBe(2); // Should have 2 visual cards because threshold is now 1
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
    
    expect(standalonePods.length).toBe(2);
    expect(finalNodes.find(n => n.type === 'PodGroup')).toBeUndefined();
  });
});
