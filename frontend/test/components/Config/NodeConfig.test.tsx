import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NodeConfig } from '@/components/Config/NodeConfig';
import { useFlowStore } from '@/store';

// Mock child components to simplify testing the dispatcher logic
vi.mock('@/components/Config/', () => ({
  WorkloadConfig: ({ toggleVisibility, performUpdate }: any) => (
    <div data-testid="workload-config">
        <button onClick={() => toggleVisibility('resources')} data-testid="toggle-resources">Toggle</button>
        <button onClick={() => performUpdate({ cpuLimit: '500m' })} data-testid="perform-update">Update</button>
    </div>
  ),
  ServiceConfig: () => <div data-testid="service-config">ServiceConfig</div>,
  IngressConfig: () => <div data-testid="ingress-config">IngressConfig</div>,
  HPAConfig: () => <div data-testid="hpa-config">HPAConfig</div>,
  InternetConfig: () => <div data-testid="internet-config">InternetConfig</div>,
  PVCConfig: () => <div data-testid="pvc-config">PVCConfig</div>,
  DataResourceConfig: () => <div data-testid="data-resource-config">DataResourceConfig</div>,
}));

describe('NodeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      colorMode: 'dark',
    });
  });

  it('renders correctly based on node type', () => {
    const podNode = { id: 'n1', type: 'Pod', data: { label: 'pod-1' } };
    const { rerender } = render(<NodeConfig selectedNode={podNode} />);
    expect(screen.getByTestId('workload-config')).toBeDefined();

    const svcNode = { id: 'n2', type: 'Service', data: { label: 'svc-1' } };
    rerender(<NodeConfig selectedNode={svcNode} />);
    expect(screen.getByTestId('service-config')).toBeDefined();
  });

  it('updates node name', async () => {
    const updateNodeDataSpy = vi.spyOn(useFlowStore.getState(), 'updateNodeData');
    const node = { id: 'n1', type: 'Pod', data: { label: 'pod-1' } };

    render(<NodeConfig selectedNode={node} />);
    const input = screen.getByPlaceholderText('node-name');

    fireEvent.change(input, { target: { value: 'New Pod Name' } });
    expect(updateNodeDataSpy).toHaveBeenCalledWith('n1', { label: 'new-pod-name' });
  });

  it('toggles visibility and syncs with peer pods', async () => {
    const updateNodeDataSpy = vi.spyOn(useFlowStore.getState(), 'updateNodeData');
    const node1 = { id: 'n1', type: 'Pod', data: { label: 'pod-a', displaySettings: { resources: true } } };
    const node2 = { id: 'n2', type: 'Pod', data: { label: 'pod-a', displaySettings: { resources: true } } };

    useFlowStore.setState({ nodes: [node1, node2] });

    render(<NodeConfig selectedNode={node1} />);
    fireEvent.click(screen.getByTestId('toggle-resources'));

    // Should update node1 and node2 (peer pod)
    expect(updateNodeDataSpy).toHaveBeenCalledWith('n1', expect.objectContaining({
        displaySettings: { resources: false }
    }));
    expect(updateNodeDataSpy).toHaveBeenCalledWith('n2', expect.objectContaining({
        displaySettings: { resources: false }
    }));
  });

  it('performs workload updates and handles metadata sync', () => {
    const updateNodeDataSpy = vi.spyOn(useFlowStore.getState(), 'updateNodeData');
    const node = { id: 'n1', type: 'Pod', data: { label: 'pod-1', status: 'ready', runtime: 'nodejs' } };

    render(<NodeConfig selectedNode={node} />);
    fireEvent.click(screen.getByTestId('perform-update'));

    expect(updateNodeDataSpy).toHaveBeenCalledWith('n1', expect.objectContaining({
        cpuLimit: '500m'
    }));
  });
});
