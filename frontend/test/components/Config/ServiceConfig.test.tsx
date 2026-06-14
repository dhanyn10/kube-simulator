import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceConfig } from '@/components/Config/ServiceConfig';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

describe('ServiceConfig', () => {
  const mockProps = {
    selectedNode: { id: 's1', data: { port: 80, targetPort: 8080, selector: 'app' } },
    performUpdate: vi.fn(),
    toggleVisibility: vi.fn(),
    toggleYaml: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('updates port', () => {
    render(<ServiceConfig {...mockProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '8080' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ port: 8080 });
  });

  it('updates targetPort and selector in advanced section', () => {
    render(<ServiceConfig {...mockProps} />);

    // Open advanced section
    const advancedBtn = screen.getByText(/Advanced Options/i);
    fireEvent.click(advancedBtn);

    const spinButtons = screen.getAllByRole('spinbutton');
    fireEvent.change(spinButtons[1], { target: { value: '9090' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ targetPort: 9090 });

    const input = screen.getByPlaceholderText('app-label');
    fireEvent.change(input, { target: { value: 'my-app' } });
    expect(mockProps.performUpdate).toHaveBeenCalledWith({ selector: 'my-app' });
  });

  it('triggers visibility toggle', () => {
    render(<ServiceConfig {...mockProps} />);
    const toggleBtns = screen.getAllByTitle('Show/Hide on Card');
    fireEvent.click(toggleBtns[0]);
    expect(mockProps.toggleVisibility).toHaveBeenCalledWith('port');
  });

  it('triggers yaml toggle in advanced section', () => {
    render(<ServiceConfig {...mockProps} />);

    // Open advanced section
    const advancedBtn = screen.getByText(/Advanced Options/i);
    fireEvent.click(advancedBtn);

    const yamlBtns = screen.getAllByTitle('Include in YAML');
    fireEvent.click(yamlBtns[0]);
    expect(mockProps.toggleYaml).toHaveBeenCalledWith('targetPort');
  });
});
