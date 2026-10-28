import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AttachedResourceOverviewModal } from '@/components/Modals/AttachedResourceOverviewModal';
import { RESOURCE_TYPE_KEY_MAP } from '@/activities/modals/attachedResourceOverviewHelpers';
import { useFlowStore } from '@/store';
import { Node } from '@xyflow/react';

describe('AttachedResourceOverviewModal', () => {
  const mockNodes: Node[] = [
    {
      id: 'pod-1',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: {
        label: 'web-pod',
        configMaps: [{ id: 'cm-1', name: 'app-config', configData: [{ key: 'PORT', value: '3000' }, { key: 'MODE', value: 'test' }] }],
        secrets: [{ id: 'sec-1', name: 'app-secret', type: 'Opaque', secretData: [{ key: 'API_KEY', value: '12345' }] }],
        roles: [{ id: 'role-1', name: 'admin-role', rules: [{ resources: ['pods'], verbs: ['*'] }], assignedUsers: ['john'] }],
      },
    },
    {
      id: 'dep-1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: {
        label: 'backend-dep',
        hpas: [{ id: 'hpa-1', name: 'backend-hpa', minReplicas: 1, maxReplicas: 5, targetCPU: 80 }],
        resourceLimits: [{ id: 'res-1', name: 'backend-limits', cpuRequest: '100m', cpuLimit: '200m', memoryRequest: '64Mi', memoryLimit: '128Mi' }],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: mockNodes,
      colorMode: 'dark',
      updateNodeData: vi.fn(),
      addLog: vi.fn(),
      setConfigMapModalTargetNode: vi.fn(),
      setSecretModalTargetNode: vi.fn(),
      setRoleModalTargetNode: vi.fn(),
      setHpaModalTargetNode: vi.fn(),
      setResourceLimitModalTargetNode: vi.fn(),
    });
  });

  it('renders null when type is null', () => {
    const { container } = render(
      <AttachedResourceOverviewModal type={null} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders ConfigMap overview with items and handles search filtering', () => {
    render(<AttachedResourceOverviewModal type="ConfigMap" onClose={vi.fn()} />);

    expect(screen.getByText('Cluster ConfigMaps Overview')).toBeInTheDocument();
    expect(screen.getByText('app-config')).toBeInTheDocument();
    expect(screen.getByText('Attached to: web-pod (Pod)')).toBeInTheDocument();
    expect(screen.getByText('PORT:')).toBeInTheDocument();
    expect(screen.getByText('3000')).toBeInTheDocument();

    // Search filter
    const searchInput = screen.getByPlaceholderText(/Search ConfigMaps/i);
    fireEvent.change(searchInput, { target: { value: 'non-matching' } });
    expect(screen.queryByText('app-config')).not.toBeInTheDocument();
    expect(screen.getByText(/No ConfigMaps currently configured/i)).toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('app-config')).toBeInTheDocument();
  });

  it('handles edit and delete actions for ConfigMap', () => {
    const onClose = vi.fn();
    const updateNodeData = vi.fn();
    const setConfigMapModalTargetNode = vi.fn();
    useFlowStore.setState({ updateNodeData, setConfigMapModalTargetNode });

    render(<AttachedResourceOverviewModal type="ConfigMap" onClose={onClose} />);

    // Click Edit
    const editBtn = screen.getByTitle('Edit ConfigMap app-config');
    fireEvent.click(editBtn);
    expect(onClose).toHaveBeenCalled();
    expect(setConfigMapModalTargetNode).toHaveBeenCalledWith({
      id: 'pod-1',
      label: 'web-pod',
      initialItem: expect.objectContaining({ name: 'app-config' }),
    });

    // Click Delete
    const deleteBtn = screen.getByTitle('Delete ConfigMap app-config');
    fireEvent.click(deleteBtn);
    expect(updateNodeData).toHaveBeenCalledWith('pod-1', { configMaps: [] });
  });

  it('renders and edits Secret, Role, HPA, and ResourceLimit items', () => {
    const onClose = vi.fn();
    const setSecretModalTargetNode = vi.fn();
    const setRoleModalTargetNode = vi.fn();
    const setHpaModalTargetNode = vi.fn();
    const setResourceLimitModalTargetNode = vi.fn();
    useFlowStore.setState({
      setSecretModalTargetNode,
      setRoleModalTargetNode,
      setHpaModalTargetNode,
      setResourceLimitModalTargetNode,
      colorMode: 'light',
    });

    // 1. Secret
    const { rerender } = render(<AttachedResourceOverviewModal type="Secret" onClose={onClose} />);
    expect(screen.getByText('Cluster Secrets Overview')).toBeInTheDocument();
    expect(screen.getByText('app-secret')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Edit Secret app-secret'));
    expect(setSecretModalTargetNode).toHaveBeenCalledWith({
      id: 'pod-1',
      label: 'web-pod',
      initialItem: expect.objectContaining({ name: 'app-secret' }),
    });

    // 2. Role
    rerender(<AttachedResourceOverviewModal type="Role" onClose={onClose} />);
    expect(screen.getByText('Cluster RBAC Roles & RoleBindings Overview')).toBeInTheDocument();
    expect(screen.getByText('admin-role')).toBeInTheDocument();
    expect(screen.getByText('Bound Users: john')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Edit Role admin-role'));
    expect(setRoleModalTargetNode).toHaveBeenCalledWith({
      id: 'pod-1',
      label: 'web-pod',
      initialItem: expect.objectContaining({ name: 'admin-role' }),
    });

    // 3. HPA
    rerender(<AttachedResourceOverviewModal type="HPA" onClose={onClose} />);
    expect(screen.getByText('Cluster Horizontal Pod Autoscalers Overview')).toBeInTheDocument();
    expect(screen.getByText('backend-hpa')).toBeInTheDocument();
    expect(screen.getByText(/Target CPU: 80%/)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Edit HPA backend-hpa'));
    expect(setHpaModalTargetNode).toHaveBeenCalledWith({
      id: 'dep-1',
      label: 'backend-dep',
      initialItem: expect.objectContaining({ name: 'backend-hpa' }),
    });

    // 4. ResourceLimit
    rerender(<AttachedResourceOverviewModal type="ResourceLimit" onClose={onClose} />);
    expect(screen.getByText('Cluster Resource Limits Overview')).toBeInTheDocument();
    expect(screen.getByText('backend-limits')).toBeInTheDocument();
    expect(screen.getByText(/CPU: 100m req \/ 200m limit/)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Edit Resource Limit backend-limits'));
    expect(setResourceLimitModalTargetNode).toHaveBeenCalledWith({
      id: 'dep-1',
      label: 'backend-dep',
      initialItem: expect.objectContaining({ name: 'backend-limits' }),
    });
  });

  it('handles empty and edge case items in details sections', () => {
    const emptyDetailsNodes: Node[] = [{
      id: 'node-empty-items',
      position: { x: 0, y: 0 },
      data: {
        label: 'empty-pod',
        configMaps: [{ id: 'cm-empty', name: 'empty-cm', configData: [] }],
        secrets: [{ id: 'sec-empty', name: 'empty-sec', secretData: [] }],
        roles: [{ id: 'role-empty', name: 'empty-role', rules: [], assignedUsers: [] }],
      },
    }];
    useFlowStore.setState({ nodes: emptyDetailsNodes });

    const { rerender } = render(<AttachedResourceOverviewModal type="ConfigMap" onClose={vi.fn()} />);
    expect(screen.getByText('No variables defined')).toBeInTheDocument();

    rerender(<AttachedResourceOverviewModal type="Secret" onClose={vi.fn()} />);
    expect(screen.getByText('No secret keys')).toBeInTheDocument();

    rerender(<AttachedResourceOverviewModal type="Role" onClose={vi.fn()} />);
    expect(screen.getByText('No rules')).toBeInTheDocument();
  });

  it('handles Close button click in footer', () => {
    const onClose = vi.fn();
    render(<AttachedResourceOverviewModal type="ConfigMap" onClose={onClose} />);

    const closeBtn = screen.getByText('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders standalone ConfigMap from savedConfigMaps and handles Add ConfigMap button click', () => {
    const mockSetConfigMapModalTargetNode = vi.fn();
    const onClose = vi.fn();

    useFlowStore.setState({
      nodes: [],
      savedConfigMaps: [{ id: 'cm-standalone-1', name: 'standalone-config', configData: [{ key: 'HOST', value: 'localhost' }] }],
      setConfigMapModalTargetNode: mockSetConfigMapModalTargetNode,
    });

    render(<AttachedResourceOverviewModal type="ConfigMap" onClose={onClose} />);

    expect(screen.getByText('standalone-config')).toBeInTheDocument();
    expect(screen.getByText('Attached to: Cluster (Local Storage) (ConfigMap)')).toBeInTheDocument();
    expect(screen.getByText('HOST:')).toBeInTheDocument();
    expect(screen.getByText('localhost')).toBeInTheDocument();

    const addBtn = screen.getByText('+ Add ConfigMap');
    fireEvent.click(addBtn);

    expect(onClose).toHaveBeenCalled();
    expect(mockSetConfigMapModalTargetNode).toHaveBeenCalledWith({
      id: 'cluster-storage',
      label: 'Cluster ConfigMap',
    });
  });

  it('handles deleting a standalone ConfigMap', () => {
    const mockDeleteSavedConfigMap = vi.fn();

    useFlowStore.setState({
      nodes: [],
      savedConfigMaps: [{ id: 'cm-to-delete', name: 'standalone-to-delete', configData: [] }],
      deleteSavedConfigMap: mockDeleteSavedConfigMap,
    });

    render(<AttachedResourceOverviewModal type="ConfigMap" onClose={vi.fn()} />);

    const deleteBtn = screen.getByTitle('Delete ConfigMap standalone-to-delete');
    fireEvent.click(deleteBtn);

    expect(mockDeleteSavedConfigMap).toHaveBeenCalledWith('cm-to-delete');
  });

  it('covers fallback branches across details components and delete handler', () => {
    const updateNodeData = vi.fn();
    useFlowStore.setState({ updateNodeData });

    const mixedNodes: Node[] = [
      {
        id: 'node-more-cm',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: {
          label: 'multi-pod',
          // ConfigMap with > 5 variables (Branch 2)
          configMaps: [
            {
              id: 'cm-many',
              name: 'many-vars-cm',
              configData: [
                { key: 'V1', value: '1' }, { key: 'V2', value: '2' }, { key: 'V3', value: '3' },
                { key: 'V4', value: '4' }, { key: 'V5', value: '5' }, { key: 'V6', value: '6' },
                { key: 'V7', value: '7' },
              ],
            },
            { id: 'cm-no-list', name: 'no-list-cm' }, // configData undefined (Branch 0)
          ],
          // Secret with secretData undefined (Branch 3)
          secrets: [{ id: 'sec-no-data', name: 'no-data-secret' }],
          // Role with 1 rule (Branch 9 singular 'rule'), missing resources (Branch 10), and missing rules/assignedUsers (Branches 6, 7)
          roles: [
            {
              id: 'role-single',
              name: 'single-rule-role',
              rules: [{ resources: undefined }],
              assignedUsers: ['alice'],
            },
            {
              id: 'role-plural',
              name: 'plural-rules-role',
              rules: [{ resources: ['pods'] }, { resources: ['services'] }],
              assignedUsers: ['bob'],
            },
            { id: 'role-no-arrays', name: 'no-arrays-role' },
          ],
        },
      },
      {
        id: 'dep-more',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: {
          label: 'dep-alt',
          // HPA with min/max/targetCPU undefined (Branches 12, 13, 14)
          hpas: [{ id: 'hpa-undef', name: 'undef-hpa' }],
          // ResourceLimit with requestCpu/limitCpu/requestMemory/limitMemory, and one with none (Branches 15, 16, 17, 18)
          resourceLimits: [
            { id: 'res-alt', name: 'alt-limits', requestCpu: '200m', limitCpu: '400m', requestMemory: '100Mi', limitMemory: '200Mi' },
            { id: 'res-none', name: 'none-limits' },
          ],
        },
      },
      {
        id: 'owner-no-resource-array',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: {
          label: 'no-array-owner',
          // data has secrets at extraction, but we will test missing resourceKey on owner
        },
      },
    ];

    useFlowStore.setState({ nodes: mixedNodes });

    // 1. ConfigMap details: +2 more and no variables defined
    const { rerender } = render(<AttachedResourceOverviewModal type="ConfigMap" onClose={vi.fn()} />);
    expect(screen.getByText('+2 more')).toBeInTheDocument();
    expect(screen.getAllByText('No variables defined')[0]).toBeInTheDocument();

    // 2. Secret details: secretData undefined (No secret keys)
    rerender(<AttachedResourceOverviewModal type="Secret" onClose={vi.fn()} />);
    expect(screen.getByText('No secret keys')).toBeInTheDocument();

    // Delete a Secret (Branch 34: type !== 'ConfigMap')
    const deleteSecBtn = screen.getByTitle('Delete Secret no-data-secret');
    fireEvent.click(deleteSecBtn);
    expect(updateNodeData).toHaveBeenCalledWith('node-more-cm', { secrets: [] });

    // 3. Role details: '1 rule (' singular and 'No rules'
    rerender(<AttachedResourceOverviewModal type="Role" onClose={vi.fn()} />);
    expect(screen.getByText(/1 rule \(/)).toBeInTheDocument();
    expect(screen.getByText('No rules')).toBeInTheDocument();

    // 4. HPA details: min/max/targetCPU fallbacks
    rerender(<AttachedResourceOverviewModal type="HPA" onClose={vi.fn()} />);
    expect(screen.getByText('Min: 1')).toBeInTheDocument();
    expect(screen.getByText('Max: 10')).toBeInTheDocument();
    expect(screen.getByText('Target CPU: 80%')).toBeInTheDocument();

    // 5. ResourceLimit details: alternative names and 'none' fallbacks
    rerender(<AttachedResourceOverviewModal type="ResourceLimit" onClose={vi.fn()} />);
    expect(screen.getByText(/CPU: 200m req \/ 400m limit/)).toBeInTheDocument();
    expect(screen.getByText(/Mem: 100Mi req \/ 200Mi limit/)).toBeInTheDocument();
    expect(screen.getByText(/CPU: none req \/ none limit/)).toBeInTheDocument();
    expect(screen.getByText(/Mem: none req \/ none limit/)).toBeInTheDocument();

    // 6. Delete when owner is not found in nodes (Branch 32)
    act(() => {
      useFlowStore.setState({
        nodes: [
          {
            id: 'ghost-owner-target',
            type: 'Pod',
            position: { x: 0, y: 0 },
            data: {
              secrets: [{ id: 'sec-ghost', name: 'ghost-sec' }],
            },
          },
        ],
      });
    });

    rerender(<AttachedResourceOverviewModal type="Secret" onClose={vi.fn()} />);
    const ghostDeleteBtn = screen.getByTitle('Delete Secret ghost-sec');

    // Spy on Array.prototype.find to return undefined for owner lookup (Branch 32)
    const findSpy = vi.spyOn(Array.prototype, 'find').mockReturnValueOnce(undefined);
    fireEvent.click(ghostDeleteBtn);
    findSpy.mockRestore();

    // Owner found but owner.data.secrets is undefined (Branch 33: fallback to [])
    const mockOwnerNoSecrets = {
      id: 'ghost-owner-target',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: {}, // no secrets
    };
    const findSpyNoData = vi.spyOn(Array.prototype, 'find').mockReturnValueOnce(mockOwnerNoSecrets);
    fireEvent.click(ghostDeleteBtn);
    findSpyNoData.mockRestore();
    expect(updateNodeData).toHaveBeenCalledWith('ghost-owner-target', { secrets: [] });
  });

  it('handles edit action with unhandled resource type safely', () => {
    RESOURCE_TYPE_KEY_MAP['CustomRes'] = 'customs';
    try {
      useFlowStore.setState({
        nodes: [
          {
            id: 'node-custom',
            type: 'Pod',
            position: { x: 0, y: 0 },
            data: {
              label: 'custom-pod',
              customs: [{ id: 'c-1', name: 'my-custom' }],
            },
          },
        ] as any,
      });

      const onClose = vi.fn();
      render(<AttachedResourceOverviewModal type={'CustomRes' as any} onClose={onClose} />);

      const editBtn = screen.getByTitle('Edit Resource Limit my-custom');
      fireEvent.click(editBtn);
      expect(onClose).toHaveBeenCalled();
    } finally {
      delete RESOURCE_TYPE_KEY_MAP['CustomRes'];
    }
  });
});
