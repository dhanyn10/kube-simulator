import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { WorkloadAdvancedConfig } from '@/components/Workload/WorkloadAdvancedConfig';
import { useFlowStore } from '@/store';

describe('WorkloadAdvancedConfig', () => {
  beforeEach(() => {
    useFlowStore.setState({
      nodes: [],
      edges: [],
      colorMode: 'dark',
    });
  });

  it('renders disabled YAML button when hasResources is false', () => {
    const performUpdate = vi.fn();
    const toggleVisibility = vi.fn();
    const toggleYaml = vi.fn();

    const selectedNode = {
      id: 'pod-1',
      data: {
        label: 'my-pod',
        displaySettings: { resources: false },
      },
    };

    render(
      <WorkloadAdvancedConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    // Open Advanced Options accordion
    fireEvent.click(screen.getByText('Advanced Options'));

    expect(screen.getByText('Resource Settings')).toBeDefined();
    const yamlButton = screen.getByTitle('No YAML configuration available for empty resources');
    expect(yamlButton).toBeDisabled();

    // Toggle visibility button
    const eyeButtons = screen.getAllByRole('button');
    // Eye button is the second button inside header
    fireEvent.click(eyeButtons[1]);
    expect(toggleVisibility).toHaveBeenCalledWith('resources');
  });

  it('renders enabled YAML button when hasResources is true', () => {
    const performUpdate = vi.fn();
    const toggleVisibility = vi.fn();
    const toggleYaml = vi.fn();

    const selectedNode = {
      id: 'pod-1',
      data: {
        label: 'my-pod',
        cpuRequest: '100m',
        memoryRequest: '128Mi',
        yamlSettings: { resources: true },
      },
    };

    render(
      <WorkloadAdvancedConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    // Open Advanced Options accordion
    fireEvent.click(screen.getByText('Advanced Options'));

    const yamlButton = screen.getByTitle('Include in YAML');
    expect(yamlButton).not.toBeDisabled();
    fireEvent.click(yamlButton);
    expect(toggleYaml).toHaveBeenCalledWith('resources');
  });

  it('renders HPA warning when targeted by HPA without requests', () => {
    useFlowStore.setState({
      nodes: [{ id: 'hpa-1', type: 'HPA', position: { x: 0, y: 0 }, data: {} }],
      edges: [{ id: 'e1', source: 'hpa-1', target: 'dep-1' }],
    });

    const selectedNode = {
      id: 'dep-1',
      data: {
        label: 'my-dep',
        cpuLimit: '500m',
        // missing cpuRequest and memoryRequest
      },
    };

    render(
      <WorkloadAdvancedConfig
        selectedNode={selectedNode}
        performUpdate={vi.fn()}
        toggleVisibility={vi.fn()}
        toggleYaml={vi.fn()}
      />
    );

    // Open Advanced Options accordion
    fireEvent.click(screen.getByText('Advanced Options'));

    expect(screen.getByText(/HPA detected. CPU\/Memory/)).toBeDefined();
  });
});
