import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HPAConfig } from '../../../src/components/Config/HPAConfig';
import { useFlowStore } from '../../../src/store';

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

  it('renders LINKED status when connected to deployment with requests', () => {
    const depNode = {
      id: 'dep1',
      type: 'Deployment',
      data: { label: 'My Dep', cpuRequest: '100m', memoryRequest: '128Mi' }
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
  });

  it('shows missing requests warning and allows fixing it', () => {
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

    expect(screen.getByText('MISSING RESOURCE REQUESTS')).toBeDefined();
    const fixBtn = screen.getByText('Fix automatically');
    fireEvent.click(fixBtn);

    const updatedDep = useFlowStore.getState().nodes.find(n => n.id === 'dep1');
    expect(updatedDep?.data.cpuRequest).toBe('100m');
  });
});
