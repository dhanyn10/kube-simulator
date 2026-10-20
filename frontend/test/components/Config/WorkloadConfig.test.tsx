import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkloadConfig } from '@/components/Config/WorkloadConfig';
import { useFlowStore } from '@/store';

describe('WorkloadConfig', () => {
  const performUpdate = vi.fn();
  const toggleVisibility = vi.fn();
  const toggleYaml = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark', nodes: [] });
  });

  it('renders correctly for Deployment', () => {
    const selectedNode = {
      id: 'd1',
      type: 'Deployment',
      data: { label: 'My Dep', replicas: 3 }
    };
    useFlowStore.setState({ nodes: [selectedNode] as any });

    render(
      <WorkloadConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Replicas')).toBeDefined();
    expect(screen.getByDisplayValue('3')).toBeDefined();
    expect(screen.queryByText('Container Image')).toBeNull();
  });

  it('renders correctly for Pod and handles toggling visibility / YAML for image and restart policy', () => {
    const selectedNode = {
      id: 'p1',
      type: 'Pod',
      data: {
        label: 'My Pod',
        image: 'nginx:latest',
        restartPolicy: 'Always',
        displaySettings: { image: true, restartPolicy: true },
        yamlSettings: { image: true, restartPolicy: true }
      }
    };
    useFlowStore.setState({ nodes: [selectedNode] as any });

    render(
      <WorkloadConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Container Image')).toBeDefined();
    expect(screen.getByText('Restart Policy')).toBeDefined();

    // Trigger toggle buttons on Container Image section
    const imgHeader = screen.getByText('Container Image').closest('div');
    const imgButtons = imgHeader?.querySelectorAll('button') || [];
    imgButtons.forEach((btn) => fireEvent.click(btn));
    expect(toggleVisibility).toHaveBeenCalledWith('image');
    expect(toggleYaml).toHaveBeenCalledWith('image');

    // Trigger toggle buttons on Restart Policy section
    const rpHeader = screen.getByText('Restart Policy').closest('div');
    const rpButtons = rpHeader?.querySelectorAll('button') || [];
    rpButtons.forEach((btn) => fireEvent.click(btn));
    expect(toggleVisibility).toHaveBeenCalledWith('restartPolicy');
    expect(toggleYaml).toHaveBeenCalledWith('restartPolicy');
  });

  it('handles replica updates for Deployment', () => {
    const updateNodeData = vi.fn();
    useFlowStore.setState({ updateNodeData } as any);

    const selectedNode = {
      id: 'd1',
      type: 'Deployment',
      data: { label: 'My Dep', replicas: 3 }
    };
    useFlowStore.setState({ nodes: [selectedNode] as any });

    render(
      <WorkloadConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const input = screen.getByDisplayValue('3');
    fireEvent.change(input, { target: { value: '5' } });

    expect(updateNodeData).toHaveBeenCalledWith('d1', { replicas: 5 });
  });

  it('renders Workload Type selector for StatefulSet type node and defaults to StatefulSet', () => {
    const selectedNode = {
      id: 'ss1',
      type: 'StatefulSet',
      data: {
        label: 'My StatefulSet',
        replicas: 3
      }
    };
    useFlowStore.setState({ nodes: [selectedNode] as any });

    render(
      <WorkloadConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Workload Type')).toBeDefined();
    const deployBtn = screen.getByRole('button', { name: 'Deployment' });
    fireEvent.click(deployBtn);

    expect(performUpdate).toHaveBeenCalledWith({ workloadType: 'Deployment' });
  });

  it('renders Workload Type selector for Deployment and allows switching workloadType', () => {
    const selectedNode = {
      id: 'd1',
      type: 'Deployment',
      data: {
        label: 'My Dep',
        replicas: 2,
        workloadType: 'Deployment',
        displaySettings: { workloadType: true },
        yamlSettings: { workloadType: true }
      }
    };
    useFlowStore.setState({ nodes: [selectedNode] as any });

    render(
      <WorkloadConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Workload Type')).toBeDefined();
    const statefulBtn = screen.getByRole('button', { name: 'StatefulSet' });
    fireEvent.click(statefulBtn);

    expect(performUpdate).toHaveBeenCalledWith({ workloadType: 'StatefulSet' });

    // Trigger toggle buttons on Workload Type section
    const wtHeader = screen.getByText('Workload Type').closest('div');
    const wtButtons = wtHeader?.querySelectorAll('button') || [];
    wtButtons.forEach((btn) => fireEvent.click(btn));
    expect(toggleVisibility).toHaveBeenCalledWith('workloadType');
    expect(toggleYaml).toHaveBeenCalledWith('workloadType');
  });

  it('renders StatefulSet recommendation banner when connected to RWO PVC with replicas > 1', () => {
    const pvcNode = {
      id: 'pvc1',
      type: 'PVC',
      data: { label: 'data-vol', accessMode: 'ReadWriteOnce' }
    };
    const depNode = {
      id: 'd1',
      type: 'Deployment',
      data: { label: 'My Dep', replicas: 3, workloadType: 'Deployment' }
    };
    const edge = { id: 'e1', source: 'd1', target: 'pvc1' };

    useFlowStore.setState({
      nodes: [pvcNode, depNode] as any,
      edges: [edge] as any
    });

    render(
      <WorkloadConfig
        selectedNode={depNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Stateful Workload Recommendation')).toBeDefined();
    const switchBtn = screen.getByRole('button', { name: 'Switch to StatefulSet Mode' });
    fireEvent.click(switchBtn);

    expect(performUpdate).toHaveBeenCalledWith({ workloadType: 'StatefulSet' });
  });

  it('handles replica updates for Pod in Deployment', () => {
    const updateNodeData = vi.fn();
    const parentDep = { id: 'd1', type: 'Deployment', position: {x:0, y:0}, data: { label: 'dep-a' } };
    const pod = { id: 'p1', type: 'Pod', parentId: 'd1', data: { label: 'pod-a', replicas: 1 } };

    useFlowStore.setState({
      updateNodeData,
      nodes: [parentDep, pod] as any
    });

    render(
      <WorkloadConfig
        selectedNode={pod}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '2' } });

    expect(updateNodeData).toHaveBeenCalledWith('d1', { replicas: 2 });
  });

  it('handles image selection via ImageDropdown', () => {
    const selectedNode = {
      id: 'p3',
      type: 'Pod',
      data: {
        label: 'Pod WS test',
        image: 'nginx:latest',
        displaySettings: { image: true }
      }
    };
    useFlowStore.setState({ nodes: [selectedNode] as any });

    render(
      <WorkloadConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    // Open image dropdown and select another image option
    const dropdownTrigger = screen.getByText('nginx:latest');
    fireEvent.click(dropdownTrigger);

    const redisOption = screen.getByText('redis:alpine');
    fireEvent.click(redisOption);

    expect(performUpdate).toHaveBeenCalledWith({ image: 'redis:alpine', status: 'ready' });
  });

  it('renders Restart Policy selector for Pod and handles policy updates', () => {
    const selectedNode = {
      id: 'p1',
      type: 'Pod',
      data: {
        label: 'My Pod',
        restartPolicy: 'Always',
        displaySettings: { restartPolicy: true },
        yamlSettings: { restartPolicy: true }
      }
    };
    useFlowStore.setState({ nodes: [selectedNode] as any });

    render(
      <WorkloadConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Restart Policy')).toBeDefined();
    const neverBtn = screen.getByText('Never');
    fireEvent.click(neverBtn);
    expect(performUpdate).toHaveBeenCalledWith({ restartPolicy: 'Never' });
  });

  it('covers Pod node with empty/undefined image and restartPolicy fallbacks, disabling YAML toggle when restartPolicy is falsy', () => {
    const emptyPodNode = {
      id: 'p-empty',
      type: 'Pod',
      data: {
        label: 'Empty Pod',
        image: undefined,
        restartPolicy: '',
        displaySettings: { image: true, restartPolicy: true },
        yamlSettings: { image: false, restartPolicy: false }
      }
    };
    useFlowStore.setState({ nodes: [emptyPodNode] as any });

    render(
      <WorkloadConfig
        selectedNode={emptyPodNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Container Image')).toBeDefined();
    expect(screen.getByText('Restart Policy')).toBeDefined();
  });

  it('handles selecting custom image in ImageDropdown triggering performUpdate with status ready', () => {
    const selectedNode = {
      id: 'p-clear',
      type: 'Pod',
      data: {
        label: 'Pod Custom Test',
        image: 'nginx:latest',
        displaySettings: { image: true }
      }
    };
    useFlowStore.setState({ nodes: [selectedNode] as any });

    render(
      <WorkloadConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    // Open image dropdown
    const dropdownTrigger = screen.getByText('nginx:latest');
    fireEvent.click(dropdownTrigger);

    // Search and select an option or use custom search input
    const searchInput = screen.getByPlaceholderText('Search or type custom image...');
    fireEvent.change(searchInput, { target: { value: 'my-custom-image' } });

    const useCustomBtn = screen.getByRole('button', { name: /Use custom image:/i });
    fireEvent.click(useCustomBtn);

    expect(performUpdate).toHaveBeenCalledWith({ image: 'my-custom-image', status: 'ready' });
  });

  it('covers disableYamlToggle when workloadType is undefined and suppresses StatefulSet recommendation banner when workloadType is StatefulSet', () => {
    // 1. Deployment without explicit workloadType -> disableYamlToggle = true
    const depWithoutWorkloadType = {
      id: 'd-no-wt',
      type: 'Deployment',
      data: {
        label: 'My Dep No WT',
        replicas: 2,
        workloadType: undefined,
        displaySettings: { workloadType: true },
        yamlSettings: { workloadType: true }
      }
    };
    useFlowStore.setState({ nodes: [depWithoutWorkloadType] as any });

    render(
      <WorkloadConfig
        selectedNode={depWithoutWorkloadType}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Workload Type')).toBeDefined();

    // 2. Connected to RWO PVC with replicas > 1, but workloadType is already StatefulSet -> banner suppressed
    const pvcNode = {
      id: 'pvc1',
      type: 'PVC',
      data: { label: 'data-vol', accessMode: 'ReadWriteOnce' }
    };
    const statefulDepNode = {
      id: 'd-ss',
      type: 'Deployment',
      data: { label: 'My Dep SS', replicas: 3, workloadType: 'StatefulSet' }
    };
    const edge = { id: 'e1', source: 'd-ss', target: 'pvc1' };

    useFlowStore.setState({
      nodes: [pvcNode, statefulDepNode] as any,
      edges: [edge] as any
    });

    const { rerender } = render(
      <WorkloadConfig
        selectedNode={statefulDepNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.queryByText('Stateful Workload Recommendation')).toBeNull();
  });

  it('covers empty image selection triggering performUpdate with status pending on line 108', () => {
    useFlowStore.setState({ customImages: [''] });
    const podNode = {
      id: 'p-empty-img',
      type: 'Pod',
      data: {
        label: 'Pod Empty Image Test',
        image: 'nginx:latest',
        displaySettings: { image: true },
      },
    };
    useFlowStore.setState({ nodes: [podNode] as any });

    render(
      <WorkloadConfig
        selectedNode={podNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    // Open dropdown
    const dropdownTrigger = screen.getByText('nginx:latest');
    fireEvent.click(dropdownTrigger);

    // Find local custom option with empty string
    const localSection = screen.getByText('Local & Custom Cache').closest('div');
    const localBtns = localSection?.querySelectorAll('button') || [];
    expect(localBtns.length).toBeGreaterThan(0);
    fireEvent.click(localBtns[0]);

    // Verify val ? 'ready' : 'pending' evaluated to 'pending'
    expect(performUpdate).toHaveBeenCalledWith({ image: '', status: 'pending' });
  });

  it('covers multi-replica RWO PVC recommendation banner when workloadType is undefined', () => {
    const pvcNode = {
      id: 'pvc-rwo',
      type: 'PVC',
      data: { label: 'vol-rwo', accessMode: 'ReadWriteOnce' },
    };
    const depNodeNoWT = {
      id: 'd-rwo',
      type: 'Deployment',
      data: { label: 'Dep RWO', replicas: 3 }, // workloadType is undefined
    };
    const edge = { id: 'e-rwo', source: 'd-rwo', target: 'pvc-rwo' };

    useFlowStore.setState({
      nodes: [pvcNode, depNodeNoWT] as any,
      edges: [edge] as any,
    });

    render(
      <WorkloadConfig
        selectedNode={depNodeNoWT}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    // Banner should be rendered because (data.workloadType || 'Deployment') evaluates to 'Deployment' !== 'StatefulSet'
    expect(screen.getByText('Stateful Workload Recommendation')).toBeDefined();
    const switchBtn = screen.getByRole('button', { name: 'Switch to StatefulSet Mode' });
    fireEvent.click(switchBtn);
    expect(performUpdate).toHaveBeenCalledWith({ workloadType: 'StatefulSet' });
  });

  it('covers WorkloadConfig with non-workload node type and OnFailure restart policy', () => {
    // 1. Non-workload type node (e.g. Service)
    const svcNode = {
      id: 'svc1',
      type: 'Service',
      data: { label: 'My Svc' },
    };
    useFlowStore.setState({ nodes: [svcNode] as any });

    const { rerender } = render(
      <WorkloadConfig
        selectedNode={svcNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.queryByText('Workload Type')).toBeNull();
    expect(screen.queryByText('Container Image')).toBeNull();
    expect(screen.getByText('Replicas')).toBeDefined();

    // 2. Pod with OnFailure restart policy
    const podOnFailure = {
      id: 'p-of',
      type: 'Pod',
      data: {
        label: 'Pod OnFailure',
        restartPolicy: 'OnFailure',
        displaySettings: { restartPolicy: true },
      },
    };
    useFlowStore.setState({ nodes: [podOnFailure] as any });

    rerender(
      <WorkloadConfig
        selectedNode={podOnFailure}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Restart Policy')).toBeDefined();
    const onFailureBtn = screen.getByRole('button', { name: 'On Failure' });
    expect(onFailureBtn).toBeDefined();
    fireEvent.click(onFailureBtn);
    expect(performUpdate).toHaveBeenCalledWith({ restartPolicy: 'OnFailure' });
  });

  it('renders HPA overlay and disables replica stepper when HPA is attached or connected', () => {
    // 1. Attached HPA on Deployment
    const depWithHpa = {
      id: 'dep-hpa-1',
      type: 'Deployment',
      data: {
        label: 'autoscale-dep',
        replicas: 4,
        hpas: [{ id: 'hpa-1', name: 'my-hpa', minReplicas: 2, maxReplicas: 8 }]
      }
    };
    useFlowStore.setState({ nodes: [depWithHpa] as any, edges: [], colorMode: 'dark' });

    const { rerender } = render(
      <WorkloadConfig
        selectedNode={depWithHpa}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByTestId('hpa-replica-overlay')).toBeDefined();
    expect(screen.getByText('Managed by HPA')).toBeDefined();

    const input = screen.getByDisplayValue('4') as HTMLInputElement;
    expect(input.disabled).toBe(true);

    // 2. Light mode test
    useFlowStore.setState({ colorMode: 'light' });
    rerender(
      <WorkloadConfig
        selectedNode={depWithHpa}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    expect(screen.getByTestId('hpa-replica-overlay')).toBeDefined();

    // 3. Child Pod with HPA connected to parent Deployment
    const parentDep = {
      id: 'parent-dep',
      type: 'Deployment',
      data: { label: 'parent-dep', replicas: 3 }
    };
    const childPod = {
      id: 'child-pod-1',
      type: 'Pod',
      parentId: 'parent-dep',
      data: { label: 'child-pod', parentId: 'parent-dep' }
    };
    const hpaNode = {
      id: 'hpa-node-1',
      type: 'HPA',
      data: { label: 'connected-hpa', minReplicas: 1, maxReplicas: 10 }
    };
    const edge = {
      id: 'e-hpa',
      source: 'hpa-node-1',
      target: 'parent-dep'
    };

    useFlowStore.setState({
      nodes: [parentDep, childPod, hpaNode] as any,
      edges: [edge] as any
    });

    rerender(
      <WorkloadConfig
        selectedNode={childPod}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByTestId('hpa-replica-overlay')).toBeDefined();
    expect(screen.getByText('Managed by HPA')).toBeDefined();
  });
});
