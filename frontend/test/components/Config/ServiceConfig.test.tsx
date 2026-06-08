import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceConfig } from '../../../src/components/Config/ServiceConfig';
import { useFlowStore } from '../../../src/store';

describe('ServiceConfig', () => {
  const performUpdate = vi.fn();
  const toggleVisibility = vi.fn();
  const toggleYaml = vi.fn();

  const selectedNode = {
    id: 'svc1',
    type: 'Service',
    data: {
      label: 'My Service',
      port: 80,
      targetPort: 8080,
      selector: 'my-app',
      displaySettings: { port: true, targetPort: true, selector: true },
      yamlSettings: { targetPort: true, selector: true }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly', () => {
    render(
      <ServiceConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Port')).toBeDefined();
    expect(screen.getByDisplayValue('80')).toBeDefined();
  });

  it('handles port updates', () => {
    render(
      <ServiceConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const portInput = screen.getByDisplayValue('80');
    fireEvent.change(portInput, { target: { value: '8080' } });
    expect(performUpdate).toHaveBeenCalledWith({ port: 8080 });
  });

  it('renders advanced settings when toggled', () => {
    render(
      <ServiceConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const advancedBtn = screen.getByText('Advanced Options');
    fireEvent.click(advancedBtn);

    expect(screen.getByText('Target Port')).toBeDefined();
    expect(screen.getByText('Selector (app)')).toBeDefined();
    expect(screen.getByDisplayValue('8080')).toBeDefined();
    expect(screen.getByDisplayValue('my-app')).toBeDefined();
  });

  it('handles selector updates', () => {
    render(
      <ServiceConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    fireEvent.click(screen.getByText('Advanced Options'));
    const selectorInput = screen.getByDisplayValue('my-app');
    fireEvent.change(selectorInput, { target: { value: 'new-label' } });
    expect(performUpdate).toHaveBeenCalledWith({ selector: 'new-label' });
  });
});
