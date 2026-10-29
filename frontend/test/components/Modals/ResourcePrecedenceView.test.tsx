import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ResourcePrecedenceView } from '@/components/Modals/ResourcePrecedenceView';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import { useFlowStore } from '@/store/useFlowStore';

describe('ResourcePrecedenceView (Secret)', () => {
  const mockOnEditItem = vi.fn();
  const mockOnDeleteItem = vi.fn();
  const mockOnAddNew = vi.fn();

  const mockSecretItems: OverviewItem[] = [
    {
      id: 'sec-1',
      name: 'auth-base',
      rawItem: {
        id: 'sec-1',
        name: 'auth-base',
        secretData: [
          { key: 'TOKEN', value: 'token-base' },
          { key: 'USER', value: 'admin' },
        ],
      },
      ownerNode: { id: 'pod-auth', label: 'auth-pod', type: 'Pod' },
      profileName: 'prod-session',
    },
    {
      id: 'sec-2',
      name: 'auth-override',
      rawItem: {
        id: 'sec-2',
        name: 'auth-override',
        secretData: [{ key: 'TOKEN', value: 'token-override' }],
      },
      ownerNode: { id: 'pod-auth', label: 'auth-pod', type: 'Pod' },
      profileName: 'prod-session',
    },
    {
      id: 'sec-3',
      name: 'standalone-sec',
      rawItem: {
        id: 'sec-3',
        name: 'standalone-sec',
        secretData: [{ key: 'API_KEY', value: 'secret-key' }],
      },
      ownerNode: { id: 'cluster-storage', label: 'Cluster Storage', type: 'Node' },
      profileName: 'prod-session',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      savedSecrets: [],
      updateNodeData: vi.fn(),
      setSavedSecrets: vi.fn(),
      addLog: vi.fn(),
    });
  });

  it('renders Secret precedence view with Rose theme and component cards', () => {
    render(
      <ResourcePrecedenceView
        resourceType="Secret"
        profileName="prod-session"
        items={mockSecretItems}
        isDark={true}
        accentColor="rose"
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
        onAddNewItem={mockOnAddNew}
      />
    );

    expect(screen.getByTestId('secret-precedence-view')).toBeInTheDocument();
    expect(screen.getByTestId('component-title-pod-auth')).toHaveTextContent('auth-pod');
    expect(screen.getByTestId('component-title-unattached')).toHaveTextContent('(No Component)');

    // Overridden keys and active keys for Secret
    expect(screen.getByTestId('sec-key-TOKEN-overridden')).toBeInTheDocument();
    expect(screen.getByTestId('sec-val-TOKEN-overridden')).toBeInTheDocument();
    expect(screen.getByTestId('sec-key-TOKEN-active')).toBeInTheDocument();
    expect(screen.getByTestId('sec-key-USER-active')).toBeInTheDocument();

  });

  it('handles reordering via keyboard navigation on drag handle', () => {
    const mockUpdateNodeData = vi.fn();
    useFlowStore.setState({
      nodes: [
        {
          id: 'pod-auth',
          data: {
            secrets: [mockSecretItems[0].rawItem, mockSecretItems[1].rawItem],
          },
        },
      ],
      savedSecrets: [],
      updateNodeData: mockUpdateNodeData,
      setSavedSecrets: vi.fn(),
      addLog: vi.fn(),
    });

    render(
      <ResourcePrecedenceView
        resourceType="Secret"
        profileName="prod-session"
        items={mockSecretItems}
        isDark={false}
        accentColor="rose"
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    const firstHandle = screen.getByTestId('sec-drag-handle-sec-1');
    fireEvent.keyDown(firstHandle, { key: 'ArrowDown' });

    expect(mockUpdateNodeData).toHaveBeenCalledWith('pod-auth', {
      secrets: [mockSecretItems[1].rawItem, mockSecretItems[0].rawItem],
    });
  });

  it('renders empty state when filtered items are empty', () => {
    render(
      <ResourcePrecedenceView
        resourceType="Secret"
        profileName="prod-session"
        items={[]}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    expect(
      screen.getByText(/No Secrets found in profile "prod-session"/i)
    ).toBeInTheDocument();
  });
});
