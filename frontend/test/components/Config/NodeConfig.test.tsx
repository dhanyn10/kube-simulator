import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeConfig } from '@/components/Config/NodeConfig';
import { useFlowStore } from '@/store';

// Mock child components to simplify testing the dispatcher logic
vi.mock('@/components/Config/', () => ({
  WorkloadConfig: ({ toggleVisibility, performUpdate, toggleYaml }: any) => (
    <div data-testid="workload-config">
        <button onClick={() => toggleVisibility('resources')} data-testid="toggle-resources">Toggle Vis</button>
        <button onClick={() => toggleYaml('image')} data-testid="toggle-yaml">Toggle Yaml</button>
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
  const mockUpdateNodeData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      colorMode: 'dark',
      updateNodeData: mockUpdateNodeData,
    });
  });

  it('renders correctly based on node type', () => {
    const podNode = { id: 'n1', type: 'Pod', data: { label: 'pod-1' } };
    const { rerender } = render(<NodeConfig selectedNode={podNode} />);
    expect(screen.getByTestId('workload-config')).toBeDefined();

    const types = [
        { type: 'Service', testid: 'service-config' },
        { type: 'Ingress', testid: 'ingress-config' },
        { type: 'HPA', testid: 'hpa-config' },
        { type: 'Internet', testid: 'internet-config' },
        { type: 'PVC', testid: 'pvc-config' },
        { type: 'ConfigMap', testid: 'data-resource-config' },
        { type: 'Secret', testid: 'data-resource-config' },
    ];

    types.forEach(({ type, testid }) => {
        rerender(<NodeConfig selectedNode={{ id: 'n', type, data: {} }} />);
        expect(screen.getByTestId(testid)).toBeDefined();
    });
  });

  it('updates node name', async () => {
    const node = { id: 'n1', type: 'Pod', data: { label: 'pod-1' } };
    render(<NodeConfig selectedNode={node} />);
    const input = screen.getByPlaceholderText('node-name');

    fireEvent.change(input, { target: { value: 'New Pod Name' } });
    expect(mockUpdateNodeData).toHaveBeenCalledWith('n1', { label: 'new-pod-name' });
  });

  it('toggles visibility and syncs with peer pods and parent', async () => {
    const node1 = { id: 'n1', type: 'Pod', parentId: 'p1', data: { label: 'pod-a', displaySettings: { resources: true } } };
    const node2 = { id: 'n2', type: 'Pod', parentId: 'p1', data: { label: 'pod-a', displaySettings: { resources: true } } };
    const parent = { id: 'p1', type: 'Deployment', data: { label: 'dep-a' } };

    useFlowStore.setState({ nodes: [node1, node2, parent] });

    render(<NodeConfig selectedNode={node1} />);
    fireEvent.click(screen.getByTestId('toggle-resources'));

    // Should update node1, node2 (peer pod), and parent
    expect(mockUpdateNodeData).toHaveBeenCalledWith('n1', expect.objectContaining({
        displaySettings: { resources: false }
    }));
    expect(mockUpdateNodeData).toHaveBeenCalledWith('n2', expect.objectContaining({
        displaySettings: { resources: false }
    }));
    expect(mockUpdateNodeData).toHaveBeenCalledWith('p1', expect.objectContaining({
        displaySettings: { resources: false }
    }));
  });

  it('toggles yaml settings and syncs', async () => {
    const node1 = { id: 'n1', type: 'Pod', parentId: 'p1', data: { label: 'pod-a', yamlSettings: { image: true } } };
    const parent = { id: 'p1', type: 'Deployment', data: { label: 'dep-a' } };

    useFlowStore.setState({ nodes: [node1, parent] });

    render(<NodeConfig selectedNode={node1} />);
    fireEvent.click(screen.getByTestId('toggle-yaml'));

    expect(mockUpdateNodeData).toHaveBeenCalledWith('n1', expect.objectContaining({
        yamlSettings: { image: false }
    }));
    expect(mockUpdateNodeData).toHaveBeenCalledWith('p1', expect.objectContaining({
        yamlSettings: { image: false }
    }));
  });

  it('performs workload updates and handles parent sync', () => {
    const node = { id: 'n1', type: 'Pod', parentId: 'p1', data: { label: 'pod-1', status: 'ready' } };
    const parent = { id: 'p1', type: 'Deployment', data: { label: 'dep-1' } };

    useFlowStore.setState({ nodes: [node, parent] });

    render(<NodeConfig selectedNode={node} />);
    fireEvent.click(screen.getByTestId('perform-update'));

    expect(mockUpdateNodeData).toHaveBeenCalledWith('n1', expect.objectContaining({
        cpuLimit: '500m'
    }));
    // Parent should be synced
    expect(mockUpdateNodeData).toHaveBeenCalledWith('p1', {
        cpuLimit: '500m'
    });
  });

  it('shows correct status badge', () => {
    const readyNode = { id: 'n1', type: 'Service', data: { label: 'svc' } };
    const { rerender } = render(<NodeConfig selectedNode={readyNode} />);
    expect(screen.getByText(/Ready to Deploy/i)).toBeDefined();

    const notReadyNode = { id: 'n2', type: 'Pod', data: { label: 'pod', status: 'pending' } };
    rerender(<NodeConfig selectedNode={notReadyNode} />);
    expect(screen.getByText(/Configuration Required/i)).toBeDefined();
  });
});
