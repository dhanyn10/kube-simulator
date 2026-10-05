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
        selector: 'app'
      }
    },
    performUpdate: vi.fn(),
    toggleVisibility: vi.fn(),
    toggleYaml: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('updates serviceType and conditionally shows NodePort input', () => {
    const { rerender } = render(<ServiceConfig {...mockProps} />);

    // Initially NodePort input is not rendered for ClusterIP
    expect(screen.queryByPlaceholderText('30000-32767 (Optional)')).toBeNull();

    // Select NodePort
    const typeSelect = screen.getByRole('combobox');
    fireEvent.change(typeSelect, { target: { value: 'NodePort' } });
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
          selector: 'app'
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

  it('updates port and handles empty/fallback values', () => {
    render(<ServiceConfig {...mockProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    // Primary port is the first spinbutton
    fireEvent.change(inputs[0], { target: { value: '8080' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ port: 8080 });

    fireEvent.change(inputs[0], { target: { value: '' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ port: 80 });
  });

  it('updates targetPort and selector directly without advanced section', () => {
    render(<ServiceConfig {...mockProps} />);

    // Advanced section is no longer present
    expect(screen.queryByText(/Advanced Options/i)).toBeNull();

    const inputs = screen.getAllByRole('spinbutton');
    // targetPort is second spinbutton (since serviceType is ClusterIP)
    fireEvent.change(inputs[1], { target: { value: '9090' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ targetPort: 9090 });

    fireEvent.change(inputs[1], { target: { value: '' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ targetPort: 80 });

    const selectorInput = screen.getByPlaceholderText('app-label');
    fireEvent.change(selectorInput, { target: { value: 'my-app' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ selector: 'my-app' });
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
          selector: 'app'
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

    const typeSelect = screen.getByRole('combobox');
    expect(typeSelect).toHaveClass('bg-slate-50 border-slate-200 text-slate-800');
  });
});
