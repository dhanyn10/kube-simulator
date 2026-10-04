import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResourceLimitNode } from '@/components/Nodes/ResourceLimit';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';

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
});
