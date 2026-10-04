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
});
