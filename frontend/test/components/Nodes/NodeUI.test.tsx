import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeActionButtons, NodeRenameInput } from '@/components/Nodes/NodeUI';
import { useFlowStore } from '@/store';

describe('NodeUI', () => {
  describe('NodeActionButtons', () => {
    const mockOnDelete = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders correctly', () => {
      render(<NodeActionButtons id="n1" onDelete={mockOnDelete} colorMode="dark" />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(2);
    });

    it('calls toggleNodeSettings when settings button is clicked in light and dark mode', () => {
      const toggleNodeSettingsSpy = vi.spyOn(useFlowStore.getState(), 'toggleNodeSettings');
      const { rerender } = render(<NodeActionButtons id="n1" onDelete={mockOnDelete} colorMode="dark" />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]); // Settings button

      expect(toggleNodeSettingsSpy).toHaveBeenCalledWith('n1');

      rerender(<NodeActionButtons id="n1" onDelete={mockOnDelete} colorMode="light" />);
      fireEvent.click(screen.getAllByRole('button')[0]);
    });

    it('calls onDelete when delete button is clicked', () => {
      render(<NodeActionButtons id="n1" onDelete={mockOnDelete} colorMode="dark" />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Delete button

      expect(mockOnDelete).toHaveBeenCalled();
    });

    it('deletes node from store when onDelete is not provided', () => {
      const deleteNodesSpy = vi.spyOn(useFlowStore.getState(), 'deleteNodes');
      const testNode = { id: 'test-node-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
      useFlowStore.setState({ nodes: [testNode as any] });

      render(<NodeActionButtons id="test-node-1" colorMode="dark" />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Delete button

      expect(deleteNodesSpy).toHaveBeenCalledWith([testNode]);
    });

    it('hides settings button if hideSettings is true', () => {
      render(<NodeActionButtons id="n1" onDelete={mockOnDelete} colorMode="dark" hideSettings={true} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(1);
    });
  });

  describe('NodeRenameInput', () => {
    const mockSetIsEditing = vi.fn();
    const mockSetEditValue = vi.fn();
    const mockHandleRename = vi.fn();

    it('renders label when not editing', () => {
      render(
        <NodeRenameInput
          isEditing={false}
          setIsEditing={mockSetIsEditing}
          label="my-node"
          colorMode="dark"
        />
      );
      expect(screen.getByText('my-node')).toBeDefined();
    });

    it('enters editing mode on double click or Enter/Space keydown', () => {
      render(
        <NodeRenameInput
          isEditing={false}
          setIsEditing={mockSetIsEditing}
          label="my-node"
          colorMode="light"
        />
      );
      const labelBtn = screen.getByText('my-node');
      fireEvent.doubleClick(labelBtn);
      expect(mockSetIsEditing).toHaveBeenCalledWith(true);

      fireEvent.keyDown(labelBtn, { key: 'Enter' });
      expect(mockSetIsEditing).toHaveBeenCalledWith(true);

      fireEvent.keyDown(labelBtn, { key: ' ' });
      expect(mockSetIsEditing).toHaveBeenCalledWith(true);
    });

    it('renders input when editing', () => {
      render(
        <NodeRenameInput
          isEditing={true}
          editValue="editing-value"
          setEditValue={mockSetEditValue}
          handleRename={mockHandleRename}
          colorMode="dark"
        />
      );
      const input = screen.getByDisplayValue('editing-value');
      expect(input).toBeDefined();
    });

    it('updates edit value on change and handles input event propagation and keydown', () => {
      const mockOnKeyDown = vi.fn();
      render(
        <NodeRenameInput
          isEditing={true}
          editValue="test"
          setEditValue={mockSetEditValue}
          onKeyDown={mockOnKeyDown}
          colorMode="light"
        />
      );
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Name' } });
      expect(mockSetEditValue).toHaveBeenCalledWith('New Name');

      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockOnKeyDown).toHaveBeenCalled();

      fireEvent.click(input);
      fireEvent.mouseDown(input);
      fireEvent.pointerDown(input);
    });
  });
});
