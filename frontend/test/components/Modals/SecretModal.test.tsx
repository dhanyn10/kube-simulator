import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SecretModal } from '@/components/Modals/SecretModal';
import { useFlowStore } from '@/store';
import { K8sSecretItem } from '@/types';

describe('SecretModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    targetNodeId: 'node-1',
    targetNodeLabel: 'My Secret Node',
    initialSecret: null as K8sSecretItem | null,
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<SecretModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with default initial state when initialSecret is null', () => {
    render(<SecretModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Attach Secret' })).toBeInTheDocument();
    expect(screen.getByText('Target card: My Secret Node')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. app-secret')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DB_PASSWORD')).toBeInTheDocument();
    expect(screen.getByDisplayValue('s3cr3tp@ss')).toBeInTheDocument();
  });

  it('renders initialSecret data correctly when passed', () => {
    const initialSecret: K8sSecretItem = {
      id: 'sec-123',
      name: 'existing-secret',
      type: 'kubernetes.io/tls',
      secretData: [
        { key: 'tls.crt', value: 'cert-data' },
        { key: 'tls.key', value: 'key-data' },
      ],
    };

    render(<SecretModal {...defaultProps} initialSecret={initialSecret} />);

    expect(screen.getByRole('heading', { name: 'Edit Secret' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('existing-secret')).toBeInTheDocument();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('kubernetes.io/tls');
    expect(screen.getByDisplayValue('tls.crt')).toBeInTheDocument();
    expect(screen.getByDisplayValue('cert-data')).toBeInTheDocument();
  });

  it('allows adding, updating, and removing key-value fields', () => {
    render(<SecretModal {...defaultProps} />);

    // Add field
    const addButton = screen.getByText(/Add Key-Value/i);
    fireEvent.click(addButton);

    const keyInputs = screen.getAllByPlaceholderText(/KEY/i);
    const valueInputs = screen.getAllByPlaceholderText(/Secret Value/i);
    expect(keyInputs).toHaveLength(3);

    // Update field
    fireEvent.change(keyInputs[2], { target: { value: 'TOKEN_KEY' } });
    fireEvent.change(valueInputs[2], { target: { value: 'TOKEN_VAL' } });
    expect(keyInputs[2]).toHaveValue('TOKEN_KEY');
    expect(valueInputs[2]).toHaveValue('TOKEN_VAL');

    // Remove field
    const removeButtons = screen.getAllByTitle('Remove Pair');
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0]);

    expect(screen.getAllByPlaceholderText(/KEY/i)).toHaveLength(2);
  });

  it('filters empty keys and calls onSave and onClose when saving', () => {
    render(<SecretModal {...defaultProps} />);

    const nameInput = screen.getByPlaceholderText('e.g. app-secret');
    fireEvent.change(nameInput, { target: { value: 'my Custom-Secret! ' } });

    // Add an empty field
    fireEvent.click(screen.getByText(/Add Key-Value/i));

    const saveButton = screen.getByRole('button', { name: 'Attach Secret' });
    fireEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'my-custom-secret',
      type: 'Opaque',
      secretData: [
        { key: 'DB_PASSWORD', value: 's3cr3tp@ss' },
        { key: 'API_KEY', value: 'secret-token-xyz' },
      ],
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders in light color mode correctly', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<SecretModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Attach Secret' })).toBeInTheDocument();
  });
});
