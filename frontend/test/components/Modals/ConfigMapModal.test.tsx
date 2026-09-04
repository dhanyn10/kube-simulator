import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigMapModal } from '@/components/Modals/ConfigMapModal';
import { useFlowStore } from '@/store';
import { K8sConfigMapItem } from '@/types';

describe('ConfigMapModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    targetNodeId: 'node-1',
    targetNodeLabel: 'My App Node',
    initialConfigMap: null as K8sConfigMapItem | null,
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<ConfigMapModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with default initial state when initialConfigMap is null', () => {
    render(<ConfigMapModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Attach ConfigMap' })).toBeInTheDocument();
    expect(screen.getByText('Target card: My App Node')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/^cm-/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('API_URL')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://api.example.com')).toBeInTheDocument();
  });

  it('renders initialConfigMap data correctly when passed', () => {
    const initialConfigMap: K8sConfigMapItem = {
      id: 'cm-123',
      name: 'existing-config',
      configData: [
        { key: 'DB_HOST', value: 'localhost' },
        { key: 'DB_PORT', value: '5432' },
      ],
    };

    render(<ConfigMapModal {...defaultProps} initialConfigMap={initialConfigMap} />);

    expect(screen.getByRole('heading', { name: 'Edit ConfigMap' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('existing-config')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DB_HOST')).toBeInTheDocument();
    expect(screen.getByDisplayValue('localhost')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DB_PORT')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5432')).toBeInTheDocument();
  });

  it('allows adding, updating, and removing key-value fields', () => {
    render(<ConfigMapModal {...defaultProps} />);

    // Add field
    const addButton = screen.getByText(/Add Key-Value/i);
    fireEvent.click(addButton);

    const keyInputs = screen.getAllByPlaceholderText(/KEY/i);
    const valueInputs = screen.getAllByPlaceholderText('Value');
    expect(keyInputs).toHaveLength(3);

    // Update field
    fireEvent.change(keyInputs[2], { target: { value: 'NEW_KEY' } });
    fireEvent.change(valueInputs[2], { target: { value: 'NEW_VAL' } });
    expect(keyInputs[2]).toHaveValue('NEW_KEY');
    expect(valueInputs[2]).toHaveValue('NEW_VAL');

    // Remove field
    const removeButtons = screen.getAllByTitle('Remove Pair');
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0]);

    expect(screen.getAllByPlaceholderText(/KEY/i)).toHaveLength(2);
  });

  it('filters empty keys and calls onSave and onClose when saving', () => {
    render(<ConfigMapModal {...defaultProps} />);

    const nameInput = screen.getByPlaceholderText('e.g. app-config');
    fireEvent.change(nameInput, { target: { value: 'my Custom-CM! ' } });

    // Add an empty field
    fireEvent.click(screen.getByText(/Add Key-Value/i));

    const saveButton = screen.getByRole('button', { name: 'Attach ConfigMap' });
    fireEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'my-custom-cm',
      configData: [
        { key: 'API_URL', value: 'https://api.example.com' },
        { key: 'LOG_LEVEL', value: 'info' },
      ],
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders in light color mode correctly', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<ConfigMapModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Attach ConfigMap' })).toBeInTheDocument();
  });
});
