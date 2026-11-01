import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  });

  it('allows adjusting worker count using quick step buttons', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const plusOneBtn = screen.getByRole('button', { name: '+1' });
    fireEvent.click(plusOneBtn);

    expect(screen.getByText('4 Nodes')).toBeDefined();

    const plusTenBtn = screen.getByRole('button', { name: '+10' });
    fireEvent.click(plusTenBtn);

    expect(screen.getByText('14 Nodes')).toBeDefined();
  });

  it('allows adjusting worker count using the range slider', () => {
    render(<WorkerBudgetModal isOpen={true} onClose={onClose} />);

    const slider = screen.getByTestId('worker-count-range-slider');
    fireEvent.change(slider, { target: { value: '25' } });

    expect(screen.getByText('25 Nodes')).toBeDefined();
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
