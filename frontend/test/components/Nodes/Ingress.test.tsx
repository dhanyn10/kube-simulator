import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IngressNode } from '../../../src/components/Nodes/Ingress';
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

describe('IngressNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly with default data', () => {
    const props = {
      id: 'i1',
      type: 'Ingress',
      data: { label: 'My Ingress' }
    } as any;

    render(
      <ReactFlowProvider>
        <IngressNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Ingress')).toBeDefined();
    expect(screen.getByText(/host: example.local/)).toBeDefined();
    expect(screen.getByText('Path')).toBeDefined();
    expect(screen.getByText('/')).toBeDefined();
  });

  it('renders custom host and path', () => {
    const props = {
      id: 'i1',
      type: 'Ingress',
      data: {
        label: 'My Ingress',
        ingressHost: 'api.example.com',
        ingressPath: '/api/v1'
      }
    } as any;

    render(
      <ReactFlowProvider>
        <IngressNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/host: api.example.com/)).toBeDefined();
    expect(screen.getByText('/api/v1')).toBeDefined();
  });

  it('respects displaySettings', () => {
    const props = {
      id: 'i1',
      type: 'Ingress',
      data: {
        label: 'My Ingress',
        displaySettings: {
            host: false,
            path: false
        }
      }
    } as any;

    render(
      <ReactFlowProvider>
        <IngressNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText(/host:/)).toBeNull();
    expect(screen.queryByText('Path')).toBeNull();
  });
});
