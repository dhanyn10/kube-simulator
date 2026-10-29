import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigMapModal, findAllAttachedComponents, syncNodesConfigMap, mergeAttachedComponents } from '@/components/Modals/ConfigMapModal';
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
    expect(screen.getByTestId('configmap-name-input')).toHaveValue('');
    expect(screen.getByText(/No key-value pairs added/i)).toBeInTheDocument();
  });

  it('renders initialConfigMap data correctly when passed', () => {
    const initialConfigMap: K8sConfigMapItem = {
      id: 'cm-123',
      name: 'existing-config',
      configData: [{ key: 'PORT', value: '8080' }, { key: 'MAX_CONNECTIONS', value: '500' }, { key: 'LOG_LEVEL', value: 'WARN' }, { key: 'CHAOS_MODE', value: 'disabled' }],
    };

    render(<ConfigMapModal {...defaultProps} initialConfigMap={initialConfigMap} />);

    expect(screen.getByRole('heading', { name: 'Edit ConfigMap' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('existing-config')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8080')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
  });

  it('renders Kube Console style portal autocomplete dropdown popup when focusing inputs', () => {
    render(<ConfigMapModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Row/i }));

    const keyInput = screen.getByLabelText('Key');
    fireEvent.focus(keyInput);

    expect(screen.getByTestId('key-option-MAX_CONNECTIONS')).toBeInTheDocument();

    // Select option from portal dropdown
    fireEvent.mouseDown(screen.getByTestId('key-option-MAX_CONNECTIONS'));
    expect(keyInput).toHaveValue('MAX_CONNECTIONS');
  });

  it('calls onSave and returns to Cluster ConfigMaps Overview list view instead of closing modal', () => {
    render(<ConfigMapModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Row/i }));

    const keyInput = screen.getByLabelText('Key');
    const valueInput = screen.getByLabelText('Value');

    fireEvent.change(keyInput, { target: { value: 'PORT' } });
    fireEvent.change(valueInput, { target: { value: '80' } });

    const nameInput = screen.getByPlaceholderText('e.g. app-config');
    fireEvent.change(nameInput, { target: { value: 'my Custom-CM! ' } });

    const saveButton = screen.getByRole('button', { name: 'Attach ConfigMap' });
    fireEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        name: 'my-custom-cm',
        configData: [{ key: 'PORT', value: '80' }],
      })
    );
    expect(screen.getByText('Cluster ConfigMaps Overview')).toBeInTheDocument();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('renders in light color mode correctly with default subtitle and light dropdown options', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<ConfigMapModal {...defaultProps} targetNodeLabel={undefined} />);

    expect(screen.getByRole('heading', { name: 'Attach ConfigMap' })).toBeInTheDocument();
    expect(screen.getByText('Configure Key-Value Data')).toBeInTheDocument();

    // Add row in light mode
    fireEvent.click(screen.getByRole('button', { name: /Add Row/i }));

    const keyInput = screen.getByLabelText('Key');
    const valInput = screen.getByLabelText('Value');
    expect(keyInput.className).toContain('text-slate-800');
    expect(valInput.className).toContain('text-slate-900');

    // Focus key input to open portal in light mode
    fireEvent.focus(keyInput);

    const portal = document.getElementById('configmap-autocomplete-portal');
    expect(portal).not.toBeNull();
    expect(portal?.className).toContain('bg-white');

    const keyOption = screen.getByTestId('key-option-PORT');
    expect(keyOption.className).toContain('hover:bg-blue-50');

    // Badge text in light mode
    const badge = keyOption.querySelector('span.uppercase');
    expect(badge?.className).toContain('bg-slate-100');

    fireEvent.mouseEnter(keyOption);
    fireEvent.mouseDown(keyOption);
    expect(keyInput).toHaveValue('PORT');
  });

  it('handles focusing value input, selecting value option from portal, hovering portal items, and removing rows', () => {
    render(<ConfigMapModal {...defaultProps} />);

    // Add a row
    fireEvent.click(screen.getByRole('button', { name: /Add Row/i }));

    // Focus key input to open key autocomplete portal
    const keyInput = screen.getByLabelText('Key');
    fireEvent.focus(keyInput);

    const keyOption = screen.getByTestId('key-option-LOG_LEVEL');
    fireEvent.mouseEnter(keyOption);
    fireEvent.mouseDown(keyOption);
    expect(keyInput).toHaveValue('LOG_LEVEL');

    // Focus value input to open value autocomplete portal
    const valInput = screen.getByLabelText('Value');
    fireEvent.focus(valInput);

    const valOption = screen.getByTestId('val-option-INFO');
    fireEvent.mouseEnter(valOption);
    fireEvent.mouseDown(valOption);
    expect(valInput).toHaveValue('INFO');

    // Remove row
    fireEvent.click(screen.getByTitle('Remove row'));
    expect(screen.queryByLabelText('Key')).not.toBeInTheDocument();
  });

  it('handles navigation between form view and list view via Back button', () => {
    useFlowStore.setState({
      nodes: [{ id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod', configMaps: [{ id: 'cm-web', name: 'web-config', configData: [{ key: 'ENV', value: 'prod' }] }] } }],
      savedConfigMaps: [{ id: 'cm-db', name: 'db-config', configData: [{ key: 'PORT', value: '5432' }] }],
    });

    render(<ConfigMapModal {...defaultProps} initialConfigMap={{ id: 'cm-web', name: 'web-config', configData: [] }} />);

    // Initially in form mode
    expect(screen.getByRole('heading', { name: 'Edit ConfigMap' })).toBeInTheDocument();
    expect(screen.getByTestId('configmap-back-button')).toBeInTheDocument();

    // Click Back button in footer
    fireEvent.click(screen.getByTestId('configmap-back-button'));

    // Should now be in list mode
    expect(screen.getByText('Cluster ConfigMaps Overview')).toBeInTheDocument();
    expect(screen.getByText('web-config')).toBeInTheDocument();
    expect(screen.getByText('db-config')).toBeInTheDocument();
    expect(screen.getByText('web-pod')).toBeInTheDocument();
    expect(screen.queryByText('Cluster Storage')).not.toBeInTheDocument();
    expect(screen.getByTestId('cm-profile-cm-web')).toHaveTextContent(/Profile:autosave-/);
    expect(screen.getByTestId('cm-resource-cm-web')).toHaveTextContent('Pod:web-pod');
    expect(screen.getByTestId('cm-resource-cm-db')).toHaveTextContent('-');

    // Click Edit on db-config item
    fireEvent.click(screen.getByTitle('Edit ConfigMap db-config'));

    // Should now be back in form mode with db-config loaded
    expect(screen.getByDisplayValue('db-config')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5432')).toBeInTheDocument();

    // Click header back button
    fireEvent.click(screen.getByTestId('configmap-header-back-button'));
    expect(screen.getByText('Cluster ConfigMaps Overview')).toBeInTheDocument();

    // Click + Add ConfigMap from list mode
    fireEvent.click(screen.getByText('+ Add ConfigMap'));
    expect(screen.getByDisplayValue(/^cm-/)).toBeInTheDocument();
  });

  it('renders directly in list view when initialViewMode is list and handles delete', () => {
    const mockUpdateNodeData = vi.fn();
    const mockDeleteSavedConfigMap = vi.fn();

    useFlowStore.setState({
      nodes: [{ id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod', configMaps: [{ id: 'cm-web', name: 'web-config', configData: [] }] } }],
      savedConfigMaps: [],
      updateNodeData: mockUpdateNodeData,
      deleteSavedConfigMap: mockDeleteSavedConfigMap,
      addLog: vi.fn(),
    });

    render(<ConfigMapModal {...defaultProps} initialViewMode="list" />);

    expect(screen.getByText('Cluster ConfigMaps Overview')).toBeInTheDocument();
    expect(screen.getByText('web-config')).toBeInTheDocument();

    // Delete item
    fireEvent.click(screen.getByTitle('Delete ConfigMap web-config'));
    expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-1', { configMaps: [] });
    expect(mockDeleteSavedConfigMap).toHaveBeenCalledWith('cm-web');
  });

  it('navigates from list view to single profile precedence view when clicking profile badge, and navigates back to list view', () => {
    useFlowStore.setState({
      nodes: [{ id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod', configMaps: [{ id: 'cm-web', name: 'web-config', profileName: 'staging-profile', configData: [{ key: 'PORT', value: '8080' }] }] } }],
      savedConfigMaps: [],
    });

    render(<ConfigMapModal {...defaultProps} initialViewMode="list" />);

    // Starts in list view
    expect(screen.getByText('Cluster ConfigMaps Overview')).toBeInTheDocument();

    // Click profile badge button in table
    const profileBadge = screen.getByTestId('cm-profile-cm-web');
    expect(profileBadge).toBeInTheDocument();
    fireEvent.click(profileBadge);

    // Now in single profile precedence view
    expect(screen.getByText(/ConfigMap Profile — staging-profile/i)).toBeInTheDocument();
    expect(screen.getByTestId('configmap-precedence-view')).toBeInTheDocument();
    expect(screen.getByTestId('cm-id-cm-web')).toHaveTextContent('web-config');

    // Click Back to ConfigMap list
    const backBtn = screen.getByTestId('configmap-profile-back-button');
    fireEvent.click(backBtn);

    // Returns to list view
    expect(screen.getByText('Cluster ConfigMaps Overview')).toBeInTheDocument();
  });

  it('handles removing the attached component from the ConfigMap in detail view like Tagify', () => {
    const mockUpdateNodeData = vi.fn();
    useFlowStore.setState({
      nodes: [{ id: 'node-dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'api-server', configMaps: [{ id: 'cm-api', name: 'api-config', configData: [{ key: 'PORT', value: '3000' }] }] } }],
      savedConfigMaps: [],
      updateNodeData: mockUpdateNodeData,
      addLog: vi.fn(),
    });

    render(
      <ConfigMapModal
        {...defaultProps}
        targetNodeId="node-dep-1"
        targetNodeLabel="api-server"
        initialConfigMap={{
          id: 'cm-api',
          name: 'api-config',
          configData: [{ key: 'PORT', value: '3000' }],
        }}
      />
    );

    // Initial attached component tag is visible
    expect(screen.getByTestId('attached-component-tag-node-dep-1')).toHaveTextContent('Deployment:api-server');

    // Click Tagify X remove button on the tag
    const removeBtn = screen.getByTestId('remove-component-tag-node-dep-1');
    fireEvent.click(removeBtn);

    // Expect node update to remove the configMap
    expect(mockUpdateNodeData).toHaveBeenCalledWith('node-dep-1', { configMaps: [] });

    // Expect tag to be removed from the container
    expect(screen.queryByTestId('attached-component-tag-node-dep-1')).not.toBeInTheDocument();
  });

  it('handles attaching to a component from Tagify suggestions in detail view', () => {
    const mockUpdateNodeData = vi.fn();
    useFlowStore.setState({
      nodes: [{ id: 'pod-worker', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'worker-pod', configMaps: [] } }],
      savedConfigMaps: [],
      updateNodeData: mockUpdateNodeData,
      addLog: vi.fn(),
    });

    render(
      <ConfigMapModal
        {...defaultProps}
        targetNodeId="cluster-storage"
        targetNodeLabel="Cluster ConfigMaps"
        initialConfigMap={{
          id: 'cm-worker',
          name: 'worker-config',
          configData: [{ key: 'QUEUE', value: 'redis' }],
        }}
      />
    );

    // Focus Tagify input to open suggestions
    const input = screen.getByPlaceholderText('Attach component (e.g. Deployment, Pod)...');
    fireEvent.focus(input);

    expect(screen.getByTestId('tagify-suggestions-dropdown')).toBeInTheDocument();

    // Select pod-worker from Tagify dropdown
    fireEvent.mouseDown(screen.getByTestId('tagify-suggestion-pod-worker'));

    // Expect node update to receive the configMap
    expect(mockUpdateNodeData).toHaveBeenCalledWith(
      'pod-worker',
      expect.objectContaining({
        configMaps: expect.arrayContaining([
          expect.objectContaining({ name: 'worker-config' }),
        ]),
      })
    );

    // Expect attached component tag to be rendered
    expect(screen.getByTestId('attached-component-tag-pod-worker')).toHaveTextContent('Pod:worker-pod');
  });

  it('handles using existing ConfigMap data and profile via Use Existing button', () => {
    useFlowStore.setState({
      nodes: [],
      savedConfigMaps: [{ id: 'cm-source', name: 'source-config', profileName: 'Production', configData: [{ key: 'DB_HOST', value: 'postgres' }, { key: 'DB_PORT', value: '5432' }] }],
      addLog: vi.fn(),
    });

    render(
      <ConfigMapModal
        {...defaultProps}
        initialConfigMap={{
          id: 'cm-new',
          name: 'new-config',
          configData: [{ key: 'INIT', value: 'true' }],
        }}
      />
    );

    // Click Use Existing button
    const importBtn = screen.getByTestId('btn-add-from-existing-cm');
    expect(importBtn).toHaveTextContent('Use Existing');
    fireEvent.click(importBtn);

    // Verify dropdown menu opens
    expect(screen.getByTestId('import-existing-cm-menu')).toBeInTheDocument();
    expect(screen.queryByText('Select Existing ConfigMap')).toBeNull();
    expect(screen.queryByText('Use')).toBeNull();
    expect(screen.getByTestId('import-option-source-config')).toBeInTheDocument();
    expect(screen.getByTestId('import-option-source-config')).toHaveTextContent('source-config');
    expect(screen.getByTestId('import-option-source-config')).toHaveTextContent('2 keys');

    // Click source-config option
    fireEvent.click(screen.getByTestId('import-option-source-config'));

    // Check that source ConfigMap name, profile, and key-values now appear in the form
    expect(screen.getByDisplayValue('source-config')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DB_HOST')).toBeInTheDocument();
    expect(screen.getByDisplayValue('postgres')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DB_PORT')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5432')).toBeInTheDocument();
  });

  it('prefills target component when modal is opened on a target card (e.g. drag-drop onto component)', () => {
    const mockOnSave = vi.fn();
    useFlowStore.setState({
      nodes: [{ id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod', configMaps: [] } }],
      savedConfigMaps: [],
    });

    render(
      <ConfigMapModal
        {...defaultProps}
        targetNodeId="pod-1"
        targetNodeLabel="web-pod"
        initialConfigMap={null}
        onSave={mockOnSave}
      />
    );

    // Target component should be prefilled directly as an attached tag
    expect(screen.getByTestId('attached-component-tag-pod-1')).toHaveTextContent('Pod:web-pod');

    // Add row and save
    fireEvent.click(screen.getByRole('button', { name: /Add Row/i }));
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'CUSTOM_KEY' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'custom_val' } });

    fireEvent.click(screen.getByRole('button', { name: 'Attach ConfigMap' }));

    // Saved item must have resourceName and resourceType pointing to web-pod
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.any(String),
        resourceName: 'web-pod',
        resourceType: 'Pod',
        configData: [{ key: 'CUSTOM_KEY', value: 'custom_val' }],
      })
    );
  });

  it('leaves attached components empty when adding from cluster storage (targetNodeId = cluster-storage)', () => {
    const mockOnSave = vi.fn();
    useFlowStore.setState({
      nodes: [{ id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod', configMaps: [] } }],
      savedConfigMaps: [],
    });

    render(
      <ConfigMapModal
        {...defaultProps}
        targetNodeId="cluster-storage"
        targetNodeLabel="Cluster Storage"
        initialConfigMap={null}
        onSave={mockOnSave}
      />
    );

    // No default component should be attached
    expect(screen.queryByTestId('attached-component-tag-pod-1')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Attach component (e.g. Deployment, Pod)...')).toBeInTheDocument();
  });

  it('disassociates component when tag is removed and user clicks Save', () => {
    const mockUpdateNodeData = vi.fn();
    const mockOnSave = vi.fn();
    useFlowStore.setState({
      nodes: [
        {
          id: 'node-dep-1',
          type: 'Deployment',
          position: { x: 0, y: 0 },
          data: {
            label: 'api-server',
            configMaps: [{ id: 'cm-api', name: 'api-config', configData: [{ key: 'PORT', value: '3000' }] }],
          },
        },
      ],
      savedConfigMaps: [],
      updateNodeData: mockUpdateNodeData,
      addLog: vi.fn(),
    });

    render(
      <ConfigMapModal
        {...defaultProps}
        targetNodeId="node-dep-1"
        targetNodeLabel="api-server"
        initialConfigMap={{
          id: 'cm-api',
          name: 'api-config',
          configData: [{ key: 'PORT', value: '3000' }],
        }}
        onSave={mockOnSave}
      />
    );

    // Remove the component tag
    const removeBtn = screen.getByTestId('remove-component-tag-node-dep-1');
    fireEvent.click(removeBtn);

    // Save changes
    const saveBtn = screen.getByRole('button', { name: 'Update ConfigMap' });
    fireEvent.click(saveBtn);

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cm-api',
        name: 'api-config',
        resourceName: '',
        resourceType: undefined,
      })
    );
  });

  describe('findAllAttachedComponents helper', () => {
    it('returns empty array when neither cmId nor cmName is provided', () => {
      const result = findAllAttachedComponents(undefined, undefined, []);
      expect(result).toHaveLength(0);
    });

    it('matches node with configMaps array containing cmId or cmName', () => {
      const nodes = [
        { id: 'pod-1', type: 'Pod', data: { label: 'pod-1', configMaps: [{ id: 'cm-1', name: 'my-cm' }] } },
        { id: 'pod-2', type: 'Pod', data: { label: 'pod-2', configMaps: [] } },
      ];
      const result = findAllAttachedComponents('cm-1', 'my-cm', nodes);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pod-1');
    });

    it('falls back to resourceName if node does not have configMaps array defined', () => {
      const nodes = [
        { id: 'pod-3', type: 'Pod', data: { label: 'pod-3' } },
      ];
      const result = findAllAttachedComponents('cm-x', 'x-cm', nodes, 'pod-3');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pod-3');
    });

    it('does NOT fallback to resourceName if node has configMaps array and CM was removed', () => {
      const nodes = [
        { id: 'pod-4', type: 'Pod', data: { label: 'pod-4', configMaps: [] } },
      ];
      const result = findAllAttachedComponents('cm-x', 'x-cm', nodes, 'pod-4');
      expect(result).toHaveLength(0);
    });

    it('matches comma-separated resource names when fallback applies', () => {
      const nodes = [
        { id: 'pod-a', type: 'Pod', data: { label: 'pod-a' } },
        { id: 'pod-b', type: 'Pod', data: { label: 'pod-b' } },
      ];
      const result = findAllAttachedComponents('cm-multi', 'multi-cm', nodes, 'pod-a, pod-b');
      expect(result).toHaveLength(2);
    });
  });

  describe('syncNodesConfigMap helper', () => {
    it('synchronizes attached and detached nodes correctly', () => {
      const updateNodeData = vi.fn();
      const cmItem = { id: 'cm-1', name: 'app-cm', configData: [] };
      const nodes = [
        { id: 'node-keep', data: { configMaps: [cmItem] } },
        { id: 'node-remove', data: { configMaps: [cmItem] } },
        { id: 'node-add', data: { configMaps: [] } },
      ];
      const attachedIds = new Set(['node-keep', 'node-add']);

      syncNodesConfigMap(nodes, 'cm-1', 'app-cm', undefined, cmItem, attachedIds, updateNodeData);

      expect(updateNodeData).toHaveBeenCalledWith('node-keep', { configMaps: [cmItem] });
      expect(updateNodeData).toHaveBeenCalledWith('node-remove', { configMaps: [] });
      expect(updateNodeData).toHaveBeenCalledWith('node-add', { configMaps: [cmItem] });
    });
  });

  it('does not bring back the target component when user removed it and then clicked Use Existing', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'web-pod', configMaps: [] } },
      ],
      savedConfigMaps: [
        { id: 'cm-redis', name: 'redis-config', configData: [{ key: 'PORT', value: '6379' }] },
      ],
      addLog: vi.fn(),
    });

    render(
      <ConfigMapModal
        {...defaultProps}
        targetNodeId="pod-1"
        targetNodeLabel="web-pod"
        initialConfigMap={null}
      />
    );

    // Initial prefilled tag
    expect(screen.getByTestId('attached-component-tag-pod-1')).toBeInTheDocument();

    // Remove the component tag
    fireEvent.click(screen.getByTestId('remove-component-tag-pod-1'));
    expect(screen.queryByTestId('attached-component-tag-pod-1')).not.toBeInTheDocument();

    // Click Use Existing
    fireEvent.click(screen.getByTestId('btn-add-from-existing-cm'));
    fireEvent.click(screen.getByTestId('import-option-redis-config'));

    // Verify tag did NOT come back
    expect(screen.queryByTestId('attached-component-tag-pod-1')).not.toBeInTheDocument();
  });

  it('displays read-only ConfigMap ID input in edit mode and hides it in create mode', () => {
    // 1. Create mode (initialConfigMap is null)
    const { unmount } = render(<ConfigMapModal {...defaultProps} initialConfigMap={null} />);
    expect(screen.queryByTestId('configmap-id-input')).not.toBeInTheDocument();
    unmount();

    // 2. Edit mode (initialConfigMap is provided)
    render(
      <ConfigMapModal
        {...defaultProps}
        initialConfigMap={{ id: 'cm-edit-99', name: 'my-service-config', configData: [] }}
      />
    );
    const idInput = screen.getByTestId('configmap-id-input');
    expect(idInput).toBeInTheDocument();
    expect(idInput).toHaveValue('cm-edit-99');
    expect(idInput).toHaveAttribute('readonly');
    expect(idInput).toBeDisabled();

    // ConfigMap Name input displays existing name
    const nameInput = screen.getByTestId('configmap-name-input');
    expect(nameInput).toHaveValue('my-service-config');
  });

  it('defaults name to generated ID when user leaves ConfigMap Name empty on save', () => {
    const mockOnSave = vi.fn();
    render(<ConfigMapModal {...defaultProps} initialConfigMap={null} onSave={mockOnSave} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Row/i }));
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'API_KEY' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'secret123' } });

    // Ensure name input is empty
    const nameInput = screen.getByTestId('configmap-name-input');
    fireEvent.change(nameInput, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Attach ConfigMap' }));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^cm-/),
        name: expect.stringMatching(/^cm-/),
        configData: [{ key: 'API_KEY', value: 'secret123' }],
      })
    );
    const savedArg = mockOnSave.mock.calls[0][0];
    expect(savedArg.name).toBe(savedArg.id);
  });

  describe('mergeAttachedComponents helper', () => {
    it('merges current attached components with sourceCm components without forcing removed components', () => {
      const currentAttached = [{ id: 'dep-1', label: 'api-dep', type: 'Deployment' }];
      const sourceCm = {
        id: 'cm-1',
        name: 'app-cm',
        configData: [],
        resourceName: 'worker-pod',
      };
      const nodes = [
        { id: 'worker-pod', type: 'Pod', data: { label: 'worker-pod' } },
        { id: 'target-svc', type: 'Service', data: { label: 'my-service' } },
      ];

      const result = mergeAttachedComponents(currentAttached, sourceCm, nodes);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual(['dep-1', 'worker-pod']);
    });
  });

  describe('Pod replica group deduplication', () => {
    it('deduplicates multiple replica pods sharing baseName and podHash in findAllAttachedComponents', () => {
      const cmItem = { id: 'cm-multi', name: 'multi-cm', configData: [] };
      const replicaPods = Array.from({ length: 10 }, (_, i) => ({
        id: `pod-replica-${i + 1}`,
        type: 'Pod',
        data: {
          baseName: 'web-pod',
          podHash: '7f9b2',
          replicaSuffix: `suf0${i}`,
          label: `web-pod-7f9b2-suf0${i}`,
          configMaps: [cmItem],
        },
      }));

      const otherPod = {
        id: 'pod-other',
        type: 'Pod',
        data: {
          baseName: 'worker',
          podHash: 'a1b2c',
          replicaSuffix: 'xyz01',
          label: 'worker-a1b2c-xyz01',
          configMaps: [cmItem],
        },
      };

      const result = findAllAttachedComponents('cm-multi', 'multi-cm', [...replicaPods, otherPod]);
      // Should collapse 10 web-pod replicas into 1 group, plus 1 worker group = 2
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.label)).toEqual(['web-pod-7f9b2', 'worker-a1b2c']);
      expect(result[0].id).toBe('pod-group:web-pod-7f9b2');
      expect(result[1].id).toBe('pod-group:worker-a1b2c');
    });

    it('syncNodesConfigMap updates all replicas in the group when groupKey is attached or detached', () => {
      const updateNodeData = vi.fn();
      const cmItem = { id: 'cm-group', name: 'group-cm', configData: [] };
      const replicaPods = Array.from({ length: 5 }, (_, i) => ({
        id: `pod-${i + 1}`,
        type: 'Pod',
        data: {
          baseName: 'api-service',
          podHash: '9x8y7',
          replicaSuffix: `rep0${i}`,
          label: `api-service-9x8y7-rep0${i}`,
          configMaps: [],
        },
      }));

      // 1. Attach group
      const attachedIds = new Set(['pod-group:api-service-9x8y7']);
      syncNodesConfigMap(replicaPods, 'cm-group', 'group-cm', undefined, cmItem, attachedIds, updateNodeData);
      expect(updateNodeData).toHaveBeenCalledTimes(5);
      replicaPods.forEach((p) => {
        expect(updateNodeData).toHaveBeenCalledWith(p.id, { configMaps: [cmItem] });
      });

      // 2. Detach group
      updateNodeData.mockClear();
      const attachedPodsWithCm = replicaPods.map((p) => ({
        ...p,
        data: { ...p.data, configMaps: [cmItem] },
      }));
      syncNodesConfigMap(attachedPodsWithCm, 'cm-group', 'group-cm', undefined, cmItem, new Set(), updateNodeData);
      expect(updateNodeData).toHaveBeenCalledTimes(5);
      replicaPods.forEach((p) => {
        expect(updateNodeData).toHaveBeenCalledWith(p.id, { configMaps: [] });
      });
    });

    it('displays only one suggestion in dropdown for 10 replica pods and attaches to all replicas', () => {
      const mockUpdateNodeData = vi.fn();
      const replicaPods = Array.from({ length: 10 }, (_, i) => ({
        id: `pod-web-${i + 1}`,
        type: 'Pod',
        position: { x: 0, y: i * 50 },
        data: {
          baseName: 'web-app',
          podHash: '3k4l5',
          replicaSuffix: `suf0${i}`,
          label: `web-app-3k4l5-suf0${i}`,
          configMaps: [],
        },
      }));

      useFlowStore.setState({
        nodes: replicaPods as any,
        updateNodeData: mockUpdateNodeData,
        savedConfigMaps: [],
        addLog: vi.fn(),
      });

      render(
        <ConfigMapModal
          {...defaultProps}
          targetNodeId={null}
          targetNodeLabel={undefined}
          initialConfigMap={null}
        />
      );

      // Focus the tagify input to open dropdown
      const tagInput = screen.getByPlaceholderText(/Attach component/i);
      fireEvent.focus(tagInput);

      // Verify only 1 suggestion exists for the 10 replica pods
      const suggestion = screen.getByTestId('tagify-suggestion-pod-group:web-app-3k4l5');
      expect(suggestion).toBeInTheDocument();
      expect(suggestion).toHaveTextContent('web-app-3k4l5');
      expect(screen.queryAllByText(/web-app-3k4l5/)).toHaveLength(1);

      // Click to attach the pod group
      fireEvent.mouseDown(suggestion);

      // Verify only 1 tag is rendered in Related Components
      expect(screen.getByTestId('attached-component-tag-pod-group:web-app-3k4l5')).toBeInTheDocument();

      // Verify updateNodeData was called for all 10 replica pods
      expect(mockUpdateNodeData).toHaveBeenCalledTimes(10);
      replicaPods.forEach((p) => {
        expect(mockUpdateNodeData).toHaveBeenCalledWith(
          p.id,
          expect.objectContaining({
            configMaps: [expect.objectContaining({ resourceName: 'web-app-3k4l5' })],
          })
        );
      });

      // Remove the group tag
      mockUpdateNodeData.mockClear();
      const removeBtn = screen.getByTestId('remove-component-tag-pod-group:web-app-3k4l5');
      fireEvent.click(removeBtn);

      // Verify tag is removed and all 10 replica pods have CM detached
      expect(screen.queryByTestId('attached-component-tag-pod-group:web-app-3k4l5')).not.toBeInTheDocument();
      expect(mockUpdateNodeData).toHaveBeenCalledTimes(10);
      replicaPods.forEach((p) => {
        expect(mockUpdateNodeData).toHaveBeenCalledWith(p.id, { configMaps: [] });
      });
    });

    it('prefills single group tag when opened from a specific replica node', () => {
      const replicaPods = Array.from({ length: 5 }, (_, i) => ({
        id: `pod-rep-${i + 1}`,
        type: 'Pod',
        position: { x: 0, y: i * 50 },
        data: {
          baseName: 'payment-svc',
          podHash: '8h9j0',
          replicaSuffix: `suf0${i}`,
          label: `payment-svc-8h9j0-suf0${i}`,
          configMaps: [],
        },
      }));

      useFlowStore.setState({
        nodes: replicaPods as any,
        savedConfigMaps: [],
        addLog: vi.fn(),
      });

      // Target replica 3
      render(
        <ConfigMapModal
          {...defaultProps}
          targetNodeId="pod-rep-3"
          targetNodeLabel="payment-svc-8h9j0-suf02"
          initialConfigMap={null}
        />
      );

      // Prefilled tag should represent the group, not individual replica
      const tag = screen.getByTestId('attached-component-tag-pod-group:payment-svc-8h9j0');
      expect(tag).toBeInTheDocument();
      expect(tag).toHaveTextContent('payment-svc-8h9j0');
      expect(screen.queryByTestId('attached-component-tag-pod-rep-3')).not.toBeInTheDocument();
    });
  });
});
