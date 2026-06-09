import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CustomEdge from '@/components/Edges/CustomEdge';
import { useFlowStore } from '@/store';

// Mock React Flow
const mockSetEdges = vi.fn();
vi.mock('@xyflow/react', () => ({
  BaseEdge: ({ style, className }: any) => <div data-testid="base-edge" style={style} className={className} />,
  EdgeLabelRenderer: ({ children }: any) => <div data-testid="edge-label-renderer">{children}</div>,
  getBezierPath: () => ['M0 0L100 100', 50, 50],
  useReactFlow: () => ({
    setEdges: mockSetEdges,
  }),
}));

describe('CustomEdge', () => {
  const defaultProps: any = {
    id: 'e1',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: 'right',
    targetPosition: 'left',
    data: {},
    target: 'n2',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      activeSimulationEdges: [],
      configuringEdgeId: null,
      nodes: [],
      edges: [],
      globalEdgeColor: '#3b82f6',
      globalEdgeErrorColor: '#ef4444',
    });
  });

  it('renders correctly', () => {
    render(<CustomEdge {...defaultProps} />);
    expect(screen.getByTestId('base-edge')).toBeDefined();
  });

  it('shows action buttons when selected', () => {
    render(<CustomEdge {...defaultProps} selected={true} />);
    expect(screen.getByTitle('Settings')).toBeDefined();
    expect(screen.getByTitle('Remove')).toBeDefined();
  });

  it('calls setEdges when remove is clicked', () => {
    render(<CustomEdge {...defaultProps} selected={true} />);
    fireEvent.click(screen.getByTitle('Remove'));

    // setEdges is called with a function that filters edges
    expect(mockSetEdges).toHaveBeenCalled();
    const updateFn = mockSetEdges.mock.calls[0][0];
    const edges = [{ id: 'e1' }, { id: 'e2' }];
    expect(updateFn(edges)).toEqual([{ id: 'e2' }]);
  });

  it('calls toggleEdgeSettings when settings is clicked', () => {
    const toggleEdgeSettingsSpy = vi.spyOn(useFlowStore.getState(), 'toggleEdgeSettings');
    render(<CustomEdge {...defaultProps} selected={true} />);

    fireEvent.click(screen.getByTitle('Settings'));
    expect(toggleEdgeSettingsSpy).toHaveBeenCalledWith('e1');
  });

  it('shows validation error badge if present', () => {
    const props = { ...defaultProps, data: { validationError: 'Invalid connection' } };
    render(<CustomEdge {...props} />);
    expect(screen.getByText('Invalid connection')).toBeDefined();
  });

  it('renders with simulation styles when active', () => {
    useFlowStore.setState({ activeSimulationEdges: ['e1'] });
    render(<CustomEdge {...defaultProps} />);
    const edge = screen.getByTestId('base-edge');
    expect(edge.className).toContain('traffic-line');
  });
});
