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
      displaySettings: { replicas: true, targetCPU: true },
      yamlSettings: { replicas: true, targetCPU: true }
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

  it('handles replica range updates after opening advanced section', () => {
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
  });

  it('shows missing requests warning and allows fixing it', () => {
    const depNode = {
        id: 'dep1',
        type: 'Deployment',
        data: { label: 'My Dep' } // Missing requests
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
