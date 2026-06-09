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

    it('calls toggleNodeSettings when settings button is clicked', () => {
      const toggleNodeSettingsSpy = vi.spyOn(useFlowStore.getState(), 'toggleNodeSettings');
      render(<NodeActionButtons id="n1" onDelete={mockOnDelete} colorMode="dark" />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]); // Settings button

      expect(toggleNodeSettingsSpy).toHaveBeenCalledWith('n1');
    });

    it('calls onDelete when delete button is clicked', () => {
      render(<NodeActionButtons id="n1" onDelete={mockOnDelete} colorMode="dark" />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Delete button

      expect(mockOnDelete).toHaveBeenCalled();
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

    it('enters editing mode on double click', () => {
      render(
        <NodeRenameInput
          isEditing={false}
          setIsEditing={mockSetIsEditing}
          label="my-node"
          colorMode="dark"
        />
      );
      fireEvent.doubleClick(screen.getByText('my-node'));
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

    it('updates edit value on change and slugifies it', () => {
        render(
            <NodeRenameInput
              isEditing={true}
              editValue=""
              setEditValue={mockSetEditValue}
              colorMode="dark"
            />
          );
          const input = screen.getByRole('textbox');
          fireEvent.change(input, { target: { value: 'New Name' } });
          expect(mockSetEditValue).toHaveBeenCalledWith('new-name');
    });
  });
});
