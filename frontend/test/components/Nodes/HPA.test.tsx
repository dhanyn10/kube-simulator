import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HPANode } from '@/components/Nodes/HPA';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';

// Mock BaseNode
vi.mock('@/components/Nodes/BaseNode', () => ({
  BaseNode: ({ children, title }: any) => (
    <div data-testid="base-node">
      <span>{title}</span>
      {children}
    </div>
  )
}));

// Mock ProgressBar to avoid deep rendering issues
vi.mock('@/components/Monitoring/ProgressBar', () => ({
  ProgressBar: ({ label, value, subLabel }: any) => (
    <div data-testid="progress-bar">
      <span>{label}</span>
      <span>{value}%</span>
      <span>{subLabel}</span>
    </div>
  )
}));

// Mock Handle from @xyflow/react to capture isValidConnection
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    Handle: ({ isValidConnection, id }: any) => (
      <div data-testid={`handle-${id}`} data-isvalid={isValidConnection ? 'has-fn' : 'none'} onClick={() => {
        if (isValidConnection) {
          (window as any)._lastIsValidDeployment = isValidConnection({ target: 'd1' });
          (window as any)._lastIsValidPod = isValidConnection({ target: 'p1' });
        }
      }} />
    ),
  };
});

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

  it('renders custom metrics and validates handles isValidConnection callback', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'd1', type: 'Deployment', data: {} } as any,
        { id: 'p1', type: 'Pod', data: {} } as any,
      ]
    });

    const props = {
      id: 'h1',
      type: 'HPA',
      data: {
        label: 'My HPA',
        minReplicas: 2,
        maxReplicas: 5,
        targetCPU: 70,
        currentCPU: 80,
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

    // Trigger handle click to test isValidConnection
    const handle = screen.getByTestId('handle-bottom-s');
    handle.click();

    expect((window as any)._lastIsValidDeployment).toBe(true);
    expect((window as any)._lastIsValidPod).toBe(false);
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
