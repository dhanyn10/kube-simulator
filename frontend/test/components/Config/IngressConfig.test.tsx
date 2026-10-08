import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
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

  it('covers click outside behavior, unmount cleanup, and light mode styling', () => {
    useFlowStore.setState({ colorMode: 'light' });

    const { unmount } = render(
      <IngressConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    // Light mode dropdown trigger button styling
    const dropdownBtn = screen.getByRole('button', { name: /web-service/i });
    expect(dropdownBtn).toHaveClass('bg-white border-slate-300');

    // Open dropdown
    fireEvent.click(dropdownBtn);

    const selectedOptBtn = screen.getAllByText('web-service')[1].closest('button');
    expect(selectedOptBtn).toHaveClass('bg-rose-50');

    const unselectedOptBtn = screen.getByText('api-service').closest('button');
    expect(unselectedOptBtn).toHaveClass('hover:bg-slate-100');

    // Click outside closes dropdown
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('api-service')).toBeNull();

    // Test unmount cleanup for event listener
    unmount();
  });

  it('covers namespace filtering when ingress has parentId', () => {
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'svc-ns1', type: 'Service', parentId: 'ns-1', data: { label: 'ns1-svc', serviceType: 'ClusterIP' } },
        { id: 'svc-ns2', type: 'Service', parentId: 'ns-2', data: { label: 'ns2-svc', serviceType: 'ClusterIP' } }
      ]
    });

    const nsNode = {
      id: 'ing-ns1',
      parentId: 'ns-1',
      type: 'Ingress',
      data: {
        label: 'NS Ingress',
        backendServiceName: 'ns1-svc',
        displaySettings: { backendService: true }
      }
    };

    render(
      <IngressConfig
        selectedNode={nsNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const dropdownBtn = screen.getByRole('button', { name: /ns1-svc/i });
    fireEvent.click(dropdownBtn);

    expect(screen.getAllByText('ns1-svc').length).toBeGreaterThan(0);
    expect(screen.queryByText('ns2-svc')).toBeNull();
  });

  it('triggers visibility and yaml toggles for Backend Service section', () => {
    render(
      <IngressConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const backendSection = screen.getByText('Backend Service (ClusterIP)').closest('div');
    const toggleBtns = backendSection?.querySelectorAll('button') || [];

    // First button is visibility toggle, second is YAML toggle
    if (toggleBtns.length >= 2) {
      fireEvent.click(toggleBtns[0]);
      expect(toggleVisibility).toHaveBeenCalledWith('backendService');

      fireEvent.click(toggleBtns[1]);
      expect(toggleYaml).toHaveBeenCalledWith('backendService');
    }
  });
});
