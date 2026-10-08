import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IngressNode } from '@/components/Nodes/Ingress';
import '@testing-library/jest-dom';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';

// Mock BaseNode
vi.mock('@/components/Nodes/BaseNode', () => ({
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

  it('renders host text styling in light colorMode', () => {
    useFlowStore.setState({ colorMode: 'light' });
    const props = {
      id: 'i1',
      type: 'Ingress',
      data: { label: 'My Ingress Light' }
    } as any;

    render(
      <ReactFlowProvider>
        <IngressNode {...props} />
      </ReactFlowProvider>
    );

    const hostEl = screen.getByText(/host: example.local/);
    expect(hostEl).toHaveClass('text-slate-500');
  });

  it('renders backend service resolution by label and by ID, and respects displaySettings.backendService', () => {
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'svc1', type: 'Service', data: { label: 'svc-label-1', serviceType: 'ClusterIP' } },
        { id: 'svc2', type: 'Service', data: { label: 'svc-label-2', serviceType: 'ClusterIP' } }
      ] as any
    });

    // 1. Target service found by matching label
    const { rerender } = render(
      <ReactFlowProvider>
        <IngressNode id="i1" type="Ingress" data={{ backendServiceName: 'svc-label-1' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('Backend Service')).toBeDefined();
    expect(screen.getByText('svc-label-1')).toBeDefined();

    // 2. Target service found by matching node ID
    rerender(
      <ReactFlowProvider>
        <IngressNode id="i2" type="Ingress" data={{ backendServiceName: 'svc2' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('svc-label-2')).toBeDefined();

    // 3. Backend service invalid or empty
    rerender(
      <ReactFlowProvider>
        <IngressNode id="i3" type="Ingress" data={{ backendServiceName: 'non-existent' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('---')).toBeDefined();

    // 4. displaySettings.backendService is false
    rerender(
      <ReactFlowProvider>
        <IngressNode id="i4" type="Ingress" data={{ displaySettings: { backendService: false } }} />
      </ReactFlowProvider>
    );
    expect(screen.queryByText('Backend Service')).toBeNull();
  });
});
