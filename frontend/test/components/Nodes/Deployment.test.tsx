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
    useFlowStore.setState({ colorMode: 'dark', edges: [], nodes: [] });
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
