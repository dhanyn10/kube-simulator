import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';

describe('dragHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [
        { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod' } },
        { id: 'd1', type: 'Deployment', position: { x: 100, y: 100 }, width: 320, height: 160, data: { label: 'dep' } }
      ] as any,
      edges: [],
      snapGuides: { vertical: [], horizontal: [] }
    });
  });

  it('onNodeDragStart updates store', () => {
    const node = useFlowStore.getState().nodes[0];
    const { onNodeDragStart } = useFlowStore.getState();

    onNodeDragStart({} as any, node);

    const state = useFlowStore.getState();
    expect(state.draggedNodeId).toBe('n1');
  });

  it('onNodeDrag updates hover state', () => {
    const node = { ...useFlowStore.getState().nodes[0], position: { x: 110, y: 110 } };
    const { onNodeDrag } = useFlowStore.getState();

    onNodeDrag({} as any, node);

    const state = useFlowStore.getState();
    expect(state.hoveredDeploymentId).toBe('d1');
    expect(state.nodes.find(n => n.id === 'd1')?.data.isHovered).toBe(true);
  });

  it('onNodeDragStop handles parenting', () => {
    // Setup state as if dragging over d1
    useFlowStore.setState({ hoveredDeploymentId: 'd1' });
    const node = { ...useFlowStore.getState().nodes[0], position: { x: 110, y: 110 } };
    const { onNodeDragStop } = useFlowStore.getState();

    onNodeDragStop({} as any, node);

    const state = useFlowStore.getState();
    const updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.parentId).toBe('d1');
    expect(state.lastActionName).toBe('Move Element');
  });
});
