import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigMapListModal } from '@/components/Modals/ConfigMapListModal';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

describe('ConfigMapListModal', () => {
  const mockOnClose = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnAddNew = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <ConfigMapListModal
        isOpen={false}
        onClose={mockOnClose}
        configMaps={[]}
        onEditConfigMap={mockOnEdit}
        onDeleteConfigMap={mockOnDelete}
        onAddNewConfigMap={mockOnAddNew}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders empty message when no configmaps are attached', () => {
    render(
      <ConfigMapListModal
        isOpen={true}
        onClose={mockOnClose}
        configMaps={[]}
        onEditConfigMap={mockOnEdit}
        onDeleteConfigMap={mockOnDelete}
        onAddNewConfigMap={mockOnAddNew}
      />
    );
    expect(screen.getByText('No ConfigMaps attached to this node.')).toBeDefined();
  });

  it('renders configmap items and triggers edit, delete, and add new actions', () => {
    const cmList = [
      { id: 'cm-1', name: 'app-cm-1', configData: [{ key: 'ENV', value: 'prod' }, { key: 'PORT', value: '8080' }] },
      { id: 'cm-2', name: 'app-cm-2', configData: [] },
    ];

    render(
      <ConfigMapListModal
        isOpen={true}
        onClose={mockOnClose}
        targetNodeLabel="My Deployment"
        configMaps={cmList}
        onEditConfigMap={mockOnEdit}
        onDeleteConfigMap={mockOnDelete}
        onAddNewConfigMap={mockOnAddNew}
      />
    );

    expect(screen.getByText('app-cm-1')).toBeDefined();
    expect(screen.getByText('app-cm-2')).toBeDefined();

    // Edit button
    const editBtns = screen.getAllByTitle('Edit ConfigMap');
    fireEvent.click(editBtns[0]);
    expect(mockOnEdit).toHaveBeenCalledWith(cmList[0]);

    // Delete button
    const deleteBtns = screen.getAllByTitle('Delete ConfigMap');
    fireEvent.click(deleteBtns[0]);
    expect(mockOnDelete).toHaveBeenCalledWith('cm-1', 'app-cm-1');

    // Add new button
    const addBtn = screen.getByText('Add ConfigMap');
    fireEvent.click(addBtn);
    expect(mockOnAddNew).toHaveBeenCalled();
  });
});
