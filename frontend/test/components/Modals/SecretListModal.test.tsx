import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SecretListModal } from '@/components/Modals/SecretListModal';
import { useFlowStore } from '@/store';
import { K8sSecretItem } from '@/types';

describe('SecretListModal', () => {
  const sampleSecrets: K8sSecretItem[] = [
    {
      id: 'sec-1',
      name: 'db-secret',
      type: 'Opaque',
      secretData: [
        { key: 'DB_PASS', value: 'secret' },
        { key: 'DB_USER', value: 'admin' },
      ],
    },
    {
      id: 'sec-2',
      name: 'tls-secret',
      type: 'kubernetes.io/tls',
      secretData: [{ key: 'tls.crt', value: 'cert' }],
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    targetNodeLabel: 'Backend Pod',
    secrets: sampleSecrets,
    onEditSecret: vi.fn(),
    onDeleteSecret: vi.fn(),
    onAddNewSecret: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<SecretListModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders attached secrets correctly', () => {
    render(<SecretListModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Attached Secrets' })).toBeInTheDocument();
    expect(screen.getByText('Node: Backend Pod')).toBeInTheDocument();

    expect(screen.getByText('db-secret')).toBeInTheDocument();
    expect(screen.getByText('tls-secret')).toBeInTheDocument();
    expect(screen.getByText(/2 key-value pairs \(DB_PASS, DB_USER\)/i)).toBeInTheDocument();
  });

  it('renders empty message when no secrets attached', () => {
    render(<SecretListModal {...defaultProps} secrets={[]} />);

    expect(screen.getByText('No Secrets attached to this node.')).toBeInTheDocument();
  });

  it('handles edit, delete, and add new secret callbacks', () => {
    render(<SecretListModal {...defaultProps} />);

    const editButtons = screen.getAllByTitle('Edit Secret');
    fireEvent.click(editButtons[0]);
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onEditSecret).toHaveBeenCalledWith(sampleSecrets[0]);

    const deleteButtons = screen.getAllByTitle('Delete Secret');
    fireEvent.click(deleteButtons[1]);
    expect(defaultProps.onDeleteSecret).toHaveBeenCalledWith('sec-2', 'tls-secret');

    const addButton = screen.getByRole('button', { name: /Add Secret/i });
    fireEvent.click(addButton);
    expect(defaultProps.onAddNewSecret).toHaveBeenCalled();
  });
});
