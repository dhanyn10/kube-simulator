import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IngressConfig } from '@/components/Config/IngressConfig';
import { useFlowStore } from '@/store';

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
      backendServiceName: 'web-service',
      displaySettings: { host: true, path: true, backendService: true },
      yamlSettings: { path: true, backendService: true }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'svc1', type: 'Service', data: { label: 'web-service', serviceType: 'ClusterIP' } },
        { id: 'svc2', type: 'Service', data: { label: 'api-service', serviceType: 'ClusterIP' } }
      ]
    });
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

  it('renders backend service dropdown and selects ClusterIP service', () => {
    render(
      <IngressConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Backend Service (ClusterIP)')).toBeDefined();
    const dropdownBtn = screen.getByRole('button', { name: /web-service/i });
    fireEvent.click(dropdownBtn);

    expect(screen.getByRole('button', { name: /api-service/i })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /api-service/i }));

    expect(performUpdate).toHaveBeenCalledWith({ backendServiceName: 'api-service' });
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

    // Toggle host visibility button
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
        displaySettings: { host: true, path: true, backendService: true },
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
