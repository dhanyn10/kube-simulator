import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HPANode } from '../../../src/components/Nodes/HPA';
import { useFlowStore } from '../../../src/store';
import { ReactFlowProvider } from '@xyflow/react';

// Mock BaseNode
vi.mock('../../../src/components/Nodes/BaseNode', () => ({
  BaseNode: ({ children, title }: any) => (
    <div data-testid="base-node">
      <span>{title}</span>
      {children}
    </div>
  )
}));

// Mock ProgressBar to avoid deep rendering issues
vi.mock('../../../src/components/Monitoring/ProgressBar', () => ({
  ProgressBar: ({ label, value, subLabel }: any) => (
    <div data-testid="progress-bar">
      <span>{label}</span>
      <span>{value}%</span>
      <span>{subLabel}</span>
    </div>
  )
}));

describe('HPANode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [],
      edges: []
    });
  });

  it('renders correctly with default data', () => {
    const props = {
      id: 'h1',
      type: 'HPA',
      data: { label: 'My HPA' }
    } as any;

    render(
      <ReactFlowProvider>
        <HPANode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('HPA')).toBeDefined();
    expect(screen.getByText('min:')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('max:')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
  });

  it('renders custom metrics and replicas', () => {
    const props = {
      id: 'h1',
      type: 'HPA',
      data: {
        label: 'My HPA',
        minReplicas: 2,
        maxReplicas: 5,
        targetCPU: 70,
        targetMemory: 80
      }
    } as any;

    render(
      <ReactFlowProvider>
        <HPANode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getAllByText(/70%/)).toBeDefined();
    expect(screen.getAllByText(/80%/)).toBeDefined();
  });

  it('shows warning when connected to deployment without resource requests', () => {
    const deploymentNode = {
        id: 'd1',
        type: 'Deployment',
        data: { label: 'My Dep' }
    };
    const edge = { id: 'e1', source: 'h1', target: 'd1' };

    useFlowStore.setState({
        nodes: [deploymentNode],
        edges: [edge]
    } as any);

    const props = {
      id: 'h1',
      type: 'HPA',
      data: { label: 'My HPA' }
    } as any;

    render(
      <ReactFlowProvider>
        <HPANode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/Missing Resource Requests on Target/)).toBeDefined();
  });

  it('respects displaySettings', () => {
    const props = {
      id: 'h1',
      type: 'HPA',
      data: {
        label: 'My HPA',
        displaySettings: {
            replicas: false,
            targetCPU: false,
            targetMemory: false
        }
      }
    } as any;

    render(
      <ReactFlowProvider>
        <HPANode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText('min:')).toBeNull();
    expect(screen.queryByText('max:')).toBeNull();
    expect(screen.queryByTestId('progress-bar')).toBeNull();
  });
});
