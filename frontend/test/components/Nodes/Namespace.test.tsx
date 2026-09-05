import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NamespaceNode } from '../../../src/components/Nodes/Namespace';
import { useFlowStore } from '../../../src/store';
import { ReactFlowProvider } from '@xyflow/react';

// Mock hooks
vi.mock('../../../src/hooks/useNodeEditor', () => ({
  useNodeRename: vi.fn(() => ({
    isEditing: false,
    setIsEditing: vi.fn(),
    editValue: '',
    setEditValue: vi.fn(),
    inputRef: { current: null },
    handleRename: vi.fn(),
    onKeyDown: vi.fn()
  })),
  useNodeResize: vi.fn(() => ({
    handleNodeResize: vi.fn(),
    handleNodeResizeStop: vi.fn()
  }))
}));

vi.mock('../../../src/hooks/useNodeStyles', () => ({
  useNodeStyles: vi.fn(() => ({
    transitionClasses: ''
  }))
}));

// Mock child components
vi.mock('../../../src/components/Nodes/NodeUI', () => ({
  NodeActionButtons: () => <div data-testid="action-buttons">ActionButtons</div>,
  NodeRenameInput: ({ label }: any) => <div data-testid="rename-input">{label}</div>
}));

// Mock ReactFlow components that might be problematic in JSDOM
vi.mock('@xyflow/react', async () => {
    const actual = await vi.importActual('@xyflow/react');
    return {
        ...actual,
        NodeResizer: () => <div data-testid="node-resizer">NodeResizer</div>,
        Handle: ({ id }: any) => <div data-testid={`handle-${id}`}>Handle {id}</div>
    };
});

describe('NamespaceNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('applies role-drag-inside-ns when dragging Role from sidebar onto hovered namespace', () => {
    useFlowStore.setState({ draggingSidebarItem: 'Role' });
    const props = {
      id: 'ns1',
      type: 'Namespace',
      data: { label: 'My Namespace', isHovered: true }
    } as any;

    const { container } = render(
      <ReactFlowProvider>
        <NamespaceNode {...props} />
      </ReactFlowProvider>
    );

    expect((container.firstChild as HTMLElement).className).toContain('role-drag-inside-ns');
  });

  it('renders correctly with default data and isDetaching styling in light mode', () => {
    useFlowStore.setState({ colorMode: 'light' });
    const props = {
      id: 'ns1',
      type: 'Namespace',
      selected: true,
      data: { label: 'My Namespace', isHovered: true, isDetaching: true }
    } as any;

    const { container } = render(
      <ReactFlowProvider>
        <NamespaceNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('NAMESPACE')).toBeDefined();
    expect(screen.getByText('My Namespace')).toBeDefined();
    expect(screen.getByText('Isolated Logic Cluster')).toBeDefined();
    expect(screen.getByTestId('node-resizer')).toBeDefined();
    expect((container.firstChild as HTMLElement).className).toContain('border-red-500');
  });
});
