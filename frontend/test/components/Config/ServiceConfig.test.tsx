import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceConfig } from '@/components/Config/ServiceConfig';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

describe('ServiceConfig', () => {
  const mockProps = {
    selectedNode: {
      id: 's1',
      data: {
        serviceType: 'ClusterIP',
        port: 80,
        targetPort: 8080,
        selector: 'web-app'
      }
    },
    performUpdate: vi.fn(),
    toggleVisibility: vi.fn(),
    toggleYaml: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'dep-1', type: 'Deployment', data: { label: 'web-app' } },
        { id: 'pod-1', type: 'Pod', data: { label: 'backend-pod' } }
      ] as any
    });
  });

  it('updates serviceType using custom dropdown and conditionally shows NodePort input', () => {
    const { rerender } = render(<ServiceConfig {...mockProps} />);

    // Initially NodePort input is not rendered for ClusterIP
    expect(screen.queryByPlaceholderText('30000-32767 (Optional)')).toBeNull();

    // Open dropdown
    const dropdownButton = screen.getByRole('button', { name: /ClusterIP/i });
    fireEvent.click(dropdownButton);

    // Select NodePort
    const nodePortOption = screen.getByText('NodePort');
    fireEvent.click(nodePortOption);
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ serviceType: 'NodePort' });

    // Rerender with NodePort service type
    const nodePortProps = {
      ...mockProps,
      selectedNode: {
        id: 's1',
        data: {
          serviceType: 'NodePort',
          nodePort: 30080,
          port: 80,
          targetPort: 8080,
          selector: 'web-app'
        }
      }
    };
    rerender(<ServiceConfig {...nodePortProps} />);

    // NodePort input should be visible
    const nodePortInput = screen.getByPlaceholderText('30000-32767 (Optional)');
    expect(nodePortInput).toBeInTheDocument();

    // Change NodePort value
    fireEvent.change(nodePortInput, { target: { value: '31000' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ nodePort: 31000 });

    // Clear NodePort value
    fireEvent.change(nodePortInput, { target: { value: '' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ nodePort: undefined });
  });

  it('renders LoadBalancer option as enabled and allows selecting LoadBalancer', () => {
    render(<ServiceConfig {...mockProps} />);

    // Open dropdown
    const dropdownButton = screen.getByRole('button', { name: /ClusterIP/i });
    fireEvent.click(dropdownButton);

    const loadBalancerOption = screen.getByText('LoadBalancer');
    const loadBalancerBtn = loadBalancerOption.closest('button');
    expect(loadBalancerBtn).not.toBeDisabled();

    // Clicking LoadBalancer should update serviceType
    if (loadBalancerBtn) {
      fireEvent.click(loadBalancerBtn);
    }
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ serviceType: 'LoadBalancer' });
  });

  it('renders Ingress options in selector dropdown when serviceType is LoadBalancer', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'ing-1', type: 'Ingress', data: { label: 'main-ingress' } },
        { id: 'dep-1', type: 'Deployment', data: { label: 'web-app' } }
      ] as any
    });

    const lbProps = {
      ...mockProps,
      selectedNode: {
        id: 's1',
        data: {
          serviceType: 'LoadBalancer',
          port: 80,
          targetPort: 8080,
          selector: 'main-ingress'
        }
      }
    };

    render(<ServiceConfig {...lbProps} />);

    // Verify trigger button shows selected Ingress label and INGRESS category badge
    expect(screen.getByText('main-ingress')).toBeInTheDocument();
    expect(screen.getByText('INGRESS')).toBeInTheDocument();

    // Open selector dropdown
    const selectorDropdownBtn = screen.getByRole('button', { name: /main-ingress/i });
    fireEvent.click(selectorDropdownBtn);

    // Click on web-app deployment option
    fireEvent.click(screen.getByText('web-app'));
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ selector: 'web-app' });
  });

  it('populates selector dropdown with canvas workload resources and updates selector', () => {
    render(<ServiceConfig {...mockProps} />);

    // Open selector dropdown
    const selectorDropdownBtn = screen.getByRole('button', { name: /web-app/i });
    fireEvent.click(selectorDropdownBtn);

    // Verify workload options from store
    const webAppElements = screen.getAllByText('web-app');
    expect(webAppElements.length).toBeGreaterThan(0);
    expect(screen.getByText('backend-pod')).toBeInTheDocument();

    // Select backend-pod
    fireEvent.click(screen.getByText('backend-pod'));
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ selector: 'backend-pod' });
  });

  it('does not render selector dropdown section when canvas has no matching options', () => {
    useFlowStore.setState({ nodes: [] });
    render(<ServiceConfig {...mockProps} />);

    expect(screen.queryByText('Selector (app)')).toBeNull();
  });

  it('updates port and handles empty/fallback values', () => {
    render(<ServiceConfig {...mockProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    // Primary port is the first spinbutton
    fireEvent.change(inputs[0], { target: { value: '8080' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ port: 8080 });

    fireEvent.change(inputs[0], { target: { value: '' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ port: 80 });
  });

  it('triggers visibility and yaml toggles across all fields including NodePort', () => {
    const nodePortProps = {
      ...mockProps,
      selectedNode: {
        id: 's1',
        data: {
          serviceType: 'NodePort',
          nodePort: 30080,
          port: 80,
          targetPort: 8080,
          selector: 'web-app'
        }
      }
    };
    render(<ServiceConfig {...nodePortProps} />);

    const toggleBtns = screen.getAllByTitle('Show/Hide on Card');
    // Toggles for: serviceType, nodePort, port, targetPort, selector
    expect(toggleBtns.length).toBe(5);
    fireEvent.click(toggleBtns[0]);
    expect(mockProps.toggleVisibility).toHaveBeenCalledWith('serviceType');
    fireEvent.click(toggleBtns[1]);
    expect(mockProps.toggleVisibility).toHaveBeenCalledWith('nodePort');
    fireEvent.click(toggleBtns[2]);
    expect(mockProps.toggleVisibility).toHaveBeenCalledWith('port');
    fireEvent.click(toggleBtns[3]);
    expect(mockProps.toggleVisibility).toHaveBeenCalledWith('targetPort');
    fireEvent.click(toggleBtns[4]);
    expect(mockProps.toggleVisibility).toHaveBeenCalledWith('selector');

    const yamlBtns = screen.getAllByTitle('Include in YAML');
    // Yaml toggles for: serviceType, nodePort, targetPort, selector
    expect(yamlBtns.length).toBe(4);
    fireEvent.click(yamlBtns[0]);
    expect(mockProps.toggleYaml).toHaveBeenCalledWith('serviceType');
    fireEvent.click(yamlBtns[1]);
    expect(mockProps.toggleYaml).toHaveBeenCalledWith('nodePort');
    fireEvent.click(yamlBtns[2]);
    expect(mockProps.toggleYaml).toHaveBeenCalledWith('targetPort');
    fireEvent.click(yamlBtns[3]);
    expect(mockProps.toggleYaml).toHaveBeenCalledWith('selector');
  });

  it('renders light mode styling when colorMode is light', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<ServiceConfig {...mockProps} />);

    const dropdownButton = screen.getByRole('button', { name: /ClusterIP/i });
    expect(dropdownButton).toHaveClass('bg-white border-slate-300 text-slate-800');
  });
});
