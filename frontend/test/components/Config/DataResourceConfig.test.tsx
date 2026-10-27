import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataResourceConfig } from '@/components/Config/DataResourceConfig';
import { useFlowStore } from '@/store';

describe('DataResourceConfig', () => {
  const performUpdate = vi.fn();
  const toggleVisibility = vi.fn();
  const toggleYaml = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly for ConfigMap', () => {
    const selectedNode = {
      id: 'cm1',
      type: 'ConfigMap',
      data: {
        label: 'My CM',
        configData: [{ id: '1', key: 'K1', value: 'V1' }],
        displaySettings: { data: true },
        yamlSettings: { data: false }
      }
    };

    render(
      <DataResourceConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Data (Key-Value)')).toBeDefined();
    expect(screen.getByDisplayValue('K1')).toBeDefined();
    expect(screen.getByDisplayValue('V1')).toBeDefined();
  });

  it('handles undefined configData fallback in selectedNode.data', () => {
    const selectedNodeWithoutConfigData = {
      id: 'cm2',
      type: 'ConfigMap',
      data: {
        label: 'My CM Empty',
        // configData is omitted to trigger configData = data.configData || []
        displaySettings: { data: true }
      }
    };

    render(
      <DataResourceConfig
        selectedNode={selectedNodeWithoutConfigData}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('No configuration data yet')).toBeDefined();
  });

  it('renders correctly for Secret with empty configData fallback text', () => {
    const selectedNode = {
      id: 's1',
      type: 'Secret',
      data: {
        label: 'My Secret',
        // configData is omitted
        displaySettings: { data: true }
      }
    };

    render(
      <DataResourceConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Secrets (Key-Value)')).toBeDefined();
    expect(screen.getByText('No secret data yet')).toBeDefined();
  });

  it('handles adding new items and toggles, triggering onToggle and onYamlToggle callbacks on lines 54 and 56', () => {
    const selectedNode = {
      id: 'cm1',
      type: 'ConfigMap',
      data: {
        label: 'My CM',
        configData: [],
        displaySettings: { data: true },
        yamlSettings: { data: true }
      }
    };

    const { container } = render(
      <DataResourceConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const addBtn = screen.getByText('Add Item');
    fireEvent.click(addBtn);

    expect(performUpdate).toHaveBeenCalledWith(expect.objectContaining({
      configData: [expect.objectContaining({ key: '', value: '' })]
    }));

    // Render with configData having items so YamlToggle is enabled
    const activeSelectedNode = {
      ...selectedNode,
      data: {
        ...selectedNode.data,
        configData: [{ id: '1', key: 'K1', value: 'V1' }],
      }
    };

    const { container: containerActive } = render(
      <DataResourceConfig
        selectedNode={activeSelectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const eyeBtn = containerActive.querySelector('button[title*="Show/Hide"]') || containerActive.querySelectorAll('button')[0];
    const yamlBtn = containerActive.querySelector('button[title*="YAML"]') || containerActive.querySelectorAll('button')[1];

    if (eyeBtn) fireEvent.click(eyeBtn);
    if (yamlBtn) fireEvent.click(yamlBtn);

    expect(toggleVisibility).toHaveBeenCalledWith('data');
    expect(toggleYaml).toHaveBeenCalledWith('data');
  });
});
