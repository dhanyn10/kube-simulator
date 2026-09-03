import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IngressConfig } from '../../../src/components/Config/IngressConfig';
import { useFlowStore } from '../../../src/store';

describe('IngressConfig', () => {
  const performUpdate = vi.fn();
  const toggleVisibility = vi.fn();
  const toggleYaml = vi.fn();

  const selectedNode = {
    id: 'ing1',
    type: 'Ingress',
    data: {
      label: 'My Ingress',
      ingressHost: 'example.com',
      ingressPath: '/api',
      displaySettings: { host: true, path: true },
      yamlSettings: { path: true }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly and handles input updates', () => {
    render(
      <IngressConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Host')).toBeDefined();
    expect(screen.getByDisplayValue('example.com')).toBeDefined();

    const input = screen.getByDisplayValue('example.com');
    fireEvent.change(input, { target: { value: 'test.com' } });
    expect(performUpdate).toHaveBeenCalledWith({ ingressHost: 'test.com' });
  });

  it('handles path updates and toggle callbacks in advanced section', () => {
    render(
      <IngressConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    // Toggle host visibility button (eye icon inside Host ConfigSection)
    const hostToggleBtn = screen.getByText('Host').closest('div')?.querySelector('button');
    if (hostToggleBtn) {
      fireEvent.click(hostToggleBtn);
      expect(toggleVisibility).toHaveBeenCalledWith('host');
    }

    fireEvent.click(screen.getByText('Advanced Options'));
    expect(screen.getByText('Path')).toBeDefined();

    const pathInput = screen.getByDisplayValue('/api');
    fireEvent.change(pathInput, { target: { value: '/v1' } });
    expect(performUpdate).toHaveBeenCalledWith({ ingressPath: '/v1' });

    // Click path visibility and yaml toggles
    const pathSectionHeader = screen.getByText('Path').closest('div');
    const buttons = pathSectionHeader?.querySelectorAll('button') || [];
    buttons.forEach((btn) => fireEvent.click(btn));

    expect(toggleVisibility).toHaveBeenCalledWith('path');
    expect(toggleYaml).toHaveBeenCalledWith('path');
  });

  it('handles undefined host and path gracefully', () => {
    const emptyNode = {
      id: 'ing2',
      type: 'Ingress',
      data: {
        label: 'Empty Ingress',
        displaySettings: { host: true, path: true },
      }
    };

    render(
      <IngressConfig
        selectedNode={emptyNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByPlaceholderText('example.com')).toBeDefined();

    fireEvent.click(screen.getByText('Advanced Options'));
    expect(screen.getByPlaceholderText('/')).toBeDefined();
  });
});
