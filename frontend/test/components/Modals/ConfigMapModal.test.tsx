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
    expect(screen.getByText(/No key-value pairs added/i)).toBeInTheDocument();
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
    expect(screen.getByDisplayValue('8080 (Alt Web Server)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500 RPS (Medium Limit)')).toBeInTheDocument();
  });

  it('allows adding Postman-style Key and Value dropdown rows', () => {
    render(<ConfigMapModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Row/i }));

    const keySelects = screen.getAllByRole('combobox', { name: 'Key' });
    const valueSelects = screen.getAllByRole('combobox', { name: 'Value' });

    expect(keySelects.length).toBe(1);
    expect(valueSelects.length).toBe(1);

    // Change Key to LOG_LEVEL
    fireEvent.change(keySelects[0], { target: { value: 'LOG_LEVEL' } });
    expect(screen.getByRole('option', { name: /DEBUG \(Verbose Diagnostics\)/i })).toBeInTheDocument();
  });

  it('calls onSave and onClose when saving parameters', () => {
    render(<ConfigMapModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Row/i }));
    const nameInput = screen.getByPlaceholderText('e.g. app-config');
    fireEvent.change(nameInput, { target: { value: 'my Custom-CM! ' } });

    const saveButton = screen.getByRole('button', { name: 'Attach ConfigMap' });
    fireEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'my-custom-cm',
      configData: [
        { key: 'PORT', value: '80' },
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
