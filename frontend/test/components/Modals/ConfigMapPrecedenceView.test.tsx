import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ConfigMapPrecedenceView } from '@/components/Modals/ConfigMapPrecedenceView';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import { useFlowStore } from '@/store/useFlowStore';

describe('ConfigMapPrecedenceView', () => {
  const mockOnEditItem = vi.fn();
  const mockOnDeleteItem = vi.fn();
  const mockOnAddNew = vi.fn();

  const mockItems: OverviewItem[] = [
    { id: 'cm-1', name: 'base-config', rawItem: { id: 'cm-1', name: 'base-config', configData: [{ key: 'PORT', value: '8080' }, { key: 'APP_NAME', value: 'kube-sim' }] }, ownerNode: { id: 'pod-1', label: 'frontend-pod', type: 'Pod' }, profileName: 'autosave-session-1' },
    { id: 'cm-2', name: 'override-config', rawItem: { id: 'cm-2', name: 'override-config', configData: [{ key: 'PORT', value: '9000' }, { key: 'DEBUG', value: 'true' }] }, ownerNode: { id: 'pod-1', label: 'frontend-pod', type: 'Pod' }, profileName: 'autosave-session-1' },
    { id: 'cm-3', name: 'deploy-config', rawItem: { id: 'cm-3', name: 'deploy-config', configData: [{ key: 'DB_HOST', value: 'postgres.local' }] }, ownerNode: { id: 'deploy-1', label: 'backend-deployment', type: 'Deployment' }, profileName: 'autosave-session-1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      savedConfigMaps: [],
      updateNodeData: vi.fn(),
      setSavedConfigMaps: vi.fn(),
      addLog: vi.fn(),
    });
  });

  it('renders tables separated by component, with component titles and without Component column', () => {
    render(
      <ConfigMapPrecedenceView
        profileName="autosave-session-1"
        items={mockItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
        onAddNewConfigMap={mockOnAddNew}
      />
    );

    // Profile badge and info banner
    expect(screen.getByTestId('precedence-profile-badge')).toHaveTextContent('autosave-session-1');
    expect(screen.getByText(/Evaluated top-to-bottom per component/i)).toBeInTheDocument();

    // Component titles (one table per component)
    expect(screen.getByTestId('component-title-pod-1')).toHaveTextContent('frontend-pod');
    expect(screen.getByTestId('component-title-deploy-1')).toHaveTextContent('backend-deployment');

    // Table columns: ID, Key, Value, Actions (Component column must NOT be present in the table header)
    expect(screen.getAllByRole('columnheader', { name: 'ID' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'Key' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'Value' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'Actions' }).length).toBeGreaterThan(0);

    // Order, ConfigMap Name, Status, and Component columns must NOT be present
    expect(screen.queryByRole('columnheader', { name: 'Component' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'ConfigMap Name' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();

    // ID column displays cm-xxxx and has drag handle button
    expect(screen.getByTestId('cm-id-cm-1')).toHaveTextContent('cm-1');
    expect(screen.getByTestId('cm-id-cm-2')).toHaveTextContent('cm-2');
    expect(screen.getByTestId('cm-id-cm-3')).toHaveTextContent('cm-3');
    expect(screen.getByTestId('cm-drag-handle-cm-1')).toBeInTheDocument();
    expect(screen.getByTestId('cm-drag-handle-cm-2')).toBeInTheDocument();
    expect(screen.getByTestId('cm-drag-handle-cm-3')).toBeInTheDocument();

    // Add ConfigMap button
    const addBtn = screen.getByTestId('precedence-add-cm-btn');
    fireEvent.click(addBtn);
    expect(mockOnAddNew).toHaveBeenCalled();
  });

  it('renders strikethrough for upper ConfigMap key and value when overridden within the same component', () => {
    render(
      <ConfigMapPrecedenceView
        profileName="autosave-session-1"
        items={mockItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    // In frontend-pod: cm-1 has PORT: 8080 which is overridden by cm-2 with PORT: 9000
    const upperPortKey = screen.getByTestId('cm-key-PORT-overridden');
    const upperPortVal = screen.getByTestId('cm-val-PORT-overridden');
    expect(upperPortKey).toBeInTheDocument();
    expect(upperPortVal).toBeInTheDocument();
    expect(upperPortKey.className).toContain('line-through');
    expect(upperPortVal.className).toContain('line-through');
    expect(screen.getByText(/overridden by override-config/i)).toBeInTheDocument();

    // In frontend-pod: APP_NAME is unique in cm-1 so it is active
    const upperAppNameKey = screen.getByTestId('cm-key-APP_NAME-active');
    const upperAppNameVal = screen.getByTestId('cm-val-APP_NAME-active');
    expect(upperAppNameKey).toBeInTheDocument();
    expect(upperAppNameVal).toBeInTheDocument();
    expect(upperAppNameKey.className).not.toContain('line-through');

    // In frontend-pod: PORT: 9000 in cm-2 is at the bottom, so it is active
    const lowerPortKey = screen.getByTestId('cm-key-PORT-active');
    const lowerPortVal = screen.getByTestId('cm-val-PORT-active');
    expect(lowerPortKey).toBeInTheDocument();
    expect(lowerPortVal).toBeInTheDocument();

    // In backend-deployment: DB_HOST is active
    expect(screen.getByTestId('cm-key-DB_HOST-active')).toBeInTheDocument();
  });

  it('handles reordering via drag-and-drop within a component table', () => {
    const mockUpdateNodeData = vi.fn();
    useFlowStore.setState({
      nodes: [{ id: 'pod-1', data: { configMaps: [mockItems[0].rawItem, mockItems[1].rawItem] } }],
      savedConfigMaps: [],
      updateNodeData: mockUpdateNodeData,
      setSavedConfigMaps: vi.fn(),
      addLog: vi.fn(),
    });

    render(
      <ConfigMapPrecedenceView
        profileName="autosave-session-1"
        items={mockItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    const handleFirst = screen.getByTestId('cm-drag-handle-cm-1');
    const dropTarget = screen.getByTestId('cm-id-cm-2');

    // Drag and drop cm-1 onto cm-2 inside pod-1
    fireEvent.dragStart(handleFirst, {
      dataTransfer: {
        setData: vi.fn(),
        getData: () => JSON.stringify({ compId: 'pod-1', index: 0 }),
      },
    });
    fireEvent.dragOver(dropTarget, { dataTransfer: { dropEffect: 'move' } });
    fireEvent.drop(dropTarget, {
      dataTransfer: {
        getData: () => JSON.stringify({ compId: 'pod-1', index: 0 }),
      },
    });

    // After dropping, cm-2 is now on top and cm-1 is at the bottom:
    // PORT in cm-2 is overridden by cm-1 below it!
    expect(screen.getByText(/overridden by base-config/i)).toBeInTheDocument();
    expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-1', {
      configMaps: [mockItems[1].rawItem, mockItems[0].rawItem],
    });
  });

  it('handles reordering via keyboard ArrowDown on drag handle within a component table', () => {
    const mockUpdateNodeData = vi.fn();
    useFlowStore.setState({
      nodes: [{ id: 'pod-1', data: { configMaps: [mockItems[0].rawItem, mockItems[1].rawItem] } }],
      savedConfigMaps: [],
      updateNodeData: mockUpdateNodeData,
      setSavedConfigMaps: vi.fn(),
      addLog: vi.fn(),
    });

    render(
      <ConfigMapPrecedenceView
        profileName="autosave-session-1"
        items={mockItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    const handleFirst = screen.getByTestId('cm-drag-handle-cm-1');
    fireEvent.keyDown(handleFirst, { key: 'ArrowDown' });

    // Order flipped
    expect(screen.getByText(/overridden by base-config/i)).toBeInTheDocument();
    expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-1', {
      configMaps: [mockItems[1].rawItem, mockItems[0].rawItem],
    });
  });

  it('handles edit and delete actions on ConfigMaps in component tables', () => {
    render(
      <ConfigMapPrecedenceView
        profileName="autosave-session-1"
        items={mockItems}
        isDark={false}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    fireEvent.click(screen.getByTitle('Edit ConfigMap base-config'));
    expect(mockOnEditItem).toHaveBeenCalledWith(mockItems[0]);

    fireEvent.click(screen.getByTitle('Delete ConfigMap override-config'));
    expect(mockOnDeleteItem).toHaveBeenCalledWith(mockItems[1]);
  });

  it('renders unattached ConfigMaps with (No Component) and never renders Cluster Storage', () => {
    const unattachedItems: OverviewItem[] = [
      {
        id: 'cm-unattached',
        name: 'unattached-config',
        rawItem: { id: 'cm-unattached', name: 'unattached-config', configData: [{ key: 'UNATTACHED_KEY', value: '123' }] },
        ownerNode: { id: 'cluster-storage', label: '', type: '' },
        profileName: 'autosave-session-1',
      },
    ];

    render(
      <ConfigMapPrecedenceView
        profileName="autosave-session-1"
        items={unattachedItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    expect(screen.getByTestId('component-title-unattached')).toHaveTextContent('(No Component)');
    expect(screen.queryByText('Cluster Storage')).not.toBeInTheDocument();
    expect(screen.getByTestId('cm-id-cm-unattached')).toHaveTextContent('cm-unattached');
  });

  it('renders empty state when items list is empty', () => {
    render(
      <ConfigMapPrecedenceView
        profileName="autosave-empty"
        items={[]}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    expect(screen.getByText(/No ConfigMaps found in profile "autosave-empty"/i)).toBeInTheDocument();
  });
});
