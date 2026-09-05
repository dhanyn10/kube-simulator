import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { HPAListModal } from '@/components/Modals/HPAListModal';
import { useFlowStore } from '@/store';
import { K8sHpaItem } from '@/types';

describe('HPAListModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    targetNodeLabel: 'api-deployment',
    hpas: [] as K8sHpaItem[],
    onEditHpa: vi.fn(),
    onDeleteHpa: vi.fn(),
    onAddNewHpa: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<HPAListModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders empty message when no HPAs are attached', () => {
    render(<HPAListModal {...defaultProps} hpas={[]} />);
    expect(screen.getByText('No HPA autoscalers attached to this node.')).toBeInTheDocument();
  });

  it('renders attached HPAs and triggers edit, delete, and add new actions', () => {
    const hpas: K8sHpaItem[] = [
      {
        id: 'hpa-1',
        name: 'app-hpa',
        minReplicas: 2,
        maxReplicas: 10,
        targetCPU: 80,
        targetMemory: 75,
      },
    ];

    render(<HPAListModal {...defaultProps} hpas={hpas} />);

    expect(screen.getByText('app-hpa')).toBeInTheDocument();
    expect(screen.getByText(/Target Mem: 75%/)).toBeInTheDocument();

    // Trigger edit
    const editBtn = screen.getByTitle('Edit HPA');
    fireEvent.click(editBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onEditHpa).toHaveBeenCalledWith(hpas[0]);

    // Trigger delete
    const deleteBtn = screen.getByTitle('Delete HPA');
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDeleteHpa).toHaveBeenCalledWith('hpa-1', 'app-hpa');

    // Trigger add new HPA from footer
    const addBtn = screen.getByRole('button', { name: 'Add HPA' });
    fireEvent.click(addBtn);
    expect(defaultProps.onAddNewHpa).toHaveBeenCalled();
  });

  it('renders in light mode correctly', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<HPAListModal {...defaultProps} />);
    expect(screen.getByText('Attached HPA Autoscalers')).toBeInTheDocument();
  });
});
