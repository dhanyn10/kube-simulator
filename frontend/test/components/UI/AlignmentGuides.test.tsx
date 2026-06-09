import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AlignmentGuides } from '@/components/UI/AlignmentGuides';
import { useFlowStore } from '@/store';

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  }),
}));

describe('AlignmentGuides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      alignmentGuides: { vertical: [], horizontal: [] },
      snapGuides: { vertical: [], horizontal: [] },
      draggedNodeId: null,
      nodes: [],
    });
  });

  it('renders nothing when no guides are present', () => {
    const { container } = render(<AlignmentGuides />);
    // There's one extra div if draggedNode is undefined (fragment)
    const innerDivs = container.querySelectorAll('div[style*="position: absolute"] > div');
    expect(innerDivs.length).toBe(0);
  });

  it('renders alignment guides', () => {
    useFlowStore.setState({
      alignmentGuides: {
        vertical: [{ position: 100, minY: 0, maxY: 500, type: 'center' }],
        horizontal: [{ position: 200, minX: 0, maxX: 500, type: 'edge' }],
      }
    });

    const { container } = render(<AlignmentGuides />);
    const innerDivs = container.querySelectorAll('div[style*="position: absolute"] > div');
    expect(innerDivs.length).toBe(3); // 1 vertical + 1 dot + 1 horizontal
  });

  it('renders snap guides when a node is being dragged', () => {
    const node = { id: 'n1', position: { x: 100, y: 100 }, width: 100, height: 100 };
    useFlowStore.setState({
      draggedNodeId: 'n1',
      nodes: [node as any],
      snapGuides: {
        vertical: [{ position: 150, isActive: true }],
        horizontal: [{ position: 150, isActive: true }],
      }
    });

    const { container } = render(<AlignmentGuides />);
    const innerDivs = container.querySelectorAll('div[style*="position: absolute"] > div');
    // Snap guides are blue indicators
    expect(innerDivs.length).toBe(2);
  });
});
