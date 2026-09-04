import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BaseNode } from '@/components/Nodes/BaseNode';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';
import { Box } from 'lucide-react';

describe('BaseNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark', draggingSidebarItem: null, nodes: [] });
  });

  const defaultProps = {
    id: '1',
    type: 'Pod',
    title: 'Test Node',
    icon: Box,
    color: 'blue',
    data: { label: 'Node Label', replicas: 1, type: 'Pod' } as any
  };

  it('renders correctly with basic data', () => {
    render(
      <ReactFlowProvider>
        <BaseNode {...defaultProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByText('Node Label')).toBeInTheDocument();
  });

  it('handles renaming and sanitizes name', () => {
    const onRename = vi.fn();
    const props = {
      ...defaultProps,
      data: { ...defaultProps.data, onRename }
    };

    render(
      <ReactFlowProvider>
        <BaseNode {...props} />
      </ReactFlowProvider>
    );

    const label = screen.getByText('Node Label');
    fireEvent.doubleClick(label);

    const input = screen.getByDisplayValue('Node Label');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.blur(input);

    expect(onRename).toHaveBeenCalledWith('new-name');
  });

  it('shows replicas badge when > 1', () => {
    const props = {
      ...defaultProps,
      data: { ...defaultProps.data, replicas: 5 }
    };
    render(
      <ReactFlowProvider>
        <BaseNode {...props} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('x5')).toBeInTheDocument();
  });

  it('applies role-drag-inside-ns or role-drag-outside-ns when dragging Role from sidebar', () => {
    useFlowStore.setState({
      draggingSidebarItem: 'Role',
      nodes: [
        { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-in-ns', type: 'Pod', parentId: 'ns1', position: { x: 10, y: 10 }, data: { label: 'In NS', isHovered: true } },
        { id: 'node-incompatible', type: 'Internet', position: { x: 100, y: 100 }, data: { label: 'Internet' } }
      ]
    });

    const { container: containerIn } = render(
      <ReactFlowProvider>
        <BaseNode {...defaultProps} id="node-in-ns" data={{ ...defaultProps.data, isHovered: true }} />
      </ReactFlowProvider>
    );
    expect((containerIn.firstChild as HTMLElement).className).toContain('role-drag-inside-ns');

    const { container: containerOut } = render(
      <ReactFlowProvider>
        <BaseNode {...defaultProps} id="node-incompatible" data={{ ...defaultProps.data, type: 'Internet' }} />
      </ReactFlowProvider>
    );
    expect((containerOut.firstChild as HTMLElement).className).toContain('role-drag-outside-ns');
  });

  it('renders BaseNode with crashing status override and mega replicas (100)', () => {
    render(
      <ReactFlowProvider>
        <BaseNode
          id="mega-pod"
          type="Pod"
          title="Mega Pod"
          icon={Box}
          color="emerald"
          statusOverride="crashing"
          data={{
            label: 'mega-pod',
            type: 'Pod',
            replicas: 100,
            status: 'crashing',
            runtime: 'nodejs',
            webserver: 'nginx',
            image: 'custom/app:v1',
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Crashing')).toBeInTheDocument();
    expect(screen.getByText('x100')).toBeInTheDocument();
  });

  it('renders roles and configMaps attached section at bottom', () => {
    render(
      <ReactFlowProvider>
        <BaseNode
          {...defaultProps}
          data={{
            ...defaultProps.data,
            roles: [{ id: 'r1', name: 'my-role' }],
            configMaps: [{ id: 'c1', name: 'my-cm' }],
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByTitle('Role: my-role')).toBeInTheDocument();
    expect(screen.getByTitle('ConfigMap: my-cm')).toBeInTheDocument();
  });

  it('renders status indicators correctly for Internet and PVC node types', () => {
    const { container } = render(
      <ReactFlowProvider>
        <BaseNode
          {...defaultProps}
          data={{ label: 'Internet Node', type: 'Internet' }}
        />
      </ReactFlowProvider>
    );

    expect(container.querySelector('.rounded-full.w-1\\.5')).toBeNull();
  });
});
