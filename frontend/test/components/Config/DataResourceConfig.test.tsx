import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataResourceConfig } from '../../../src/components/Config/DataResourceConfig';
import { useFlowStore } from '../../../src/store';

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

    expect(screen.getByText('Data (Key-Value)')).toBeDefined();
    expect(screen.getByDisplayValue('K1')).toBeDefined();
    expect(screen.getByDisplayValue('V1')).toBeDefined();
  });

  it('renders correctly for Secret', () => {
    const selectedNode = {
      id: 's1',
      type: 'Secret',
      data: {
        label: 'My Secret',
        configData: [{ id: '1', key: 'S1', value: 'V1' }],
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
    expect(screen.getByDisplayValue('S1')).toBeDefined();
    // Value input should be type password
    const valueInput = screen.getByDisplayValue('V1');
    expect(valueInput.getAttribute('type')).toBe('password');
  });

  it('handles adding new items', () => {
    const selectedNode = {
        id: 'cm1',
        type: 'ConfigMap',
        data: {
          label: 'My CM',
          configData: [],
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

    const addBtn = screen.getByText('Add Item');
    fireEvent.click(addBtn);

    expect(performUpdate).toHaveBeenCalledWith(expect.objectContaining({
        configData: [expect.objectContaining({ key: '', value: '' })]
    }));
  });
});
