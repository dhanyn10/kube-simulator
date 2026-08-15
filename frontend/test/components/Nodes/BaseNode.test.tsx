import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BaseNode } from '../../../src/components/Nodes/BaseNode';
import { useFlowStore } from '../../../src/store';
import { ReactFlowProvider } from '@xyflow/react';
import { Box } from 'lucide-react';

describe('BaseNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  const defaultProps = {
    id: '1',
    type: 'Pod',
    title: 'Test Node',
    icon: Box,
    color: 'blue',
    data: { label: 'Node Label', replicas: 1, type: 'Pod' } as any
  };

  it('renders correctly with basic data', () => {
    render(
      <ReactFlowProvider>
        <BaseNode {...defaultProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Test Node')).toBeDefined();
    expect(screen.getByText('Node Label')).toBeDefined();
  });

  it('handles renaming and sanitizes name', () => {
    const onRename = vi.fn();
    const props = {
      ...defaultProps,
      data: { ...defaultProps.data, onRename }
    };

    render(
      <ReactFlowProvider>
        <BaseNode {...props} />
      </ReactFlowProvider>
    );

    const label = screen.getByText('Node Label');
    fireEvent.doubleClick(label);

    const input = screen.getByDisplayValue('Node Label');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.blur(input);

    expect(onRename).toHaveBeenCalledWith('new-name');
  });

  it('shows replicas badge when > 1', () => {
    const props = {
      ...defaultProps,
      data: { ...defaultProps.data, replicas: 5 }
    };
    render(
      <ReactFlowProvider>
        <BaseNode {...props} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('x5')).toBeDefined();
  });

  it('renders BaseNode with crashing status override and mega replicas (100)', () => {
    render(
      <ReactFlowProvider>
        <BaseNode
          id="mega-pod"
          type="Pod"
          title="Mega Pod"
          icon={Box}
          color="emerald"
          statusOverride="crashing"
          data={{
            label: 'mega-pod',
            type: 'Pod',
            replicas: 100,
            status: 'crashing',
            runtime: 'nodejs',
            webserver: 'nginx',
            image: 'custom/app:v1',
          }}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Crashing')).toBeDefined();
    expect(screen.getByText('x100')).toBeDefined();
  });
});
