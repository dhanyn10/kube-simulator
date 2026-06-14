import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecretNode } from '../../../src/components/Nodes/Secret';
import { useFlowStore } from '../../../src/store';
import { ReactFlowProvider } from '@xyflow/react';

// Mock BaseNode
vi.mock('../../../src/components/Nodes/BaseNode', () => ({
  BaseNode: ({ children, title }: any) => (
    <div data-testid="base-node">
      <span>{title}</span>
      {children}
    </div>
  )
}));

describe('SecretNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly with default data', () => {
    const props = {
      id: 's1',
      type: 'Secret',
      data: { label: 'My Secret' }
    } as any;

    render(
      <ReactFlowProvider>
        <SecretNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Secret')).toBeDefined();
  });

  it('renders correctly with config data', () => {
    const props = {
      id: 's1',
      type: 'Secret',
      data: {
        label: 'My Secret',
        configData: [{ key: 'k1', value: 'v1' }, { key: 'k2', value: 'v2' }]
      }
    } as any;

    render(
      <ReactFlowProvider>
        <SecretNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/Secrets \(2\)/)).toBeDefined();
    expect(screen.getByText('k1:')).toBeDefined();
    expect(screen.getByText('k2:')).toBeDefined();
  });

  it('handles more than 3 items', () => {
    const props = {
      id: 's1',
      type: 'Secret',
      data: {
        label: 'My Secret',
        configData: [
            { key: 'k1', value: 'v1' },
            { key: 'k2', value: 'v2' },
            { key: 'k3', value: 'v3' },
            { key: 'k4', value: 'v4' }
        ]
      }
    } as any;

    render(
      <ReactFlowProvider>
        <SecretNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('+ 1 more...')).toBeDefined();
  });

  it('respects displaySettings', () => {
    const props = {
      id: 's1',
      type: 'Secret',
      data: {
        label: 'My Secret',
        configData: [{ key: 'k1', value: 'v1' }],
        displaySettings: {
            data: false
        }
      }
    } as any;

    render(
      <ReactFlowProvider>
        <SecretNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText(/Secrets/)).toBeNull();
  });
});
