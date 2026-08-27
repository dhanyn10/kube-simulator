import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RightSidebar } from '../../../src/components/Layout/RightSidebar';
import { useFlowStore } from '../../../src/store';

// Mock Config components to avoid deep rendering issues
vi.mock('../../../src/components/Config', () => ({
  NodeConfig: () => <div data-testid="node-config">Node Config</div>,
  EdgeConfig: () => <div data-testid="edge-config">Edge Config</div>,
}));

// Mock ResourceBudget
vi.mock('../../../src/components/Monitoring', () => ({
  ResourceBudget: () => <div data-testid="resource-budget">Resource Budget</div>,
}));

describe('RightSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'node-1', type: 'Pod', data: { label: 'Pod 1' } }
      ],
      edges: [
        { id: 'edge-1', source: 'node-1', target: 'node-2', data: {} }
      ],
      configuringNodeId: null,
      configuringEdgeId: null,
      visibleWidgets: ['hardware-budget', 'object-stats'],
    });
  });

  it('renders correctly with default tabs', () => {
    render(<RightSidebar onExportYaml={vi.fn()} />);
    expect(screen.getByText('Canvas')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('switches tabs', () => {
    render(<RightSidebar onExportYaml={vi.fn()} />);

    const settingsTab = screen.getByText('Settings');
    fireEvent.click(settingsTab);

    expect(screen.getByText('Select an element on the canvas to view and modify its properties.')).toBeDefined();

    const canvasTab = screen.getByText('Canvas');
    fireEvent.click(canvasTab);
    expect(screen.getByText('Hardware Budget')).toBeDefined();
    expect(screen.getByText('Object Statistics')).toBeDefined();
  });

  it('opens canvas dropdown', () => {
    render(<RightSidebar onExportYaml={vi.fn()} />);
    const dropdownToggle = screen.getByTestId('canvas-dropdown-toggle');
    fireEvent.click(dropdownToggle);

    expect(screen.getByText('Hardware Budget', { selector: 'span' })).toBeDefined();
    expect(screen.getByText('Object Statistics', { selector: 'span' })).toBeDefined();
    expect(screen.getByTestId('open-yaml-inspector')).toBeDefined();
  });

  it('toggles widget visibility', () => {
    const toggleWidget = vi.spyOn(useFlowStore.getState(), 'toggleWidget');
    render(<RightSidebar onExportYaml={vi.fn()} />);

    const dropdownToggle = screen.getByTestId('canvas-dropdown-toggle');
    fireEvent.click(dropdownToggle);

    const hardwareBudgetBtn = screen.getByText('Hardware Budget', { selector: 'span' }).closest('button');
    fireEvent.click(hardwareBudgetBtn!);

    expect(toggleWidget).toHaveBeenCalledWith('hardware-budget');
  });

  it('switches to settings tab when a node is selected', () => {
    render(<RightSidebar onExportYaml={vi.fn()} />);

    // Initial tab should be Canvas
    expect(screen.getByText('Hardware Budget')).toBeDefined();

    // Select a node
    act(() => {
      useFlowStore.setState({ configuringNodeId: 'node-1' });
    });

    expect(screen.getByTestId('node-config')).toBeDefined();
  });

  it('switches to settings tab when an edge is selected', () => {
    render(<RightSidebar onExportYaml={vi.fn()} />);

    // Select an edge
    act(() => {
      useFlowStore.setState({ configuringEdgeId: 'edge-1' });
    });

    expect(screen.getByTestId('edge-config')).toBeDefined();
  });

  it('calls onExportYaml from dropdown', () => {
    const onExportYaml = vi.fn();
    render(<RightSidebar onExportYaml={onExportYaml} />);

    fireEvent.click(screen.getByTestId('canvas-dropdown-toggle'));
    fireEvent.click(screen.getByTestId('open-yaml-inspector'));

    expect(onExportYaml).toHaveBeenCalled();
  });

  it('shows empty state when no widgets are visible', () => {
    useFlowStore.setState({ visibleWidgets: [] });
    render(<RightSidebar onExportYaml={vi.fn()} />);

    expect(screen.getByText('Enable widgets from the dropdown menu to see hardware and status info.')).toBeDefined();
  });

  it('renders full history mode in right sidebar when isHistoryViewOpen is true', () => {
    act(() => {
      useFlowStore.setState({ isHistoryViewOpen: true });
    });

    render(<RightSidebar onExportYaml={vi.fn()} />);

    // Tab bar should be hidden in full History view mode
    expect(screen.queryByText('Canvas')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();

    // History Timeline should be rendered
    expect(screen.getByText('Activity Timeline')).toBeDefined();
  });

  it('switches to settings panel when a node is selected while history view is open', () => {
    act(() => {
      useFlowStore.setState({ isHistoryViewOpen: true });
    });

    render(<RightSidebar onExportYaml={vi.fn()} />);

    act(() => {
      useFlowStore.setState({ configuringNodeId: 'node-1' });
    });

    // Selecting a node should exit history view and show node config settings
    expect(screen.getByTestId('node-config')).toBeDefined();
    expect(useFlowStore.getState().isHistoryViewOpen).toBe(false);
  });
});
