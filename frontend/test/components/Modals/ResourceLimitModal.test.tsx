import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceLimitModal } from '@/components/Modals/ResourceLimitModal';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

describe('ResourceLimitModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <ResourceLimitModal
        isOpen={false}
        onClose={mockOnClose}
        targetNodeId="dep-1"
        onSave={mockOnSave}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal in attach mode, handles name input change, cancel, and save buttons', () => {
    render(
      <ResourceLimitModal
        isOpen={true}
        onClose={mockOnClose}
        targetNodeId="dep-1"
        targetNodeLabel="API Service"
        onSave={mockOnSave}
      />
    );

    expect(screen.getAllByText('Attach Resource Limit')).toHaveLength(2);
    expect(screen.getByText('Target card: API Service')).toBeDefined();

    // Input change
    const nameInput = screen.getByPlaceholderText('e.g. app-resource-limit') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'custom-res-limit' } });
    expect(nameInput.value).toBe('custom-res-limit');

    // Cancel button
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);
    expect(mockOnClose).toHaveBeenCalled();

    // Save button (the button is the second element with text 'Attach Resource Limit')
    const saveBtn = screen.getAllByText('Attach Resource Limit')[1];
    fireEvent.click(saveBtn);
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('renders modal in edit mode with initialResourceLimit and handles selector updates', () => {
    const initialLimit = {
      id: 'rl-100',
      name: 'existing-limit',
      cpuRequest: '500m',
      cpuLimit: '1000m',
      memoryRequest: '256Mi',
      memoryLimit: '512Mi',
    };

    render(
      <ResourceLimitModal
        isOpen={true}
        onClose={mockOnClose}
        targetNodeId="dep-1"
        initialResourceLimit={initialLimit}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Edit Resource Limit')).toBeDefined();
    expect(screen.getByText('Configure CPU and Memory limits/requests')).toBeDefined();

    const saveBtn = screen.getByText('Update Resource Limit');
    fireEvent.click(saveBtn);
    expect(mockOnSave).toHaveBeenCalledWith({
      id: 'rl-100',
      name: 'existing-limit',
      cpuRequest: '500m',
      cpuLimit: '1000m',
      memoryRequest: '256Mi',
      memoryLimit: '512Mi',
    });
  });

  it('renders in light mode correctly', () => {
    useFlowStore.setState({ colorMode: 'light' });

    render(
      <ResourceLimitModal
        isOpen={true}
        onClose={mockOnClose}
        targetNodeId="dep-1"
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Resource Limit Name')).toBeDefined();
  });
});
