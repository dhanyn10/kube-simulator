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

  it('renders correctly with default empty parameter rows when initialConfigMap is null', () => {
    render(<ConfigMapModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Attach ConfigMap' })).toBeInTheDocument();
    expect(screen.getByText('Target card: My App Node')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/^cm-/)).toBeInTheDocument();
    expect(screen.getByText(/No parameters added yet/i)).toBeInTheDocument();
  });

  it('renders initialConfigMap data correctly when passed', () => {
    const initialConfigMap: K8sConfigMapItem = {
      id: 'cm-123',
      name: 'existing-config',
      configData: [
        { key: 'PORT', value: '8080' },
        { key: 'MAX_CONNECTIONS', value: '500' },
        { key: 'LOG_LEVEL', value: 'WARN' },
        { key: 'CHAOS_MODE', value: 'disabled' },
      ],
    };

    render(<ConfigMapModal {...defaultProps} initialConfigMap={initialConfigMap} />);

    expect(screen.getByRole('heading', { name: 'Edit ConfigMap' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('existing-config')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8080')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
  });

  it('allows adding parameter rows and adapts input control according to key type', () => {
    render(<ConfigMapModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Parameter/i }));
    // PORT defaults to number input
    const portInput = screen.getByPlaceholderText(/e.g. 80, 8080/);
    expect(portInput).toHaveAttribute('type', 'number');

    // Change key to LOG_LEVEL
    const keySelects = screen.getAllByRole('combobox');
    fireEvent.change(keySelects[0], { target: { value: 'LOG_LEVEL' } });

    // LOG_LEVEL changes value control to enum select dropdown
    expect(screen.getByRole('option', { name: /DEBUG \(Verbose Diagnostics\)/i })).toBeInTheDocument();
  });

  it('calls onSave and onClose when saving parameters', () => {
    render(<ConfigMapModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Parameter/i }));
    const numberInput = screen.getByPlaceholderText(/e.g. 80, 8080/);
    fireEvent.change(numberInput, { target: { value: '8080' } });

    const nameInput = screen.getByPlaceholderText('e.g. app-config');
    fireEvent.change(nameInput, { target: { value: 'my Custom-CM! ' } });

    const saveButton = screen.getByRole('button', { name: 'Attach ConfigMap' });
    fireEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'my-custom-cm',
      configData: [
        { key: 'PORT', value: '8080' },
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
