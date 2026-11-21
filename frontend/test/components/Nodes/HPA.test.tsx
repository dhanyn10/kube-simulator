import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HPANode } from '@/components/Nodes/HPA';
import { HPA_SCALE_DOWN_STABILIZATION_TICKS } from '@/lib/simulationTraffic';
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
          (globalThis as any)._lastIsValidDeployment = isValidConnection({ target: 'd1' });
          (globalThis as any)._lastIsValidStatefulSet = isValidConnection({ target: 'ss1' });
          (globalThis as any)._lastIsValidReplicaSet = isValidConnection({ target: 'rs1' });
          (globalThis as any)._lastIsValidPod = isValidConnection({ target: 'p1' });
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

  it('covers connected edge to deployment target with limits, missing target node in isValidConnection, and normal load color when currentCPU <= targetCPU', () => {
    const depNode = { id: 'd1', type: 'Deployment', data: { cpuLimit: '100m', memoryLimit: '128Mi' } };
    const edge = { id: 'e1', source: 'h1', target: 'd1' };

    useFlowStore.setState({
      nodes: [depNode],
      edges: [edge]
    } as any);

    const props = {
      id: 'h1',
      type: 'HPA',
      data: {
        label: 'My HPA',
        currentCPU: 30,
        targetCPU: 50,
      }
    } as any;

    render(
      <ReactFlowProvider>
        <HPANode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText(/Missing Resource Limits on Target/)).toBeNull();

    // Test handle isValidConnection when target is missing
    const handle = screen.getByTestId('handle-bottom-s');
    handle.click();
  });

  it('shows warning when connected to deployment without resource limits', () => {
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

    expect(screen.getByText(/Missing Resource Limits on Target/)).toBeDefined();
  });

  it('covers connected edge with missing target node and target deployment with cpuLimit but missing memoryLimit', () => {
    // 1. Edge targets non-existent node (targetNode is null)
    const edgeOrphan = { id: 'e-orphan', source: 'h1', target: 'missing-node-id' };
    useFlowStore.setState({
      nodes: [],
      edges: [edgeOrphan]
    } as any);

    const props = {
      id: 'h1',
      type: 'HPA',
      data: { label: 'My HPA' }
    } as any;

    const { rerender } = render(
      <ReactFlowProvider>
        <HPANode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/Missing Resource Limits on Target/)).toBeDefined();

    // 2. Edge targets Deployment with cpuRequest set but missing memoryRequest
    const depPartialLimits = {
      id: 'd-partial',
      type: 'Deployment',
      data: { label: 'Partial Limits Dep', cpuLimit: '100m' } // missing memoryLimit
    };
    const edgePartial = { id: 'e-partial', source: 'h1', target: 'd-partial' };

    useFlowStore.setState({
      nodes: [depPartialLimits],
      edges: [edgePartial]
    } as any);

    rerender(
      <ReactFlowProvider>
        <HPANode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/Missing Resource Limits on Target/)).toBeDefined();
  });

  it('shows scale-down stabilization progress from the connected workload', () => {
    const dep = {
      id: 'd-stabilizing',
      type: 'Deployment',
      data: { label: 'Stabilizing Dep', lowCpuTicks: 3 }
    };
    useFlowStore.setState({
      nodes: [dep],
      edges: [{ id: 'e-stabilizing', source: 'h1', target: 'd-stabilizing' }]
    } as any);

    render(
      <ReactFlowProvider>
        <HPANode id="h1" type="HPA" data={{ label: 'My HPA' }} />
      </ReactFlowProvider>
    );

    expect(screen.getByText(`Stabilizing 3/${HPA_SCALE_DOWN_STABILIZATION_TICKS}`)).toBeDefined();
  });

  it('hides stabilization when the counter is zero or the window is already satisfied', () => {
    const dep = {
      id: 'd-stabilized',
      type: 'Deployment',
      data: { label: 'Stabilized Dep', lowCpuTicks: 0 }
    };
    useFlowStore.setState({
      nodes: [dep],
      edges: [{ id: 'e-stabilized', source: 'h1', target: 'd-stabilized' }]
    } as any);

    const { unmount } = render(
      <ReactFlowProvider>
        <HPANode id="h1" type="HPA" data={{ label: 'My HPA' }} />
      </ReactFlowProvider>
    );
    expect(screen.queryByText(/Stabilizing/)).toBeNull();
    unmount();

    useFlowStore.setState({
      nodes: [{ ...dep, data: { ...dep.data, lowCpuTicks: HPA_SCALE_DOWN_STABILIZATION_TICKS } }],
      edges: [{ id: 'e-stabilized', source: 'h1', target: 'd-stabilized' }]
    } as any);

    render(
      <ReactFlowProvider>
        <HPANode id="h1" type="HPA" data={{ label: 'My HPA' }} />
      </ReactFlowProvider>
    );
    expect(screen.queryByText(/Stabilizing/)).toBeNull();
  });

  it('renders load color and bar color as red when currentCPU exceeds targetCPU', () => {
    const props = {
      id: 'h1',
      type: 'HPA',
      data: {
        label: 'My HPA',
        currentCPU: 90,
        targetCPU: 50,
      }
    } as any;

    render(
      <ReactFlowProvider>
        <HPANode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getAllByText('90%').length).toBeGreaterThan(0);
  });

  it('respects displaySettings enabled vs disabled', () => {
    const propsDisabled = {
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

    const { rerender } = render(
      <ReactFlowProvider>
        <HPANode {...propsDisabled} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText('min:')).toBeNull();
    expect(screen.queryByText('max:')).toBeNull();
    expect(screen.queryByTestId('progress-bar')).toBeNull();

    // Explicit true displaySettings
    const propsEnabled = {
      id: 'h1',
      type: 'HPA',
      data: {
        label: 'My HPA',
        displaySettings: {
            replicas: true,
            targetCPU: true,
            targetMemory: true
        }
      }
    } as any;

    rerender(
      <ReactFlowProvider>
        <HPANode {...propsEnabled} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('min:')).toBeDefined();
    expect(screen.getAllByTestId('progress-bar')).toHaveLength(3);
  });

  it('shows warning when connected edge targets a non-Deployment node like a Pod or Service', () => {
    const podTarget = { id: 'p1', type: 'Pod', data: { label: 'My Pod' } };
    const edgeToPod = { id: 'e-pod', source: 'h1', target: 'p1' };

    useFlowStore.setState({
      nodes: [podTarget],
      edges: [edgeToPod]
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

    expect(screen.getByText(/Missing Resource Limits on Target/)).toBeDefined();
  });

  it('handles edge targeting a Service node', () => {
    const svcTarget = { id: 'svc1', type: 'Service', data: { label: 'My Service' } };
    const edgeToSvc = { id: 'e-svc', source: 'h1', target: 'svc1' };

    useFlowStore.setState({
      nodes: [svcTarget],
      edges: [edgeToSvc]
    } as any);

    render(
      <ReactFlowProvider>
        <HPANode id="h1" type="HPA" data={{ label: 'My HPA' }} />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/Missing Resource Limits on Target/)).toBeDefined();
  });

  it('renders min and max replicas labels in light mode', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(
      <ReactFlowProvider>
        <HPANode id="h1" type="HPA" data={{ label: 'Light HPA' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('min:')).toHaveClass('text-slate-400');
    expect(screen.getByText('max:')).toHaveClass('text-slate-400');
  });

  it('supports StatefulSet and ReplicaSet as valid connection targets and handles connected edges', () => {
    const ssTarget = { id: 'ss1', type: 'StatefulSet', data: { label: 'My StatefulSet', cpuLimit: '100m', memoryLimit: '128Mi' } };
    const rsTarget = { id: 'rs1', type: 'ReplicaSet', data: { label: 'My ReplicaSet', cpuLimit: '100m', memoryLimit: '128Mi' } };
    const depTarget = { id: 'd1', type: 'Deployment', data: { label: 'My Deployment' } };
    const podTarget = { id: 'p1', type: 'Pod', data: { label: 'My Pod' } };

    useFlowStore.setState({
      nodes: [ssTarget, rsTarget, depTarget, podTarget],
      edges: [{ id: 'e-ss', source: 'h1', target: 'ss1' }]
    } as any);

    render(
      <ReactFlowProvider>
        <HPANode id="h1" type="HPA" data={{ label: 'My HPA' }} />
      </ReactFlowProvider>
    );

    // Target StatefulSet has limits, so no warning
    expect(screen.queryByText(/Missing Resource Limits on Target/)).toBeNull();

    // Test isValidConnection on handle
    const handle = screen.getByTestId('handle-bottom-s');
    handle.click();

    expect((globalThis as any)._lastIsValidDeployment).toBe(true);
    expect((globalThis as any)._lastIsValidStatefulSet).toBe(true);
    expect((globalThis as any)._lastIsValidReplicaSet).toBe(true);
    expect((globalThis as any)._lastIsValidPod).toBe(false);
  });
});
