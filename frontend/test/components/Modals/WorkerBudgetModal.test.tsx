import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkerBudgetModal } from '@/components/Modals/WorkerBudgetModal';
import { useFlowStore } from '@/store';

describe('WorkerBudgetModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      clusterWorkerCount: 3,
      isWorkerBudgetModalOpen: true,
      nodes: [],
    });
  });

  it('renders correctly when open', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    expect(screen.getByTestId('worker-budget-modal')).toBeDefined();
    expect(screen.getByText('Cluster Worker Nodes & Hardware Budget')).toBeDefined();
    expect(screen.getByTestId('worker-count-display')).toBeDefined();
    expect(screen.getByTestId('cluster-budget-status-badge')).toBeDefined();
    expect(screen.getByTestId('pod-capacity-normal-badge')).toBeDefined();
    expect(screen.getByTestId('pod-capacity-subtitle')).toBeDefined();
  });

  it('renders Exceeds Limits badge and dynamic hardware capacity subtitle when workloads define resource limits', () => {
    const limitedPod = {
      id: 'limited-pod',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: {
        label: 'limited-pod',
        replicas: 1,
        cpuLimit: '2000m',
        memoryLimit: '4096Mi',
      },
    };
    useFlowStore.setState({ nodes: [limitedPod as any] });

    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    expect(screen.getByTestId('pod-capacity-warning-badge')).toBeDefined();
    expect(screen.getByText('Exceeds Limits')).toBeDefined();
    const subtitle = screen.getByTestId('pod-capacity-subtitle');
    expect(subtitle.textContent).toContain('Hardware capacity:');
  });

  it('does not render when closed', () => {
    useFlowStore.setState({ isWorkerBudgetModalOpen: false });
    const { container } = render(<WorkerBudgetModal isOpen={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('allows switching worker node size presets', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const smallPresetBtn = screen.getByTestId('worker-preset-small');
    fireEvent.click(smallPresetBtn);

    // After choosing small preset (1 vCPU, 2 GB), 3 nodes should equal 3 vCPUs
    expect(screen.getByText('3 vCPUs')).toBeDefined();

    const largePresetBtn = screen.getByTestId('worker-preset-large');
    fireEvent.click(largePresetBtn);
    // Large preset (4 vCPU, 8 GB), 3 nodes = 12 vCPUs
    expect(screen.getByText('12 vCPUs')).toBeDefined();
  });

  it('allows adjusting worker count using quick step buttons', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const plusOneBtn = screen.getByRole('button', { name: '+1' });
    fireEvent.click(plusOneBtn);
    expect(screen.getByText('4 Nodes')).toBeDefined();

    const plusTenBtn = screen.getByRole('button', { name: '+10' });
    fireEvent.click(plusTenBtn);
    expect(screen.getByText('14 Nodes')).toBeDefined();

    const minusOneBtn = screen.getByRole('button', { name: '-1' });
    fireEvent.click(minusOneBtn);
    expect(screen.getByText('13 Nodes')).toBeDefined();

    const minusTenBtn = screen.getByRole('button', { name: '-10' });
    fireEvent.click(minusTenBtn);
    expect(screen.getByText('3 Nodes')).toBeDefined();
  });

  it('handles minimum and maximum boundaries for worker count and buttons', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const slider = screen.getByTestId('worker-count-range-slider');
    fireEvent.change(slider, { target: { value: '1' } });

    // Expect singular label "1 Node"
    expect(screen.getByText('1 Node')).toBeDefined();
    expect(screen.getByRole('button', { name: '-1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '-10' })).toBeDisabled();

    // Set to 100
    fireEvent.change(slider, { target: { value: '100' } });
    expect(screen.getByText('100 Nodes')).toBeDefined();
    expect(screen.getByRole('button', { name: '+1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '+10' })).toBeDisabled();
  });

  it('allows adjusting worker count using the range slider', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const slider = screen.getByTestId('worker-count-range-slider');
    fireEvent.change(slider, { target: { value: '25' } });

    expect(screen.getByText('25 Nodes')).toBeDefined();
  });

  it('shows Local Hardware Budget Exceeded warning when demand is too high', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const largePresetBtn = screen.getByTestId('worker-preset-large');
    fireEvent.click(largePresetBtn);

    const slider = screen.getByTestId('worker-count-range-slider');
    fireEvent.change(slider, { target: { value: '80' } });

    expect(screen.getByText(/Local Hardware Budget Exceeded/i)).toBeDefined();
  });

  it('shows Workload Capacity Warning when active pod requests exceed capacity', () => {
    // 1 Pod requesting 8 cores and 16GB RAM, but worker count is 1 with small preset (1 core, 2GB)
    const demandingPod = {
      id: 'heavy-pod',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: {
        label: 'heavy-pod',
        cpuRequest: '8000m',
        memoryRequest: '16Gi',
      },
    };
    useFlowStore.setState({ nodes: [demandingPod as any] });

    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const smallPresetBtn = screen.getByTestId('worker-preset-small');
    fireEvent.click(smallPresetBtn);

    const slider = screen.getByTestId('worker-count-range-slider');
    fireEvent.change(slider, { target: { value: '1' } });

    expect(screen.getByText(/Workload Capacity Warning/i)).toBeDefined();
  });

  it('renders in light mode theme without errors', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);
    expect(screen.getByTestId('worker-budget-modal')).toBeDefined();
  });

  it('handles closing without propOnClose by falling back to store', () => {
    render(<WorkerBudgetModal />);
    const closeBtn = screen.getByTestId('worker-budget-modal-close');
    fireEvent.click(closeBtn);
    expect(useFlowStore.getState().isWorkerBudgetModalOpen).toBe(false);
  });

  it('applies configuration to flow store and closes modal', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const slider = screen.getByTestId('worker-count-range-slider');
    fireEvent.change(slider, { target: { value: '6' } });

    const applyBtn = screen.getByTestId('worker-budget-apply-btn');
    fireEvent.click(applyBtn);

    expect(useFlowStore.getState().clusterWorkerCount).toBe(6);
    expect(useFlowStore.getState().isWorkerBudgetModalOpen).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on cancel button click', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const cancelBtn = screen.getByTestId('worker-budget-cancel-btn');
    fireEvent.click(cancelBtn);

    expect(useFlowStore.getState().isWorkerBudgetModalOpen).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on header close button click', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const closeBtn = screen.getByTestId('worker-budget-modal-close');
    fireEvent.click(closeBtn);

    expect(useFlowStore.getState().isWorkerBudgetModalOpen).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });
});
