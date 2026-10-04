import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceLimitListModal } from '@/components/Modals/ResourceLimitListModal';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

describe('ResourceLimitListModal', () => {
  const mockOnClose = vi.fn();
  const mockOnOpenAddModal = vi.fn();
  const mockOnOpenEditModal = vi.fn();
  const mockOnDeleteItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders ResourceLimitListModal with items, renderItemDetails formatting, and triggers callbacks', () => {
    const limits = [
      {
        id: 'rl-1',
        name: 'custom-limit-1',
        cpuRequest: '250m',
        cpuLimit: '500m',
        memoryRequest: '128Mi',
        memoryLimit: '256Mi',
      },
      {
        id: 'rl-2',
        name: 'default-limit-2',
      } as any,
    ];

    render(
      <ResourceLimitListModal
        isOpen={true}
        onClose={mockOnClose}
        targetNodeLabel="Web Deployment"
        resourceLimits={limits}
        onOpenAddModal={mockOnOpenAddModal}
        onOpenEditModal={mockOnOpenEditModal}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    expect(screen.getByText('Attached Resource Limits')).toBeDefined();
    expect(screen.getByText('Node: Web Deployment')).toBeDefined();
    expect(screen.getByText('custom-limit-1')).toBeDefined();
    expect(screen.getByText('CPU: 250m / 500m | Mem: 128Mi / 256Mi')).toBeDefined();
    expect(screen.getByText('CPU: 500m / 1000m | Mem: 256Mi / 512Mi')).toBeDefined();

    // Edit button click
    const editBtns = screen.getAllByTitle('Edit ResourceLimit');
    fireEvent.click(editBtns[0]);
    expect(mockOnOpenEditModal).toHaveBeenCalledWith(limits[0]);

    // Delete button click
    const deleteBtns = screen.getAllByTitle('Delete ResourceLimit');
    fireEvent.click(deleteBtns[0]);
    expect(mockOnDeleteItem).toHaveBeenCalledWith('rl-1', 'custom-limit-1');

    // Add button click
    const addBtn = screen.getByText('Add Resource Limit');
    fireEvent.click(addBtn);
    expect(mockOnOpenAddModal).toHaveBeenCalled();
  });

  it('renders fallback subtitle when targetNodeLabel is omitted and handles empty items', () => {
    render(
      <ResourceLimitListModal
        isOpen={true}
        onClose={mockOnClose}
        resourceLimits={[]}
        onOpenAddModal={mockOnOpenAddModal}
        onOpenEditModal={mockOnOpenEditModal}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    expect(screen.getByText('Manage attached CPU & Memory Limits')).toBeDefined();
    expect(screen.getByText('No Resource Limits attached to this node.')).toBeDefined();
  });
});
