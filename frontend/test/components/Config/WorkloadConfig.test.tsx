import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkloadConfig, isControllerPodNode } from '@/components/Config/WorkloadConfig';
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

    const redisOption = screen.getByText('redis:7-alpine');
    fireEvent.click(redisOption);

    expect(performUpdate).toHaveBeenCalledWith({ image: 'redis:7-alpine', status: 'ready' });
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

  it('renders "Pod List & Setup" button only when replicas > 3 and opens modal on click', () => {
    const dep3 = {
      id: 'dep-3',
      type: 'Deployment',
      data: { label: 'dep-3', replicas: 3 }
    };
    useFlowStore.setState({ nodes: [dep3] as any });

    const { rerender } = render(
      <WorkloadConfig
        selectedNode={dep3}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.queryByTestId('open-workload-pods-modal-btn')).toBeNull();

    const dep4 = {
      id: 'dep-4',
      type: 'Deployment',
      data: { label: 'dep-4', replicas: 4 }
    };
    useFlowStore.setState({ nodes: [dep4] as any });

    rerender(
      <WorkloadConfig
        selectedNode={dep4}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const openBtn = screen.getByTestId('open-workload-pods-modal-btn');
    expect(openBtn).toBeDefined();
    expect(screen.getByText('Pod List & Setup')).toBeDefined();
    expect(screen.getByText('4 Pods')).toBeDefined();

    fireEvent.click(openBtn);
    expect(screen.getByText(/dep-4 Workload Manager/i)).toBeDefined();

    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(screen.queryByText(/dep-4 Workload Manager/i)).toBeNull();
  });

  it('renders Worker Node selector when replicas <= 3 and hides it when replicas > 3', () => {
    const pod3 = {
      id: 'p3',
      type: 'Pod',
      parentId: 'dep-p3',
      data: { label: 'pod-3', assignedNode: 'worker-1' }
    };
    const dep3 = {
      id: 'dep-p3',
      type: 'Deployment',
      data: { label: 'dep-p3', replicas: 3 }
    };
    useFlowStore.setState({ nodes: [dep3, pod3] as any });

    const { rerender } = render(
      <WorkloadConfig
        selectedNode={pod3}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    // replicas = 3: Worker Node selector is visible
    expect(screen.getByText('Worker Node')).toBeDefined();

    // Select worker-2 from options
    const worker2Btn = screen.getByRole('button', { name: 'worker-2' });
    fireEvent.click(worker2Btn);
    expect(performUpdate).toHaveBeenCalledWith({ assignedNode: 'worker-2' });

    // Toggle Worker Node visibility
    const wnHeader = screen.getByText('Worker Node').closest('div');
    const wnBtn = wnHeader?.querySelector('button');
    if (wnBtn) fireEvent.click(wnBtn);
    expect(toggleVisibility).toHaveBeenCalledWith('assignedNode');

    // Now update replicas to 4: Worker Node selector must be hidden and Pod List button appears
    const dep4 = {
      id: 'dep-p3',
      type: 'Deployment',
      data: { label: 'dep-p3', replicas: 4 }
    };
    useFlowStore.setState({ nodes: [dep4, pod3] as any });

    rerender(
      <WorkloadConfig
        selectedNode={pod3}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.queryByText('Worker Node')).toBeNull();
  });
  it('does not render Restart Policy section for Deployment or StatefulSet', () => {
    const deployNode = {
      id: 'd-test-restart',
      type: 'Deployment',
      data: {
        label: 'Deploy Test',
        replicas: 2,
        image: 'nginx:latest',
        restartPolicy: 'OnFailure',
      },
    };
    useFlowStore.setState({ nodes: [deployNode] as any });

    const { rerender } = render(
      <WorkloadConfig
        selectedNode={deployNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.queryByText('Restart Policy')).toBeNull();

    const statefulNode = {
      id: 'ss-test-restart',
      type: 'StatefulSet',
      data: {
        label: 'Stateful Test',
        replicas: 1,
        image: 'redis:latest',
      },
    };
    useFlowStore.setState({ nodes: [statefulNode] as any });

    rerender(
      <WorkloadConfig
        selectedNode={statefulNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.queryByText('Restart Policy')).toBeNull();
  });
  it('covers isControllerPodNode helper edge cases', () => {
    expect(isControllerPodNode(null)).toBe(false);
    expect(isControllerPodNode(undefined)).toBe(false);
    expect(isControllerPodNode({ id: 'p1', type: 'Pod', data: { replicas: 1 } })).toBe(false);
    expect(isControllerPodNode({ id: 'p1', type: 'Pod', parentId: 'dep-1', data: {} })).toBe(true);
    expect(isControllerPodNode({ id: 'p1', type: 'Pod', data: { parentId: 'dep-1' } })).toBe(true);
    expect(isControllerPodNode({ id: 'p1', type: 'Pod', data: { replicas: 2 } })).toBe(true);
    expect(isControllerPodNode({ id: 'p1', type: 'Pod', data: { parentReplicas: 3 } })).toBe(true);
    expect(isControllerPodNode({ id: 'p1', type: 'Pod', data: { workloadType: 'StatefulSet' } })).toBe(true);
  });

  it('locks Restart Policy to Always and shows controller hint for child Pod under Deployment', () => {
    const parentDep = { id: 'dep-1', type: 'Deployment', data: { label: 'my-dep', replicas: 2 } };
    const childPod = {
      id: 'p-child',
      type: 'Pod',
      parentId: 'dep-1',
      data: {
        label: 'my-dep-pod-1',
        restartPolicy: 'Always',
        displaySettings: { restartPolicy: true },
        yamlSettings: { restartPolicy: true },
      },
    };
    useFlowStore.setState({ colorMode: 'dark', nodes: [parentDep, childPod] as any });

    const { rerender } = render(
      <WorkloadConfig
        selectedNode={childPod}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Restart Policy')).toBeDefined();
    const hint = screen.getByTestId('controller-restart-policy-hint');
    expect(hint).toBeDefined();
    expect(hint.textContent).toContain('Controllers require restartPolicy: Always');

    // Attempt to click disabled Never button
    const neverBtn = screen.getByText('Never').closest('button')!;
    expect(neverBtn.disabled).toBe(true);
    fireEvent.click(neverBtn);
    expect(performUpdate).not.toHaveBeenCalled();

    // Click Always button
    const alwaysBtn = screen.getByText('Always').closest('button')!;
    fireEvent.click(alwaysBtn);
    expect(performUpdate).toHaveBeenCalledWith({ restartPolicy: 'Always' });

    // Test light colorMode rendering for controller hint
    useFlowStore.setState({ colorMode: 'light' });
    rerender(
      <WorkloadConfig
        selectedNode={childPod}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    const lightHint = screen.getByTestId('controller-restart-policy-hint');
    expect(lightHint.className).toContain('bg-blue-50');
  });
});
