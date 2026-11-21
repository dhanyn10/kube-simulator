import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HPAConfig } from '@/components/Config/HPAConfig';
import { useFlowStore } from '@/store';

describe('HPAConfig', () => {
  const performUpdate = vi.fn();
  const toggleVisibility = vi.fn();
  const toggleYaml = vi.fn();

  const selectedNode = {
    id: 'hpa1',
    type: 'HPA',
    data: {
      label: 'My HPA',
      minReplicas: 2,
      maxReplicas: 5,
      targetCPU: 60,
      targetMemory: 70,
      displaySettings: { replicas: true, targetCPU: true, targetMemory: true },
      yamlSettings: { replicas: true, targetCPU: true, targetMemory: true }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [selectedNode],
      edges: [],
      colorMode: 'dark'
    });
  });

  it('renders NOT CONNECTED status when no target deployment', () => {
    render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    expect(screen.getByText('NOT CONNECTED')).toBeDefined();
  });

  it('renders target deployment without label fallback to target.id', () => {
    const depNodeNoLabel = {
      id: 'dep-id-only',
      type: 'Deployment',
      data: {}
    };
    useFlowStore.setState({
      nodes: [selectedNode, depNodeNoLabel],
      edges: [{ id: 'e1', source: 'hpa1', target: 'dep-id-only' }]
    });

    render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    expect(screen.getByText('MISSING RESOURCE LIMITS')).toBeDefined();
  });

  it('renders LINKED status when connected to deployment with limits', () => {
    const depNode = {
      id: 'dep1',
      type: 'Deployment',
      data: { label: 'My Dep', cpuLimit: '100m', memoryLimit: '128Mi' }
    };
    useFlowStore.setState({
      nodes: [selectedNode, depNode],
      edges: [{ id: 'e1', source: 'hpa1', target: 'dep1' }]
    });

    render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    expect(screen.getByText('LINKED TO MY DEP')).toBeDefined();
  });

  it('covers fallback branches: untyped target node, label fallback to id, and empty id fallback to empty string', () => {
    // 1. Target node without type (covers targetNode.type || '')
    const untypedNode = {
      id: 'untyped-1',
      type: undefined as any,
      data: {}
    };
    useFlowStore.setState({
      nodes: [selectedNode, untypedNode],
      edges: [{ id: 'e-untyped', source: 'hpa1', target: 'untyped-1' }]
    });

    const { unmount: unmount1 } = render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    expect(screen.getByText('MISSING RESOURCE LIMITS')).toBeDefined();
    unmount1();

    // 2. Target workload with limits but missing label (covers fallback to targetWorkload.id)
    const depWithLimitsNoLabel = {
      id: 'dep-id-linked',
      type: 'Deployment',
      data: { cpuLimit: '100m', memoryLimit: '128Mi' }
    };
    useFlowStore.setState({
      nodes: [selectedNode, depWithLimitsNoLabel],
      edges: [{ id: 'e-id-only', source: 'hpa1', target: 'dep-id-linked' }]
    });

    const { unmount: unmount2 } = render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    expect(screen.getByText('LINKED TO DEP-ID-LINKED')).toBeDefined();
    unmount2();

    // 3. Target workload with limits, empty label, and empty id (covers fallback to '')
    const depEmptyIdAndLabel = {
      id: '',
      type: 'Deployment',
      data: { label: '', cpuLimit: '100m', memoryLimit: '128Mi' }
    };
    useFlowStore.setState({
      nodes: [selectedNode, depEmptyIdAndLabel],
      edges: [{ id: 'e-empty-id', source: 'hpa1', target: '' }]
    });

    const { unmount: unmount3 } = render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    expect(screen.getByText('LINKED TO')).toBeDefined();
    unmount3();
  });

  it('handles replica range and CPU/Mem updates and toggles after opening advanced section', () => {
    render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    // Open advanced section
    const advancedBtn = screen.getByText('Advanced Options');
    fireEvent.click(advancedBtn);

    expect(screen.getByText('Replicas Range')).toBeDefined();
    expect(screen.getByText('Target CPU (%)')).toBeDefined();
    expect(screen.getByText('Target Mem (%)')).toBeDefined();

    // Trigger toggle visibility and yaml on Replicas Range
    const replicasHeader = screen.getByText('Replicas Range').closest('div');
    const replicasButtons = replicasHeader?.querySelectorAll('button') || [];
    replicasButtons.forEach((btn) => fireEvent.click(btn));

    expect(toggleVisibility).toHaveBeenCalledWith('replicas');
    expect(toggleYaml).toHaveBeenCalledWith('replicas');

    // Trigger toggle visibility and yaml on Target CPU (%)
    const cpuHeader = screen.getByText('Target CPU (%)').closest('div');
    const cpuButtons = cpuHeader?.querySelectorAll('button') || [];
    cpuButtons.forEach((btn) => fireEvent.click(btn));

    expect(toggleVisibility).toHaveBeenCalledWith('targetCPU');
    expect(toggleYaml).toHaveBeenCalledWith('targetCPU');

    // Select 80% on Target Mem (%) preset selector
    const preset80Btns = screen.getAllByText('80%');
    fireEvent.click(preset80Btns[preset80Btns.length - 1]);
    expect(performUpdate).toHaveBeenCalledWith({ targetMemory: 80 });

    // Test steppers for Min and Max replicas directly
    const minContainer = screen.getByText('Min').parentElement;
    const minPlusBtn = minContainer?.querySelectorAll('button')[1];
    if (minPlusBtn) fireEvent.click(minPlusBtn);
    expect(performUpdate).toHaveBeenCalledWith({ minReplicas: 3, maxReplicas: 5 });

    const maxContainer = screen.getByText('Max').parentElement;
    const maxPlusBtn = maxContainer?.querySelectorAll('button')[1];
    if (maxPlusBtn) fireEvent.click(maxPlusBtn);
    expect(performUpdate).toHaveBeenCalledWith({ minReplicas: 2, maxReplicas: 6 });
  });

  it('treats the creation default as editable and ignores a cleared replica input', () => {
    render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    fireEvent.click(screen.getByText('Advanced Options'));

    const maxInput = screen.getByText('Max').parentElement?.querySelector('input');
    if (!maxInput) throw new Error('Max input not found');

    fireEvent.change(maxInput, { target: { value: '' } });
    expect(performUpdate).not.toHaveBeenCalled();

    fireEvent.change(maxInput, { target: { value: '20' } });
    expect(performUpdate).toHaveBeenLastCalledWith({ minReplicas: 2, maxReplicas: 20 });

    fireEvent.change(maxInput, { target: { value: '10' } });
    expect(performUpdate).toHaveBeenLastCalledWith({ minReplicas: 2, maxReplicas: 10 });
  });

  it('handles range input changes and missing data fields', () => {
    const emptyDataNode = {
      id: 'hpa1',
      type: 'HPA',
      data: {
        label: 'My HPA',
        targetCPU: 50,
        displaySettings: { replicas: true, targetCPU: true, targetMemory: true },
        yamlSettings: { replicas: true, targetCPU: true, targetMemory: true }
      }
    };

    render(
      <HPAConfig
        selectedNode={emptyDataNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    fireEvent.click(screen.getByText('Advanced Options'));

    const sliders = screen.getAllByRole('slider');
    if (sliders.length > 0) {
      fireEvent.change(sliders[0], { target: { value: '70' } });
      expect(performUpdate).toHaveBeenCalledWith({ targetCPU: 70 });
    }
  });

  it('handles partial limits (cpuLimit without memoryLimit) and missing limits warning', () => {
    const depNodePartial = {
      id: 'dep1',
      type: 'Deployment',
      data: { label: 'My Dep', cpuLimit: '100m' }
    };
    useFlowStore.setState({
      nodes: [selectedNode, depNodePartial],
      edges: [{ id: 'e1', source: 'hpa1', target: 'dep1' }]
    });

    const { unmount } = render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('MISSING RESOURCE LIMITS')).toBeDefined();
    unmount();

    const depNode = {
      id: 'dep1',
      type: 'Deployment',
      data: { label: 'My Dep' }
    };
    useFlowStore.setState({
      nodes: [selectedNode, depNode],
      edges: [{ id: 'e1', source: 'hpa1', target: 'dep1' }]
    });

    render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('MISSING RESOURCE LIMITS')).toBeDefined();
    const fixBtn = screen.getByText('Fix automatically');
    fireEvent.click(fixBtn);

    const updatedDep = useFlowStore.getState().nodes.find(n => n.id === 'dep1');
    expect(updatedDep?.data.cpuLimit).toBe('500m');
    expect(updatedDep?.data.memoryLimit).toBe('256Mi');
  });

  it('handles Fix automatically when connected target is not a Deployment', () => {
    const podNode = {
      id: 'pod1',
      type: 'Pod',
      data: { label: 'My Pod' }
    };
    useFlowStore.setState({
      nodes: [selectedNode, podNode],
      edges: [{ id: 'e1', source: 'hpa1', target: 'pod1' }]
    });

    render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('MISSING RESOURCE LIMITS')).toBeDefined();
    const fixBtn = screen.getByText('Fix automatically');
    fireEvent.click(fixBtn);

    const updatedPod = useFlowStore.getState().nodes.find(n => n.id === 'pod1');
    expect(updatedPod?.data.cpuLimit).toBeUndefined();
  });

  it('renders LINKED status and supports Fix automatically for StatefulSet targets', () => {
    const ssNode = {
      id: 'ss1',
      type: 'StatefulSet',
      data: { label: 'My StatefulSet' }
    };
    useFlowStore.setState({
      nodes: [selectedNode, ssNode],
      edges: [{ id: 'e-ss', source: 'hpa1', target: 'ss1' }]
    });

    const { unmount } = render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('MISSING RESOURCE LIMITS')).toBeDefined();
    const fixBtn = screen.getByText('Fix automatically');
    fireEvent.click(fixBtn);

    const updatedSS = useFlowStore.getState().nodes.find(n => n.id === 'ss1');
    expect(updatedSS?.data.cpuLimit).toBe('500m');
    expect(updatedSS?.data.memoryLimit).toBe('256Mi');

    unmount();

    // Re-render with limits configured
    render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    expect(screen.getByText('LINKED TO MY STATEFULSET')).toBeDefined();
  });

  it('renders LINKED status for ReplicaSet targets with limits', () => {
    const rsNode = {
      id: 'rs1',
      type: 'ReplicaSet',
      data: { label: 'My ReplicaSet', cpuLimit: '100m', memoryLimit: '128Mi' }
    };
    useFlowStore.setState({
      nodes: [selectedNode, rsNode],
      edges: [{ id: 'e-rs', source: 'hpa1', target: 'rs1' }]
    });

    render(
      <HPAConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );
    expect(screen.getByText('LINKED TO MY REPLICASET')).toBeDefined();
  });
});
