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

  it('renders correctly', () => {
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
  });

  it('handles host updates', () => {
    render(
      <IngressConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const input = screen.getByDisplayValue('example.com');
    fireEvent.change(input, { target: { value: 'test.com' } });
    expect(performUpdate).toHaveBeenCalledWith({ ingressHost: 'test.com' });
  });

  it('handles path updates in advanced section', () => {
    render(
      <IngressConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    fireEvent.click(screen.getByText('Advanced Options'));
    expect(screen.getByText('Path')).toBeDefined();
    const input = screen.getByDisplayValue('/api');
    fireEvent.change(input, { target: { value: '/v1' } });
    expect(performUpdate).toHaveBeenCalledWith({ ingressPath: '/v1' });
  });
});
