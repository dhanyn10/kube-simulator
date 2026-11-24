import { describe, it, expect, beforeEach } from 'vitest';
import { useFlowStore } from '@/store/useFlowStore';

describe('Frontend Undo/Redo (zundo) Workflow Integration Tests', () => {
  beforeEach(() => {
    useFlowStore.setState({ nodes: [], edges: [] });
  });

  it('undoes and redoes node additions and deletions consistently', () => {
    const store = useFlowStore.getState();

    // 1. Add Pod and Service
    store.addNode('Pod', { x: 100, y: 100 });
    store.addNode('Service', { x: 300, y: 100 });
    expect(useFlowStore.getState().nodes).toHaveLength(2);

    // 2. Undo last addition (Service)
    useFlowStore.getState().undo();
    expect(useFlowStore.getState().nodes).toHaveLength(1);
    expect(useFlowStore.getState().nodes[0].type).toBe('Pod');

    // 3. Redo addition (Service)
    useFlowStore.getState().redo();
    expect(useFlowStore.getState().nodes).toHaveLength(2);

    // 4. Delete Pod node and undo deletion
    const podId = useFlowStore.getState().nodes[0].id;
    useFlowStore.getState().deleteNode(podId);
    expect(useFlowStore.getState().nodes).toHaveLength(1);

    useFlowStore.getState().undo();
    expect(useFlowStore.getState().nodes).toHaveLength(2);
  });
});
