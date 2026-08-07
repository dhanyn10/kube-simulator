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

  it('renders nothing when no guides or dragged node are present', () => {
    const { container } = render(<AlignmentGuides />);
    const innerDivs = container.querySelectorAll('div[style*="position: absolute"] > div');
    expect(innerDivs).toHaveLength(0);
  });

  it('renders alignment guides when a node is being dragged', () => {
    useFlowStore.setState({
      draggedNodeId: 'node-1',
      alignmentGuides: {
        vertical: [{ position: 100, type: 'center' }],
        horizontal: [{ position: 200, type: 'edge' }],
      }
    });

    const { container } = render(<AlignmentGuides />);
    const innerDivs = container.querySelectorAll('div[style*="position: absolute"] > div');
    expect(innerDivs).toHaveLength(2); // 1 vertical and 1 horizontal flat Draw.io dashed guidelines
  });

  it('does not render snap guides anymore', () => {
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
    // Expecting 0 elements because snap guides rendering is removed for Draw.io-exact styling
    expect(innerDivs).toHaveLength(0);
  });
});
