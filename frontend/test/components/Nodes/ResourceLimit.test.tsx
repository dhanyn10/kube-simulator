import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResourceLimitNode } from '@/components/Nodes/ResourceLimit';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';
import '@testing-library/jest-dom';

describe('ResourceLimitNode', () => {
  beforeEach(() => {
    useFlowStore.setState({
      nodes: [
        { id: 'dep-1', type: 'Deployment', data: { label: 'web-deployment' }, position: { x: 0, y: 0 } },
      ],
      colorMode: 'dark',
    });
  });

  it('renders ResourceLimitNode with dark mode and custom data values', () => {
    const props = {
      id: 'rl-1',
      type: 'ResourceLimit',
      data: {
        label: 'custom-resource-limit',
        cpuRequest: '250m',
        cpuLimit: '500m',
        memoryRequest: '128Mi',
        memoryLimit: '256Mi',
      },
    } as any;

    render(
      <ReactFlowProvider>
        <ResourceLimitNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Resource Limit')).toBeDefined();
    expect(screen.getByText('250m')).toBeDefined();
    expect(screen.getByText('500m')).toBeDefined();
    expect(screen.getByText('128Mi')).toBeDefined();
    expect(screen.getByText('256Mi')).toBeDefined();
  });

  it('renders default fallback CPU/Memory values when data properties are empty', () => {
    const props = {
      id: 'rl-2',
      type: 'ResourceLimit',
      data: {
        label: 'default-limit',
      },
    } as any;

    render(
      <ReactFlowProvider>
        <ResourceLimitNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('500m')).toBeDefined();
    expect(screen.getByText('1000m')).toBeDefined();
    expect(screen.getByText('256Mi')).toBeDefined();
    expect(screen.getByText('512Mi')).toBeDefined();
  });

  it('renders in light mode correctly', () => {
    useFlowStore.setState({ colorMode: 'light' });

    const props = {
      id: 'rl-3',
      type: 'ResourceLimit',
      data: {
        label: 'light-limit',
      },
    } as any;

    render(
      <ReactFlowProvider>
        <ResourceLimitNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('CPU Req:')).toBeDefined();
    expect(screen.getByText('Mem Req:')).toBeDefined();
  });

  it('applies opacity and pointer-events-none to handles when no workloads exist in store', () => {
    useFlowStore.setState({ nodes: [] });

    const props = {
      id: 'rl-no-workload',
      type: 'ResourceLimit',
      data: {
        label: 'no-workload-limit',
      },
    } as any;

    const { container } = render(
      <ReactFlowProvider>
        <ResourceLimitNode {...props} />
      </ReactFlowProvider>
    );

    const handles = container.querySelectorAll('.opacity-20');
    expect(handles).toHaveLength(2);
  });

  it('renders QoS Error callout badge and red text highlight when requests exceed limits', () => {
    const props = {
      id: 'rl-qos-err',
      type: 'ResourceLimit',
      data: {
        label: 'broken-qos-limit',
        cpuRequest: '2000m',
        cpuLimit: '500m',
        memoryRequest: '1024Mi',
        memoryLimit: '256Mi',
      },
    } as any;

    render(
      <ReactFlowProvider>
        <ResourceLimitNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('resource-node-warning')).toBeInTheDocument();
    expect(screen.getByText('QoS Error: Req > Limit')).toBeInTheDocument();
  });
});
