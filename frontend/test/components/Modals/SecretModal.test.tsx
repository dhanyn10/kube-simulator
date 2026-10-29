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
    useFlowStore.setState({ colorMode: 'dark', nodes: [] });
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

  it('allows changing secret type option', () => {
    render(<SecretModal {...defaultProps} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'kubernetes.io/tls' } });
    expect(select.value).toBe('kubernetes.io/tls');
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

  it('filters empty keys, calls onSave, and returns to Cluster Secrets Overview list view instead of closing modal', () => {
    render(<SecretModal {...defaultProps} />);

    const nameInput = screen.getByPlaceholderText('e.g. app-secret');
    fireEvent.change(nameInput, { target: { value: 'my Custom-Secret! ' } });

    // Add an empty field
    fireEvent.click(screen.getByText(/Add Key-Value/i));

    const saveButton = screen.getByRole('button', { name: 'Attach Secret' });
    fireEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: 'my-custom-secret',
        type: 'Opaque',
        secretData: [
          { key: 'DB_PASSWORD', value: 's3cr3tp@ss' },
          { key: 'API_KEY', value: 'secret-token-xyz' },
        ],
      })
    );
    expect(screen.getByText('Cluster Secrets Overview')).toBeInTheDocument();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('renders in light color mode correctly', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<SecretModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Attach Secret' })).toBeInTheDocument();
  });

  it('handles empty secretData in initialSecret, empty targetNodeLabel, and empty secretName fallback', () => {
    const onSaveMock = vi.fn();
    const initialSecret: K8sSecretItem = {
      id: 'sec-456',
      name: '',
      type: '',
      secretData: [],
    };

    render(
      <SecretModal
        {...defaultProps}
        targetNodeLabel={undefined}
        initialSecret={initialSecret}
        onSave={onSaveMock}
      />
    );

    expect(screen.getByText('Configure Sensitive Key-Value Data')).toBeInTheDocument();
    expect(screen.getByDisplayValue('app-secret')).toBeInTheDocument();

    // Clear secretName to whitespace
    const nameInput = screen.getByDisplayValue('app-secret');
    fireEvent.change(nameInput, { target: { value: '   ' } });

    // Click Update Secret button
    const saveBtn = screen.getByRole('button', { name: 'Update Secret' });
    fireEvent.click(saveBtn);

    expect(onSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sec-456',
        name: 'sec-456',
        type: 'Opaque',
      })
    );
  });

  it('displays read-only Secret ID input in edit mode and hides it in create mode', () => {
    // 1. Create mode: secret-id-input should not be present
    const { unmount } = render(<SecretModal {...defaultProps} initialSecret={null} />);
    expect(screen.queryByTestId('secret-id-input')).not.toBeInTheDocument();
    unmount();

    // 2. Edit mode: secret-id-input should be visible, read-only and disabled
    render(
      <SecretModal
        {...defaultProps}
        initialSecret={{
          id: 'sec-read-only-123',
          name: 'db-credentials',
          type: 'Opaque',
          secretData: [{ key: 'USER', value: 'root' }],
        }}
      />
    );

    const idInput = screen.getByTestId('secret-id-input');
    expect(idInput).toBeInTheDocument();
    expect(idInput).toHaveValue('sec-read-only-123');
    expect(idInput).toBeDisabled();
    expect(idInput).toHaveAttribute('readonly');
  });

  it('displays only one suggestion in dropdown for 10 replica pods and attaches to all replicas', () => {
    const mockUpdateNodeData = vi.fn();
    const replicaPods = Array.from({ length: 10 }, (_, i) => ({
      id: `pod-auth-${i + 1}`,
      type: 'Pod',
      position: { x: 0, y: i * 50 },
      data: {
        baseName: 'auth-svc',
        podHash: '5x6y7',
        replicaSuffix: `suf0${i}`,
        label: `auth-svc-5x6y7-suf0${i}`,
        secrets: [],
      },
    }));

    useFlowStore.setState({
      nodes: replicaPods as any,
      updateNodeData: mockUpdateNodeData,
      addLog: vi.fn(),
    });

    render(
      <SecretModal
        {...defaultProps}
        targetNodeId={null}
        targetNodeLabel={undefined}
        initialSecret={null}
      />
    );

    // Focus tagify input to open dropdown
    const tagInput = screen.getByPlaceholderText(/Attach component/i);
    fireEvent.focus(tagInput);

    // Verify only 1 suggestion exists for the 10 replica pods
    const suggestion = screen.getByTestId('tagify-suggestion-pod-group:auth-svc-5x6y7');
    expect(suggestion).toBeInTheDocument();
    expect(suggestion).toHaveTextContent('auth-svc-5x6y7');

    // Click to attach the pod group
    fireEvent.mouseDown(suggestion);

    // Verify only 1 tag is rendered in Related Components
    expect(screen.getByTestId('attached-component-tag-pod-group:auth-svc-5x6y7')).toBeInTheDocument();

    // Verify updateNodeData was called for all 10 replica pods
    expect(mockUpdateNodeData).toHaveBeenCalledTimes(10);
    replicaPods.forEach((p) => {
      expect(mockUpdateNodeData).toHaveBeenCalledWith(
        p.id,
        expect.objectContaining({
          secrets: [expect.objectContaining({ resourceName: 'auth-svc-5x6y7' })],
        })
      );
    });

    // Remove the group tag
    mockUpdateNodeData.mockClear();
    const removeBtn = screen.getByTestId('remove-component-tag-pod-group:auth-svc-5x6y7');
    fireEvent.click(removeBtn);

    // Verify tag is removed and all 10 replica pods have Secret detached
    expect(screen.queryByTestId('attached-component-tag-pod-group:auth-svc-5x6y7')).not.toBeInTheDocument();
    expect(mockUpdateNodeData).toHaveBeenCalledTimes(10);
    replicaPods.forEach((p) => {
      expect(mockUpdateNodeData).toHaveBeenCalledWith(p.id, { secrets: [] });
    });
  });

  it('prefills single group tag when opened from a specific replica node', () => {
    const replicaPods = Array.from({ length: 5 }, (_, i) => ({
      id: `pod-rep-${i + 1}`,
      type: 'Pod',
      position: { x: 0, y: i * 50 },
      data: {
        baseName: 'payment-sec-svc',
        podHash: '9z8y7',
        replicaSuffix: `suf0${i}`,
        label: `payment-sec-svc-9z8y7-suf0${i}`,
        secrets: [],
      },
    }));

    useFlowStore.setState({
      nodes: replicaPods as any,
      addLog: vi.fn(),
    });

    render(
      <SecretModal
        {...defaultProps}
        targetNodeId="pod-rep-2"
        targetNodeLabel="payment-sec-svc-9z8y7-suf01"
        initialSecret={null}
      />
    );

    // Prefilled tag should represent the group, not individual replica
    const tag = screen.getByTestId('attached-component-tag-pod-group:payment-sec-svc-9z8y7');
    expect(tag).toBeInTheDocument();
    expect(tag).toHaveTextContent('payment-sec-svc-9z8y7');
    expect(screen.queryByTestId('attached-component-tag-pod-rep-2')).not.toBeInTheDocument();
  });

  it('allows importing data from existing secrets via Use Existing dropdown', () => {
    useFlowStore.setState({
      nodes: [
        {
          id: 'node-other',
          type: 'Deployment',
          position: { x: 0, y: 0 },
          data: {
            label: 'auth-deploy',
            secrets: [
              {
                id: 'sec-existing-src',
                name: 'jwt-tokens',
                type: 'Opaque',
                secretData: [
                  { key: 'JWT_SECRET', value: 'my-super-secret' },
                  { key: 'EXPIRES_IN', value: '3600' },
                ],
              },
            ],
          },
        },
      ],
      addLog: vi.fn(),
    });

    render(<SecretModal {...defaultProps} initialSecret={null} />);

    // Click Use Existing button
    const importBtn = screen.getByTestId('btn-add-from-existing-sec');
    expect(importBtn).toHaveTextContent('Use Existing');
    fireEvent.click(importBtn);

    // Verify dropdown menu opens with name and key count
    expect(screen.getByTestId('import-existing-sec-menu')).toBeInTheDocument();
    const option = screen.getByTestId('import-option-jwt-tokens');
    expect(option).toBeInTheDocument();
    expect(option).toHaveTextContent('jwt-tokens');
    expect(option).toHaveTextContent('2 keys');

    // Click option to import
    fireEvent.click(option);

    // Verify name and keys were loaded into form
    expect(screen.getByDisplayValue('jwt-tokens')).toBeInTheDocument();
    expect(screen.getByDisplayValue('JWT_SECRET')).toBeInTheDocument();
    expect(screen.getByDisplayValue('my-super-secret')).toBeInTheDocument();
    expect(screen.getByDisplayValue('EXPIRES_IN')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3600')).toBeInTheDocument();
  });

  it('renders directly in list view when initialViewMode is list and handles navigation and delete', () => {
    const mockUpdateNodeData = vi.fn();
    const existingSecret: K8sSecretItem = {
      id: 'sec-db',
      name: 'db-credentials',
      type: 'Opaque',
      secretData: [{ key: 'PASSWORD', value: 'supersecret' }],
    };

    useFlowStore.setState({
      nodes: [
        {
          id: 'pod-db',
          type: 'Pod',
          position: { x: 0, y: 0 },
          data: {
            label: 'db-pod',
            secrets: [existingSecret],
          },
        },
      ] as any,
      updateNodeData: mockUpdateNodeData,
      addLog: vi.fn(),
    });

    render(
      <SecretModal
        {...defaultProps}
        targetNodeId="cluster-storage"
        targetNodeLabel="Cluster Secrets"
        initialSecret={null}
        initialViewMode="list"
      />
    );

    // In list view
    expect(screen.getByText('Cluster Secrets Overview')).toBeInTheDocument();
    expect(screen.getByText('db-credentials')).toBeInTheDocument();
    expect(screen.getByTestId('sec-resource-sec-db')).toHaveTextContent('Pod:db-pod');

    // Click Edit on the secret
    fireEvent.click(screen.getByTitle('Edit Secret db-credentials'));

    // Should now be in form view
    expect(screen.getByRole('heading', { name: 'Edit Secret' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('db-credentials')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PASSWORD')).toBeInTheDocument();
    expect(screen.getByDisplayValue('supersecret')).toBeInTheDocument();

    // Click Back to return to list view via header back button
    fireEvent.click(screen.getByTestId('secret-header-back-button'));
    expect(screen.getByText('Cluster Secrets Overview')).toBeInTheDocument();

    // Click + Add Secret from list view
    fireEvent.click(screen.getByRole('button', { name: '+ Add Secret' }));
    expect(screen.getByRole('heading', { name: 'Attach Secret' })).toBeInTheDocument();

    // Click Back via footer back button
    fireEvent.click(screen.getByTestId('secret-back-button'));
    expect(screen.getByText('Cluster Secrets Overview')).toBeInTheDocument();

    // Delete item from list
    fireEvent.click(screen.getByTitle('Delete Secret db-credentials'));
    expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-db', { secrets: [] });

    // Close modal via Close button
    fireEvent.click(screen.getByTestId('secret-list-close-button'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('displays standalone Secret from savedSecrets in list and provides it in Use Existing dropdown', () => {
    const mockDeleteSavedSecret = vi.fn();
    useFlowStore.setState({
      nodes: [],
      savedSecrets: [
        {
          id: 'sec-saved-1',
          name: 'standalone-saved-sec',
          type: 'Opaque',
          secretData: [{ key: 'API_KEY', value: 'xyz123' }],
        },
      ],
      deleteSavedSecret: mockDeleteSavedSecret,
    });

    render(
      <SecretModal
        {...defaultProps}
        targetNodeId="cluster-storage"
        targetNodeLabel="Cluster Secrets"
        initialSecret={null}
        initialViewMode="list"
      />
    );

    // Standalone secret appears in overview
    expect(screen.getByText('standalone-saved-sec')).toBeInTheDocument();
    expect(screen.getByTestId('sec-resource-sec-saved-1')).toHaveTextContent('-');

    // Click + Add Secret to go to form mode
    fireEvent.click(screen.getByRole('button', { name: '+ Add Secret' }));
    expect(screen.getByRole('heading', { name: 'Attach Secret' })).toBeInTheDocument();

    // Use Existing button should be present because savedSecrets has an item
    const useExistingBtn = screen.getByTestId('btn-add-from-existing-sec');
    expect(useExistingBtn).toBeInTheDocument();
    fireEvent.click(useExistingBtn);

    // Click on the option to import
    const option = screen.getByTestId('import-option-standalone-saved-sec');
    expect(option).toBeInTheDocument();
    fireEvent.click(option);

    // Name and data should now be loaded
    expect(screen.getByDisplayValue('standalone-saved-sec')).toBeInTheDocument();
    expect(screen.getByDisplayValue('API_KEY')).toBeInTheDocument();
    expect(screen.getByDisplayValue('xyz123')).toBeInTheDocument();

    // Go back to list and delete the standalone secret
    fireEvent.click(screen.getByTestId('secret-back-button'));
    fireEvent.click(screen.getByTitle('Delete Secret standalone-saved-sec'));
    expect(mockDeleteSavedSecret).toHaveBeenCalledWith('sec-saved-1');
  });
});
