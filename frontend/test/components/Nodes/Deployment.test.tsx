import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeploymentNode } from '@/components/Nodes/Deployment';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';

// Mock ResizeObserver for ReactFlow NodeResizer
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('DeploymentNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark', edges: [], nodes: [], draggingSidebarItem: null });
  });

  it('renders correctly with default data', () => {
    const props = {
      id: 'd1',
      type: 'Deployment',
      data: { label: 'My Dep', replicas: 3 }
    } as any;

    render(
      <ReactFlowProvider>
        <DeploymentNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('DEPLOYMENT')).toBeDefined();
    expect(screen.getByText('replicas: 3')).toBeDefined();
    expect(screen.getByText('Workload Zone')).toBeDefined();
  });

  it('renders correctly in light mode when selected, hovered, detaching, and with assignedUsers in attached roles', () => {
    useFlowStore.setState({ colorMode: 'light' });

    const props = {
      id: 'd1',
      type: 'Deployment',
      selected: true,
      data: {
        label: 'Light Dep',
        isHovered: true,
        isDetaching: true,
        roles: [{ id: 'r1', name: 'admin-role', assignedUsers: ['alice', 'bob'] }, { name: 'viewer-role' }]
      }
    } as any;

    render(
      <ReactFlowProvider>
        <DeploymentNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('DEPLOYMENT')).toBeDefined();
    expect(screen.getByTitle('Role: admin-role (Users: alice, bob)')).toBeDefined();
    expect(screen.getByTitle('Role: viewer-role')).toBeDefined();
  });

  it('handles role, ConfigMap, and HPA dragging inside and outside namespace', () => {
    const nsNode = { id: 'ns1', type: 'Namespace', data: {} };
    const depInNs = { id: 'd1', type: 'Deployment', parentId: 'ns1', data: { label: 'Inside NS', isHovered: true } };
    const depOutsideNs = { id: 'd2', type: 'Deployment', data: { label: 'Outside NS' } };

    useFlowStore.setState({
      draggingSidebarItem: 'ConfigMap',
      nodes: [nsNode, depInNs, depOutsideNs] as any,
    });

    const { rerender } = render(
      <ReactFlowProvider>
        <DeploymentNode id="d1" type="Deployment" data={depInNs.data} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Inside NS')).toBeDefined();

    useFlowStore.setState({ draggingSidebarItem: 'Internet' as any });

    rerender(
      <ReactFlowProvider>
        <DeploymentNode id="d2" type="Deployment" data={depOutsideNs.data} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Outside NS')).toBeDefined();
  });

  it('shows HPA warning when targeted by HPA without requests', () => {
    const hpaNode = { id: 'hpa1', type: 'HPA', data: {} };
    const depNode = { id: 'd1', type: 'Deployment', data: { label: 'My Dep' } };
    const edge = { id: 'e1', source: 'hpa1', target: 'd1' };

    useFlowStore.setState({
      nodes: [hpaNode, depNode] as any,
      edges: [edge] as any
    });

    const props = {
      id: 'd1',
      type: 'Deployment',
      data: { label: 'My Dep' }
    } as any;

    render(
      <ReactFlowProvider>
        <DeploymentNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('HPA ACTIVE: REQUESTS REQUIRED')).toBeDefined();
  });

  it('hides HPA warning when requests are present', () => {
    const hpaNode = { id: 'hpa1', type: 'HPA', data: {} };
    const depNode = { id: 'd1', type: 'Deployment', data: { label: 'My Dep', cpuRequest: '100m', memoryRequest: '128Mi' } };
    const edge = { id: 'e1', source: 'hpa1', target: 'd1' };

    useFlowStore.setState({
      nodes: [hpaNode, depNode] as any,
      edges: [edge] as any
    });

    const props = {
      id: 'd1',
      type: 'Deployment',
      data: depNode.data
    } as any;

    render(
      <ReactFlowProvider>
        <DeploymentNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText('HPA ACTIVE: REQUESTS REQUIRED')).toBeNull();
  });

  it('shows HPA warning when attached HPAs exist without requests and handles non-HPA edges', () => {
    const podNode = { id: 'pod1', type: 'Pod', data: {} };
    const edge = { id: 'e1', source: 'pod1', target: 'd1' };
    const edge2 = { id: 'e2', source: 'missing-source', target: 'd1' };

    useFlowStore.setState({
      nodes: [podNode] as any,
      edges: [edge, edge2] as any
    });

    const props = {
      id: 'd1',
      type: 'Deployment',
      data: {
        label: 'My Dep',
        hpas: [{ id: 'h1', name: 'autoscale' }],
        configMaps: [{ id: 'c1', name: 'my-cm' }],
        secrets: [{ id: 's1', name: 'my-sec' }],
      }
    } as any;

    render(
      <ReactFlowProvider>
        <DeploymentNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('HPA ACTIVE: REQUESTS REQUIRED')).toBeDefined();
    expect(screen.getByTitle('ConfigMap: my-cm')).toBeDefined();
    expect(screen.getByTitle('Secret: my-sec')).toBeDefined();
    expect(screen.getByTitle('HPA: autoscale')).toBeDefined();
  });

  it('covers getRoleDragClass and getDeploymentBorderClass for unselected and role drag compatibility', () => {
    useFlowStore.setState({
      draggingSidebarItem: 'Role',
      colorMode: 'dark',
    });

    const unselectedProps = {
      id: 'd-unselected',
      type: 'Deployment',
      selected: false,
      data: {
        label: 'Unselected Dep',
        isHovered: false,
      }
    } as any;

    const { rerender } = render(
      <ReactFlowProvider>
        <DeploymentNode {...unselectedProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Unselected Dep')).toBeDefined();

    // Rerender in light mode selected
    useFlowStore.setState({ colorMode: 'light' });
    rerender(
      <ReactFlowProvider>
        <DeploymentNode {...unselectedProps} selected={true} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Unselected Dep')).toBeDefined();
  });

  it('covers getBadgeColor for isHovered vs isDetaching vs default, and partial cpuRequest without memoryRequest', () => {
    // 1. isHovered = true -> bg-violet-400
    const hoverProps = {
      id: 'd-hover',
      type: 'Deployment',
      data: { label: 'Hover Dep', isHovered: true, cpuRequest: '100m' } // missing memoryRequest
    } as any;

    const { rerender } = render(
      <ReactFlowProvider>
        <DeploymentNode {...hoverProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Hover Dep')).toBeDefined();

    // 2. isDetaching = true & isHovered = false -> bg-red-500
    const detachProps = {
      id: 'd-detach',
      type: 'Deployment',
      data: { label: 'Detach Dep', isHovered: false, isDetaching: true }
    } as any;

    rerender(
      <ReactFlowProvider>
        <DeploymentNode {...detachProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Detach Dep')).toBeDefined();

    // 3. Default state with no hover or detaching
    const defaultPropsNode = {
      id: 'd-default',
      type: 'Deployment',
      data: { label: 'Default Dep', isHovered: false, isDetaching: false }
    } as any;

    rerender(
      <ReactFlowProvider>
        <DeploymentNode {...defaultPropsNode} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Default Dep')).toBeDefined();
  });
});
