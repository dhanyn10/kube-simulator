import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceConfig, SERVICE_TYPE_OPTIONS } from '@/components/Config/ServiceConfig';
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

  it('covers click outside behavior for dropdowns', () => {
    render(<ServiceConfig {...mockProps} />);

    const serviceTypeBtn = screen.getByRole('button', { name: /ClusterIP/i });
    fireEvent.click(serviceTypeBtn);
    expect(screen.getByText('Exposes service on each Node’s IP at a static port.')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Exposes service on each Node’s IP at a static port.')).toBeNull();

    // Open selector dropdown and click outside
    const selectorDropdownBtn = screen.getByRole('button', { name: /web-app/i });
    fireEvent.click(selectorDropdownBtn);
    expect(screen.getByText('backend-pod')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('backend-pod')).toBeNull();
  });

  it('covers namespace filtering when node has parentId', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'dep-ns1', type: 'Deployment', parentId: 'ns-1', data: { label: 'ns1-app' } },
        { id: 'dep-ns2', type: 'Deployment', parentId: 'ns-2', data: { label: 'ns2-app' } },
        { id: 'rs-ns1', type: 'ReplicaSet', parentId: 'ns-1', data: { label: 'ns1-rs' } },
        { id: 'pod-ns1', type: 'Pod', parentId: 'ns-1', data: { label: 'ns1-pod' } } // child pod with parentId should be ignored
      ] as any
    });

    const nsProps = {
      ...mockProps,
      selectedNode: {
        id: 's-ns1',
        parentId: 'ns-1',
        data: {
          serviceType: 'ClusterIP',
          selector: 'ns1-app'
        }
      }
    };

    render(<ServiceConfig {...nsProps} />);

    const selectorDropdownBtn = screen.getByRole('button', { name: /ns1-app/i });
    fireEvent.click(selectorDropdownBtn);

    expect(screen.getAllByText('ns1-app').length).toBeGreaterThan(0);
    expect(screen.getByText('ns1-rs')).toBeInTheDocument();
    expect(screen.queryByText('ns2-app')).toBeNull();
    expect(screen.queryByText('ns1-pod')).toBeNull();
  });

  it('covers Target Port input change and fallback values', () => {
    render(<ServiceConfig {...mockProps} />);

    const targetPortInput = screen.getAllByRole('spinbutton')[1];
    fireEvent.change(targetPortInput, { target: { value: '9000' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ targetPort: 9000 });

    fireEvent.change(targetPortInput, { target: { value: '' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ targetPort: 80 });
  });

  it('covers disabled option rendering and click in light and dark modes', () => {
    useFlowStore.setState({ colorMode: 'light' });

    // Mark LoadBalancer option as disabled to test isDisabled branch
    if (SERVICE_TYPE_OPTIONS && SERVICE_TYPE_OPTIONS[2]) {
      SERVICE_TYPE_OPTIONS[2].disabled = true;
    }

    render(<ServiceConfig {...mockProps} />);

    // Open dropdown in light mode
    const dropdownButton = screen.getByRole('button', { name: /ClusterIP/i });
    fireEvent.click(dropdownButton);

    // Verify disabled option rendering
    expect(screen.getByText('Disabled')).toBeInTheDocument();

    // Clicking disabled option should not perform update
    const disabledBtn = screen.getByText('Disabled').closest('button');
    if (disabledBtn) {
      fireEvent.click(disabledBtn);
    }
    expect(mockProps.performUpdate).not.toHaveBeenCalledWith({ serviceType: 'LoadBalancer' });

    // Verify non-selected service type option in light mode
    const nodePortOptBtn = screen.getByText('NodePort').closest('button');
    expect(nodePortOptBtn).toHaveClass('hover:bg-slate-100');

    // Restore disabled property
    if (SERVICE_TYPE_OPTIONS && SERVICE_TYPE_OPTIONS[2]) {
      delete SERVICE_TYPE_OPTIONS[2].disabled;
    }

    // Open selector dropdown in light mode and check selected/non-selected option styling
    const selectorDropdownBtn = screen.getByRole('button', { name: /web-app/i });
    fireEvent.click(selectorDropdownBtn);

    const selectedOptionBtn = screen.getByRole('button', { name: /web-app DEPLOYMENT/i });
    expect(selectedOptionBtn).toHaveClass('bg-amber-50');

    const nonSelectedOptionBtn = screen.getByText('backend-pod').closest('button');
    expect(nonSelectedOptionBtn).toHaveClass('hover:bg-slate-100');
  });
});
