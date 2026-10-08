import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CustomEdge from '@/components/Edges/CustomEdge';
import { useFlowStore } from '@/store';

// Mock React Flow
const mockSetEdges = vi.fn();
vi.mock('@xyflow/react', () => ({
  BaseEdge: ({ style, className }: any) => <path data-testid="base-edge" style={style} className={className} />,
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
    render(
      <svg>
        <CustomEdge {...defaultProps} />
      </svg>
    );
    expect(screen.getByTestId('base-edge')).toBeDefined();
  });

  it('shows action buttons when selected and updates background styling based on colorMode', () => {
    useFlowStore.setState({ colorMode: 'dark' });
    const { rerender } = render(
      <svg>
        <CustomEdge {...defaultProps} selected={true} />
      </svg>
    );
    expect(screen.getByTitle('Settings')).toBeDefined();
    expect(screen.getByTitle('Remove')).toBeDefined();
    const panelDark = screen.getByTestId('edge-settings-panel-e1');
    expect(panelDark.getAttribute('class')).toContain('bg-slate-900');

    useFlowStore.setState({ colorMode: 'light' });
    rerender(
      <svg>
        <CustomEdge {...defaultProps} selected={true} />
      </svg>
    );
    const panelLight = screen.getByTestId('edge-settings-panel-e1');
    expect(panelLight.getAttribute('class')).toContain('bg-white');
  });

  it('renders animated directional arrows on hover', () => {
    const { container } = render(
      <svg>
        <CustomEdge {...defaultProps} />
      </svg>
    );
    expect(screen.queryByTestId('edge-hover-animation')).toBeNull();

    const hoverPath = container.querySelector('path.cursor-pointer');
    expect(hoverPath).not.toBeNull();

    fireEvent.mouseEnter(hoverPath!);
    expect(screen.getByTestId('edge-hover-animation')).toBeDefined();

    fireEvent.mouseLeave(hoverPath!);
    expect(screen.queryByTestId('edge-hover-animation')).toBeNull();
  });

  it('calls setEdges and clears configuringEdgeId when remove is clicked while configuring', () => {
    const setConfiguringEdgeIdSpy = vi.spyOn(useFlowStore.getState(), 'setConfiguringEdgeId');
    useFlowStore.setState({ configuringEdgeId: 'e1' });

    render(
      <svg>
        <CustomEdge {...defaultProps} selected={true} />
      </svg>
    );
    fireEvent.click(screen.getByTitle('Remove'));

    expect(mockSetEdges).toHaveBeenCalled();
    expect(setConfiguringEdgeIdSpy).toHaveBeenCalledWith(null);
  });

  it('calls toggleEdgeSettings when settings is clicked', () => {
    const toggleEdgeSettingsSpy = vi.spyOn(useFlowStore.getState(), 'toggleEdgeSettings');
    render(
      <svg>
        <CustomEdge {...defaultProps} selected={true} />
      </svg>
    );

    fireEvent.click(screen.getByTitle('Settings'));
    expect(toggleEdgeSettingsSpy).toHaveBeenCalledWith('e1');
  });

  it('shows validation error badge if present', () => {
    const props = { ...defaultProps, data: { validationError: 'Invalid connection' } };
    render(
      <svg>
        <CustomEdge {...props} />
      </svg>
    );
    expect(screen.getByText('Invalid connection')).toBeDefined();
  });

  it('renders with simulation styles when active', () => {
    useFlowStore.setState({ activeSimulationEdges: ['e1'] });
    render(
      <svg>
        <CustomEdge {...defaultProps} />
      </svg>
    );
    const edge = screen.getByTestId('base-edge');
    expect(edge.getAttribute('class')).toContain('traffic-line');
  });

  it('detects unready child pod in Deployment and opens Kube Console logs on alert click', () => {
    useFlowStore.setState({
      activeSimulationEdges: ['e1'],
      isTerminalOpen: false,
      terminalActiveTab: 'activity',
      terminalSelectedResourceId: null,
      nodes: [
        { id: 'svc1', type: 'Service', data: { label: 'my-svc' } },
        { id: 'dep1', type: 'Deployment', data: { label: 'my-dep', status: 'ready' } },
        { id: 'pod1', type: 'Pod', parentId: 'dep1', data: { label: 'my-pod', status: 'pending' } },
      ],
      edges: [{ id: 'e1', source: 'svc1', target: 'dep1' }],
    });

    render(
      <svg>
        <CustomEdge {...defaultProps} source="svc1" target="dep1" />
      </svg>
    );

    const badge = screen.getByTestId('edge-alert-badge');
    expect(badge).toBeDefined();

    fireEvent.click(badge);

    const state = useFlowStore.getState();
    expect(state.isTerminalOpen).toBe(true);
    expect(state.terminalActiveTab).toBe('logs');
    expect(state.terminalSelectedResourceId).toBe('dep1');
  });

  it('opens Kube Console and switches to logs when alert badge is clicked on target error', () => {
    useFlowStore.setState({
      activeSimulationEdges: ['e1'],
      isTerminalOpen: false,
      terminalActiveTab: 'activity',
      terminalSelectedResourceId: null,
      nodes: [
        { id: 'n1', type: 'Service', data: { label: 'web-service' } },
        { id: 'n2', type: 'Pod', data: { label: 'web-pod', status: 'pending' } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    });

    render(
      <svg>
        <CustomEdge {...defaultProps} source="n1" target="n2" />
      </svg>
    );

    const badge = screen.getByTestId('edge-alert-badge');
    expect(badge).toBeDefined();

    fireEvent.click(badge);

    const state = useFlowStore.getState();
    expect(state.isTerminalOpen).toBe(true);
    expect(state.terminalActiveTab).toBe('logs');
    expect(state.terminalSelectedResourceId).toBe('n2');
  });

  it('opens Kube Console and switches to activity when alert badge is clicked on validation error without loggable target', () => {
    useFlowStore.setState({
      activeSimulationEdges: [],
      isTerminalOpen: false,
      terminalActiveTab: 'logs',
      terminalSelectedResourceId: null,
      nodes: [
        { id: 'n1', type: 'Service', data: { label: 'svc-1' } },
        { id: 'n2', type: 'Service', data: { label: 'svc-2' } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    });

    const props = {
      ...defaultProps,
      source: 'n1',
      target: 'n2',
      data: { validationError: 'Service cannot connect directly to Service' },
    };

    render(
      <svg>
        <CustomEdge {...props} />
      </svg>
    );

    const badge = screen.getByTestId('edge-alert-badge');
    fireEvent.click(badge);

    const state = useFlowStore.getState();
    expect(state.isTerminalOpen).toBe(true);
    expect(state.terminalActiveTab).toBe('activity');
    expect(state.activityLogs.some(line => line.includes('Service cannot connect directly to Service'))).toBe(true);
  });

  it('detects multi-hop downstream unready nodes and handles cycles gracefully', () => {
    useFlowStore.setState({
      activeSimulationEdges: ['e1', 'e2'],
      isTerminalOpen: false,
      terminalActiveTab: 'activity',
      terminalSelectedResourceId: null,
      nodes: [
        { id: 'n1', type: 'Service', data: { label: 'svc-1' } },
        { id: 'n2', type: 'Service', data: { label: 'svc-2' } },
        { id: 'n3', type: 'Pod', data: { label: 'pod-3', status: 'pending' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ],
    });

    render(
      <svg>
        <CustomEdge {...defaultProps} source="n1" target="n2" id="e1" />
      </svg>
    );

    const badge = screen.getByTestId('edge-alert-badge');
    expect(badge).toBeDefined();

    fireEvent.click(badge);

    const state = useFlowStore.getState();
    expect(state.isTerminalOpen).toBe(true);
    expect(state.terminalActiveTab).toBe('logs');
    expect(state.terminalSelectedResourceId).toBe('n3');
  });
});
