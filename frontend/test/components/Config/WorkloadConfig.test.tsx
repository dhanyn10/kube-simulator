import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkloadConfig } from '../../../src/components/Config/WorkloadConfig';
import { useFlowStore } from '../../../src/store';

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
    // Pod specific settings should NOT be visible
    expect(screen.queryByText('Container Image')).toBeNull();
  });

  it('renders correctly for Pod', () => {
    const selectedNode = {
      id: 'p1',
      type: 'Pod',
      data: {
        label: 'My Pod',
        image: 'nginx',
        displaySettings: { image: true, webserver: true, runtime: true }
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
    expect(screen.getByText('Web Server')).toBeDefined();
    expect(screen.getByText('App Runtime')).toBeDefined();
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

    // Should update the parent deployment
    expect(updateNodeData).toHaveBeenCalledWith('d1', { replicas: 2 });
  });

  it('handles runtime updates for Pod', () => {
    const selectedNode = {
        id: 'p1',
        type: 'Pod',
        data: { label: 'My Pod', displaySettings: { runtime: true } }
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

    const select = screen.getByDisplayValue('None');
    fireEvent.change(select, { target: { value: 'nodejs' } });

    expect(performUpdate).toHaveBeenCalledWith({ runtime: 'nodejs', framework: '' });
  });
});
