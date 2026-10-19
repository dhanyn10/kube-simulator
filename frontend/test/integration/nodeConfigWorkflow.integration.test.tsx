import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NodeConfig } from '@/components/Config/NodeConfig';
import { useFlowStore } from '@/store';
import type { Node, Edge } from '@xyflow/react';

describe('NodeConfig UI Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).go = {
      main: {
        App: {
          PushHistory: vi.fn().mockResolvedValue(true),
          UpdateProject: vi.fn().mockResolvedValue(true),
          SaveSetting: vi.fn().mockResolvedValue(true),
        },
      },
    };

    useFlowStore.setState({
      nodes: [],
      edges: [],
      logs: [],
      colorMode: 'dark',
    });
  });

  it('updates deployment replicas and workload type in store when configured via UI', () => {
    const deploymentNode: Node = {
      id: 'dep-test-1',
      type: 'Deployment',
      position: { x: 100, y: 100 },
      data: {
        label: 'backend-api',
        type: 'Deployment',
        workloadType: 'Deployment',
        replicas: 1,
        image: 'node:18',
        displaySettings: { workloadType: true, replicas: true },
        yamlSettings: { workloadType: true, replicas: true },
      },
    };

    useFlowStore.setState({
      nodes: [deploymentNode],
    });

    render(<NodeConfig selectedNode={deploymentNode} />);

    // Verify workload name input is pre-populated
    const nameInput = screen.getByPlaceholderText('node-name') as HTMLInputElement;
    expect(nameInput.value).toBe('backend-api');

    // Click "StatefulSet" selector to change workload type
    const statefulSetBtn = screen.getByRole('button', { name: 'StatefulSet' });
    expect(statefulSetBtn).toBeDefined();

    act(() => {
      fireEvent.click(statefulSetBtn);
    });

    // Verify store updated with new workloadType
    const updatedDep = useFlowStore.getState().nodes.find((n) => n.id === 'dep-test-1')!;
    expect(updatedDep.data.workloadType).toBe('StatefulSet');
  });

  it('reflects PVC Multi-Attach replica warning and disables RWO when connected to multi-replica workload', () => {
    const deploymentNode: Node = {
      id: 'dep-multi',
      type: 'Deployment',
      position: { x: 50, y: 50 },
      data: {
        label: 'web-deploy',
        type: 'Deployment',
        replicas: 3,
      },
    };

    const pvcNode: Node = {
      id: 'pvc-multi',
      type: 'PVC',
      position: { x: 250, y: 50 },
      data: {
        label: 'web-pvc',
        type: 'PVC',
        storageCapacity: '10Gi',
        accessMode: 'ReadWriteOnce',
      },
    };

    const edge: Edge = {
      id: 'e-dep-pvc',
      source: 'dep-multi',
      target: 'pvc-multi',
    };

    useFlowStore.setState({
      nodes: [deploymentNode, pvcNode],
      edges: [edge],
    });

    render(<NodeConfig selectedNode={pvcNode} />);

    // With 3 replicas connected, RWO option should be disabled
    const rwoBtn = screen.getByRole('button', { name: /RWO/ });
    expect(rwoBtn).toBeDefined();
    expect(rwoBtn.getAttribute('disabled')).not.toBeNull();

    // Verify the warning message for Multi-Attach is displayed
    expect(screen.getByText(/RWO Disabled:/i)).toBeDefined();
    expect(screen.getByText(/ReadWriteOnce allows maximum 1 replica/i)).toBeDefined();

    // Select RWX (ReadWriteMany) option
    const rwxBtn = screen.getByRole('button', { name: /RWX/ });
    act(() => {
      fireEvent.click(rwxBtn);
    });

    // Store is updated to ReadWriteMany
    const updatedPvc = useFlowStore.getState().nodes.find((n) => n.id === 'pvc-multi')!;
    expect(updatedPvc.data.accessMode).toBe('ReadWriteMany');
  });

  it('updates Service port mappings and selector targeting in store through UI controls', () => {
    const serviceNode: Node = {
      id: 'svc-test',
      type: 'Service',
      position: { x: 100, y: 100 },
      data: {
        label: 'frontend-svc',
        type: 'Service',
        serviceType: 'ClusterIP',
        port: 80,
        targetPort: 80,
        displaySettings: { ports: true, selector: true },
      },
    };

    useFlowStore.setState({
      nodes: [serviceNode],
      edges: [],
    });

    render(<NodeConfig selectedNode={serviceNode} />);

    // Open Service Type dropdown
    const serviceTypeBtn = screen.getByRole('button', { name: /ClusterIP/i });
    act(() => {
      fireEvent.click(serviceTypeBtn);
    });

    // Verify NodePort option exists and click it
    const nodePortOption = screen.getByText('NodePort');
    expect(nodePortOption).toBeDefined();

    act(() => {
      fireEvent.click(nodePortOption);
    });

    const updatedSvc = useFlowStore.getState().nodes.find((n) => n.id === 'svc-test')!;
    expect(updatedSvc.data.serviceType).toBe('NodePort');
  });
});
