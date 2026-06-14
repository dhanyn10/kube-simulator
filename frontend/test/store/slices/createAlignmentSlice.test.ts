import { describe, it, expect, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';

describe('createAlignmentSlice', () => {
  beforeEach(() => {
    useFlowStore.setState({
      alignmentGuides: { vertical: [], horizontal: [] },
      snapGuides: { vertical: [], horizontal: [] },
      draggedNodeId: null
    });
  });

  it('sets and clears alignment guides', () => {
    const guides = {
      vertical: [{ x: 100, color: 'blue' }],
      horizontal: [{ y: 200, color: 'red' }]
    } as any;

    useFlowStore.getState().setAlignmentGuides(guides);
    expect(useFlowStore.getState().alignmentGuides).toEqual(guides);

    useFlowStore.getState().clearAlignmentGuides();
    expect(useFlowStore.getState().alignmentGuides).toEqual({ vertical: [], horizontal: [] });
  });

  it('sets and clears snap guides', () => {
    const guides = {
      vertical: [{ x: 10, sourceX: 0, targetX: 10 }],
      horizontal: [{ y: 20, sourceY: 0, targetY: 20 }]
    } as any;

    useFlowStore.getState().setSnapGuides(guides);
    expect(useFlowStore.getState().snapGuides).toEqual(guides);

    useFlowStore.getState().clearSnapGuides();
    expect(useFlowStore.getState().snapGuides).toEqual({ vertical: [], horizontal: [] });
  });

  it('sets dragged node id', () => {
    useFlowStore.getState().setDraggedNodeId('node-1');
    expect(useFlowStore.getState().draggedNodeId).toBe('node-1');

    useFlowStore.getState().setDraggedNodeId(null);
    expect(useFlowStore.getState().draggedNodeId).toBeNull();
  });
});
