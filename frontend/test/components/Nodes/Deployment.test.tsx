import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeploymentNode } from '../../../src/components/Nodes/Deployment';
import { useFlowStore } from '../../../src/store';
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

  it('renders correctly in light mode when selected, hovered, detaching, and with attached roles', () => {
    useFlowStore.setState({ colorMode: 'light' });

    const props = {
      id: 'd1',
      type: 'Deployment',
      selected: true,
      data: {
        label: 'Light Dep',
        isHovered: true,
        isDetaching: true,
        roles: [{ id: 'r1', name: 'admin-role' }, { name: 'viewer-role' }]
      }
    } as any;

    render(
      <ReactFlowProvider>
        <DeploymentNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('DEPLOYMENT')).toBeDefined();
    expect(screen.getByTitle('Role: admin-role')).toBeDefined();
    expect(screen.getByTitle('Role: viewer-role')).toBeDefined();
  });

  it('handles role dragging inside and outside namespace', () => {
    const nsNode = { id: 'ns1', type: 'Namespace', data: {} };
    const depInNs = { id: 'd1', type: 'Deployment', parentId: 'ns1', data: { label: 'Inside NS', isHovered: true } };
    const depOutsideNs = { id: 'd2', type: 'Deployment', data: { label: 'Outside NS' } };

    useFlowStore.setState({
      draggingSidebarItem: 'Role',
      nodes: [nsNode, depInNs, depOutsideNs] as any,
    });

    const { rerender } = render(
      <ReactFlowProvider>
        <DeploymentNode id="d1" type="Deployment" data={depInNs.data} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Inside NS')).toBeDefined();

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
});
