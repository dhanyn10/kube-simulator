import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ScenarioModal } from '@/components/Modals/ScenarioModal';
import { useFlowStore } from '@/store';
import { scenarios } from '@/scenarios';

// Mock useFitView
vi.mock('@/hooks/useFitView', () => ({
  useFitView: () => vi.fn(),
}));

const escapeRegex = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

describe('ScenarioModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      colorMode: 'dark',
    });
  });

  it('renders all scenarios when open', () => {
    render(<ScenarioModal isOpen={true} onClose={() => {}} />);
    scenarios.forEach(scenario => {
      expect(screen.getAllByText(new RegExp(escapeRegex(scenario.name), 'i')).length).toBeGreaterThan(0);
    });
  });

  it('applies scenario directly if canvas is empty', async () => {
    const onClose = vi.fn();
    render(<ScenarioModal isOpen={true} onClose={onClose} />);

    const firstScenario = scenarios[0];
    const scenarioBtn = screen.getByText(new RegExp(escapeRegex(firstScenario.name), 'i')).closest('button');

    await act(async () => {
        fireEvent.click(scenarioBtn!);
    });

    expect(useFlowStore.getState().nodes.length).toBeGreaterThan(0);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows confirmation dialog if canvas is not empty', async () => {
    useFlowStore.setState({ nodes: [{ id: 'n1', type: 'Pod', data: {} } as any] });
    render(<ScenarioModal isOpen={true} onClose={() => {}} />);

    const firstScenario = scenarios[0];
    const scenarioBtn = screen.getByText(new RegExp(escapeRegex(firstScenario.name), 'i')).closest('button');

    fireEvent.click(scenarioBtn!);

    expect(screen.getByText('Overwrite Current Canvas?')).toBeDefined();

    const confirmBtn = screen.getByText('Confirm & Load');
    await act(async () => {
        fireEvent.click(confirmBtn);
    });

    expect(useFlowStore.getState().nodes.length).toBeGreaterThan(0);
  });

  it('can cancel confirmation', async () => {
    useFlowStore.setState({ nodes: [{ id: 'n1', type: 'Pod', data: {} } as any] });
    render(<ScenarioModal isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getByText(new RegExp(escapeRegex(scenarios[0].name), 'i')).closest('button')!);
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Overwrite Current Canvas?')).toBeNull();
    expect(useFlowStore.getState().nodes.length).toBe(1);
  });

  it('renders scenarios with Advanced level badges and handles fallback level styles', () => {
    render(<ScenarioModal isOpen={true} onClose={() => {}} />);

    scenarios.forEach(scenario => {
      expect(screen.getAllByText(scenario.level).length).toBeGreaterThan(0);
    });
  });

  it('handles default scenario level fallback icon and background', () => {
    // Inject a scenario with unknown level to test default branch
    const mockScenario = {
      id: 'custom-scenario',
      name: 'Custom Level Scenario',
      level: 'Expert' as any,
      description: 'Test custom scenario level',
      data: { nodes: [], edges: [] }
    };

    scenarios.push(mockScenario);

    render(<ScenarioModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Custom Level Scenario')).toBeDefined();

    scenarios.pop();
  });

  it('does not render when isOpen is false and renders in light mode', () => {
    const { container } = render(<ScenarioModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();

    useFlowStore.setState({ colorMode: 'light' });
    render(<ScenarioModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Learning Scenarios')).toBeDefined();
  });

  it('handles scenario data with missing nodes/edges or node parentId, and confirm in light mode', async () => {
    useFlowStore.setState({
      nodes: [{ id: 'existing', type: 'Pod', data: {} } as any],
      colorMode: 'light',
    });

    const emptyDataScenario = {
      id: 'empty-data-scenario',
      name: 'Empty Data Scenario',
      level: 'Basic' as const,
      description: 'Scenario without nodes/edges or with parentId',
      data: {
        nodes: [
          { id: 101, parentId: 202, type: 'Pod', data: {} },
          { id: 202, type: 'Namespace', data: {} },
        ],
      } as any,
    };

    scenarios.push(emptyDataScenario);

    render(<ScenarioModal isOpen={true} onClose={() => {}} />);

    const btn = screen.getByText('Empty Data Scenario').closest('button');
    fireEvent.click(btn!);

    expect(screen.getByText('Overwrite Current Canvas?')).toBeDefined();

    const confirmBtn = screen.getByText('Confirm & Load');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(useFlowStore.getState().nodes.length).toBe(2);

    scenarios.pop();
  });

  it('handles scenario data without nodes or edges arrays', async () => {
    const noArrayScenario = {
      id: 'no-array-scenario',
      name: 'No Array Scenario',
      level: 'Intermediate' as const,
      description: 'Scenario with empty data object',
      data: {} as any,
    };

    scenarios.push(noArrayScenario);

    render(<ScenarioModal isOpen={true} onClose={() => {}} />);

    const btn = screen.getByText('No Array Scenario').closest('button');
    await act(async () => {
      fireEvent.click(btn!);
    });

    expect(useFlowStore.getState().nodes.length).toBe(0);

    scenarios.pop();
  });
});
