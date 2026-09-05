import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { HPAModal } from '@/components/Modals/HPAModal';
import { useFlowStore } from '@/store';
import { K8sHpaItem } from '@/types';

describe('HPAModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    targetNodeId: 'dep-1',
    targetNodeLabel: 'My Deployment',
    initialHpa: null as K8sHpaItem | null,
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<HPAModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when open with default values and handles save', () => {
    render(<HPAModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Attach HPA Autoscaling' })).toBeInTheDocument();
    expect(screen.getByText('Target card: My Deployment')).toBeInTheDocument();

    const nameInput = screen.getByLabelText('HPA Name');
    fireEvent.change(nameInput, { target: { value: 'custom-hpa' } });

    const minInput = screen.getByLabelText('Min Replicas');
    fireEvent.change(minInput, { target: { value: '3' } });

    const maxInput = screen.getByLabelText('Max Replicas');
    fireEvent.change(maxInput, { target: { value: '15' } });

    const cpuInput = screen.getByLabelText('Target CPU Utilization (%)');
    fireEvent.change(cpuInput, { target: { value: '75' } });

    const memInput = screen.getByLabelText(/Target Memory Utilization/);
    fireEvent.change(memInput, { target: { value: '80' } });

    const saveButton = screen.getByRole('button', { name: 'Attach HPA' });
    fireEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'custom-hpa',
      minReplicas: 3,
      maxReplicas: 15,
      targetCPU: 75,
      targetMemory: 80,
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders initialHpa data when passed and updates correctly', () => {
    const initialHpa: K8sHpaItem = {
      id: 'hpa-123',
      name: 'existing-hpa',
      minReplicas: 2,
      maxReplicas: 20,
      targetCPU: 70,
      targetMemory: 60,
    };

    render(<HPAModal {...defaultProps} initialHpa={initialHpa} />);

    expect(screen.getByRole('heading', { name: 'Edit HPA Autoscaling' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('existing-hpa')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    expect(screen.getByDisplayValue('70')).toBeInTheDocument();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: 'Update HPA' });
    fireEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith(initialHpa);
  });

  it('renders in light mode correctly', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<HPAModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: 'Attach HPA Autoscaling' })).toBeInTheDocument();
  });

  it('handles clearing memory target and fallback initial values, and cancel button click', () => {
    const props = {
      ...defaultProps,
      targetNodeLabel: undefined,
      initialHpa: { id: 'h1', name: '' } as K8sHpaItem,
    };

    render(<HPAModal {...props} />);

    expect(screen.getByText('Configure HorizontalPodAutoscaler')).toBeInTheDocument();

    const memInput = screen.getByLabelText(/Target Memory Utilization/);
    fireEvent.change(memInput, { target: { value: '50' } });
    fireEvent.change(memInput, { target: { value: '' } });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
