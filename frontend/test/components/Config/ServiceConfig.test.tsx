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
    expect(toggleBtns).toHaveLength(5);
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
    expect(yamlBtns).toHaveLength(4);
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

  it('covers selectedNamespaceId fallback when parentId is missing but stored in data.parentId, and optionsMap label fallbacks', () => {
    // 1. selectedNode has parentId in data.parentId
    useFlowStore.setState({
      nodes: [
        { id: 'dep-ns-data', type: 'Deployment', parentId: 'ns-data', data: { label: 'ns-data-app' } },
        { id: 'dep-no-label', type: 'Deployment', parentId: 'ns-data', data: { label: 'dep-no-label' } }
      ] as any
    });

    const dataNsProps = {
      ...mockProps,
      selectedNode: {
        id: 's-data-ns',
        data: {
          parentId: 'ns-data',
          serviceType: 'ClusterIP',
          selector: 'ns-data-app'
        }
      }
    };

    render(<ServiceConfig {...dataNsProps} />);

    const selectorDropdownBtn = screen.getByRole('button', { name: /ns-data-app/i });
    fireEvent.click(selectorDropdownBtn);

    expect(screen.getByText('dep-no-label')).toBeInTheDocument();
  });

  it('covers serviceType fallbacks, missing selector showing "---", and light mode NodePort styling', () => {
    useFlowStore.setState({
      colorMode: 'light',
      nodes: [
        // Ingress without label (falls back to n.id) and duplicate Ingress (optionsMap.has branch)
        { id: 'ing-no-label', type: 'Ingress', data: {} },
        { id: 'ing-duplicate', type: 'Ingress', data: { label: 'ing-no-label' } },
        // Workload with empty parentId string
        { id: 'pod-empty-parent', type: 'Pod', parentId: '', data: { baseName: 'base-app' } },
        // Workload with neither label nor baseName (falls back to n.id)
        { id: 'pod-bare-id', type: 'Pod', parentId: undefined, data: {} },
        // Duplicate workload label (optionsMap.has branch)
        { id: 'pod-dup', type: 'Pod', parentId: undefined, data: { label: 'base-app' } },
        // Standalone Pod with label
        { id: 'pod-standalone', type: 'Pod', parentId: undefined, data: { label: 'standalone-app' } },
      ] as any,
    });

    const fallbackProps = {
      ...mockProps,
      selectedNode: {
        id: 's-fallback',
        data: {
          // serviceType undefined -> defaults to 'ClusterIP'
          serviceType: undefined,
          // selector undefined -> defaults to '' and displays '---'
          selector: undefined,
          nodePort: 30500,
        },
      },
    };

    const { rerender } = render(<ServiceConfig {...fallbackProps} />);

    // Selector shows '---' with text-rose-400
    expect(screen.getByText('---')).toHaveClass('text-rose-400');

    // Rerender with unknown serviceType and NodePort to test SERVICE_TYPE_OPTIONS fallback and light mode NodePort input
    const unknownTypeProps = {
      ...mockProps,
      selectedNode: {
        id: 's-unknown',
        data: {
          serviceType: 'UnknownType' as any,
          nodePort: 30500,
        },
      },
    };
    rerender(<ServiceConfig {...unknownTypeProps} />);

    // Rerender with LoadBalancer in light mode to cover Ingress fallbacks and light mode NodePort input
    const lbProps = {
      ...mockProps,
      selectedNode: {
        id: 's-lb',
        data: {
          serviceType: 'LoadBalancer',
          nodePort: 30500,
        },
      },
    };
    rerender(<ServiceConfig {...lbProps} />);

    const nodePortInput = screen.getByPlaceholderText('30000-32767 (Optional)');
    expect(nodePortInput).toHaveClass('bg-slate-50');

    // Open selector dropdown to verify options (ing-no-label, base-app, pod-bare-id, untyped-app)
    const selectorDropdownBtn = screen.getByRole('button', { name: /---/i });
    fireEvent.click(selectorDropdownBtn);

    expect(screen.getByText('ing-no-label')).toBeInTheDocument();
    expect(screen.getByText('base-app')).toBeInTheDocument();
    expect(screen.getByText('pod-bare-id')).toBeInTheDocument();
    expect(screen.getByText('standalone-app')).toBeInTheDocument();
  });

  it('handles clicking inside dropdowns without closing them, and disabled option onClick', () => {
    // Enable disabled on LoadBalancer
    if (SERVICE_TYPE_OPTIONS && SERVICE_TYPE_OPTIONS[2]) {
      SERVICE_TYPE_OPTIONS[2].disabled = true;
    }

    try {
      render(<ServiceConfig {...mockProps} />);

      // Open Service Type dropdown
      const stButton = screen.getByRole('button', { name: /ClusterIP/i });
      fireEvent.click(stButton);
      expect(screen.getByText('NodePort')).toBeInTheDocument();

      // Mouse down inside the dropdown menu (should NOT close it)
      const menu = screen.getByText('NodePort').closest('div');
      fireEvent.mouseDown(menu!);
      expect(screen.getByText('NodePort')).toBeInTheDocument();

      // Directly call onClick of the disabled option button to cover if (!isDisabled) else branch
      const disabledBtn = screen.getByText('Disabled').closest('button');
      expect(disabledBtn).toBeDisabled();
      const fiberKey = Object.keys(disabledBtn || {}).find(k => k.startsWith('__reactProps$'));
      if (fiberKey && (disabledBtn as any)[fiberKey]?.onClick) {
        (disabledBtn as any)[fiberKey].onClick();
      }

      // Open selector dropdown and mouse down inside it
      const selectorBtn = screen.getByRole('button', { name: /web-app/i });
      fireEvent.click(selectorBtn);
      const selectorMenu = screen.getByText('backend-pod').closest('div');
      fireEvent.mouseDown(selectorMenu!);
      expect(screen.getByText('backend-pod')).toBeInTheDocument();

      // Click outside document closes both
      fireEvent.mouseDown(document.body);
      expect(screen.queryByText('backend-pod')).toBeNull();

      useFlowStore.setState({
        nodes: [
          { id: 'ing-1', type: 'Ingress', data: { label: 'ing-alpha' } },
          { id: 'ing-2', type: 'Ingress', data: { label: 'ing-beta' } },
          { id: 'dep-1', type: 'Deployment', data: { label: 'web-app', port: 8080 } },
        ] as any,
      });

      const lbMultiProps = {
        ...mockProps,
        selectedNode: {
          id: 's-lb-multi',
          data: {
            serviceType: 'LoadBalancer',
            selector: 'ing-alpha',
            ingressTargets: ['ing-alpha'],
          },
        },
      };

      const { unmount } = render(<ServiceConfig {...lbMultiProps} />);
      fireEvent.click(screen.getByRole('button', { name: /ing-alpha/i }));

      const ingBetaOpt = screen.getByText('ing-beta').closest('button')!;
      fireEvent.click(ingBetaOpt);
      expect(mockProps.performUpdate).toHaveBeenCalledWith({
        selector: 'ing-alpha',
        ingressTargets: ['ing-alpha', 'ing-beta'],
      });

      const ingAlphaOpt = screen.getAllByText('ing-alpha')[1].closest('button')!;
      fireEvent.click(ingAlphaOpt);
      expect(mockProps.performUpdate).toHaveBeenCalledWith({
        selector: '',
        ingressTargets: undefined,
      });

      const workloadOpt = screen.getAllByText('web-app').at(-1)!.closest('button')!;
      fireEvent.click(workloadOpt);
      expect(mockProps.performUpdate).toHaveBeenCalledWith({
        selector: 'web-app',
        ingressTargets: undefined,
        targetPort: 8080,
      });
      unmount();

      render(
        <ServiceConfig
          {...mockProps}
          selectedNode={{
            id: 's-in-ns',
            parentId: 'ns-1',
            data: { serviceType: 'ClusterIP', selector: 'web-app' },
          }}
        />
      );
      fireEvent.click(screen.getAllByRole('button', { name: /ClusterIP/i }).at(-1)!);
      expect(screen.getByText('Outside Namespace Only')).toBeInTheDocument();
    } finally {
      if (SERVICE_TYPE_OPTIONS && SERVICE_TYPE_OPTIONS[2]) {
        delete SERVICE_TYPE_OPTIONS[2].disabled;
      }
    }
  });

  it('skips workload nodes that have no label, baseName or id when building selector options', () => {
    useFlowStore.setState({
      nodes: [
        { id: '', type: 'Deployment', data: {} },
        { id: 'dep-labeled', type: 'Deployment', data: { label: 'labeled-app' } },
      ] as any,
    });

    render(<ServiceConfig {...mockProps} selectedNode={{ id: 's-skip', data: { serviceType: 'ClusterIP', selector: 'labeled-app' } }} />);
    fireEvent.click(screen.getByRole('button', { name: /labeled-app/i }));

    expect(screen.getAllByText('labeled-app').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DEPLOYMENT')).toHaveLength(2);
  });
});
