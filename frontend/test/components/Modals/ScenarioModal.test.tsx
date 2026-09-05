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
});
