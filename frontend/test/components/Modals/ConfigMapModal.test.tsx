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
    expect(screen.getByLabelText(/Container Port/i)).toHaveValue('80');
    expect(screen.getByLabelText(/Max Capacity/i)).toHaveValue('1000');
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
    expect(screen.getByLabelText(/Container Port/i)).toHaveValue('8080');
    expect(screen.getByLabelText(/Max Capacity/i)).toHaveValue('500');
    expect(screen.getByLabelText(/Logging Verbosity/i)).toHaveValue('WARN');
  });

  it('allows changing parameter dropdowns', () => {
    render(<ConfigMapModal {...defaultProps} />);

    // Change Container Port dropdown
    fireEvent.change(screen.getByLabelText(/Container Port/i), { target: { value: '8080' } });
    expect(screen.getByLabelText(/Container Port/i)).toHaveValue('8080');

    // Change Max Capacity dropdown
    fireEvent.change(screen.getByLabelText(/Max Capacity/i), { target: { value: '5000' } });
    expect(screen.getByLabelText(/Max Capacity/i)).toHaveValue('5000');
  });

  it('calls onSave and onClose when saving parameters', () => {
    render(<ConfigMapModal {...defaultProps} />);

    const nameInput = screen.getByPlaceholderText('e.g. app-config');
    fireEvent.change(nameInput, { target: { value: 'my Custom-CM! ' } });

    const saveButton = screen.getByRole('button', { name: 'Attach ConfigMap' });
    fireEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'my-custom-cm',
      configData: [
        { key: 'PORT', value: '80' },
        { key: 'MAX_CONNECTIONS', value: '1000' },
        { key: 'LOG_LEVEL', value: 'INFO' },
        { key: 'CHAOS_MODE', value: 'disabled' },
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
