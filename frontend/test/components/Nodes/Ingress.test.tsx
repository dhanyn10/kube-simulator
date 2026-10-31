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

  it('renders correctly with default data and does not render Backend Service on canvas card', () => {
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
    expect(screen.queryByText('Backend Service')).toBeNull();
  });

  it('renders custom host and path', () => {
    const props = {
      id: 'i1',
      type: 'Ingress',
      data: {
        label: 'My Ingress',
        ingressHost: 'api.example.com',
        ingressPath: '/api/v1',
        ingressClassName: 'traefik'
      }
    } as any;

    render(
      <ReactFlowProvider>
        <IngressNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText(/host: api.example.com/)).toBeDefined();
    expect(screen.getByText('/api/v1')).toBeDefined();
    expect(screen.getByText('traefik')).toBeDefined();
  });

  it('respects displaySettings', () => {
    const props = {
      id: 'i1',
      type: 'Ingress',
      data: {
        label: 'My Ingress',
        displaySettings: {
          host: false,
          ingressClassName: false,
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
    expect(screen.queryByText(/class:/)).toBeNull();
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

  it('renders multiple paths as block elements showing only path strings', () => {
    const props = {
      id: 'i-multi',
      type: 'Ingress',
      data: {
        label: 'Multi Path Ingress',
        displaySettings: { path: true },
        ingressPaths: [
          { id: 'p1', path: '/api', serviceName: 'api-svc' },
          { id: 'p2', path: '/payment', serviceName: 'pay-svc' },
        ],
      },
    } as any;

    render(
      <ReactFlowProvider>
        <IngressNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Paths (2)')).toBeDefined();
    const apiPath = screen.getByText('/api');
    const paymentPath = screen.getByText('/payment');
    expect(apiPath).toHaveClass('block');
    expect(paymentPath).toHaveClass('block');
    expect(screen.queryByText('Backend Service')).toBeNull();
  });
});
