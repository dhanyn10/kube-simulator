import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ServiceNode } from '@/components/Nodes/Service';
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

describe('ServiceNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'dep1', type: 'Deployment', data: { label: 'my-app' } }
      ] as any
    });
  });

  it('renders correctly with default data in dark mode when selector is invalid', () => {
    const props = {
      id: 's1',
      type: 'Service',
      data: { label: 'My Service' }
    } as any;

    render(
      <ReactFlowProvider>
        <ServiceNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Service')).toBeDefined();
    expect(screen.getByText('type:')).toHaveClass('text-slate-500');
    expect(screen.getByText('ClusterIP')).toBeDefined();
    expect(screen.getByText('port:')).toHaveClass('text-slate-500');
    expect(screen.getByText('targetPort:')).toHaveClass('text-slate-500');
    expect(screen.getByText('Selector')).toBeDefined();
    expect(screen.getByText('app: ---')).toBeDefined();
  });

  it('renders correctly in light mode with light mode slate classes', () => {
    useFlowStore.setState({ colorMode: 'light' });
    const props = {
      id: 's1',
      type: 'Service',
      data: { label: 'My Service' }
    } as any;

    render(
      <ReactFlowProvider>
        <ServiceNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('type:')).toHaveClass('text-slate-400');
    expect(screen.getByText('port:')).toHaveClass('text-slate-400');
    expect(screen.getByText('targetPort:')).toHaveClass('text-slate-400');
  });

  it('renders custom ports, serviceType, nodePort, and valid selector', () => {
    const props = {
      id: 's1',
      type: 'Service',
      data: {
        label: 'My Service',
        serviceType: 'NodePort',
        port: 8080,
        targetPort: 9090,
        nodePort: 30080,
        selector: 'my-app'
      }
    } as any;

    render(
      <ReactFlowProvider>
        <ServiceNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('NodePort')).toBeDefined();
    expect(screen.getByText('8080')).toBeDefined();
    expect(screen.getByText('9090')).toBeDefined();
    expect(screen.getByText('nodePort:')).toBeDefined();
    expect(screen.getByText('30080')).toBeDefined();
    expect(screen.getByText('app: my-app')).toBeDefined();
  });

  it('respects displaySettings', () => {
    const props = {
      id: 's1',
      type: 'Service',
      data: {
        label: 'My Service',
        serviceType: 'NodePort',
        nodePort: 30080,
        displaySettings: {
          serviceType: false,
          port: false,
          targetPort: false,
          nodePort: false,
          selector: false
        }
      }
    } as any;

    render(
      <ReactFlowProvider>
        <ServiceNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText('type:')).toBeNull();
    expect(screen.queryByText('port:')).toBeNull();
    expect(screen.queryByText('targetPort:')).toBeNull();
    expect(screen.queryByText('nodePort:')).toBeNull();
    expect(screen.queryByText('Selector')).toBeNull();
  });

  it('validates selector matching for LoadBalancer, Ingress, ReplicaSet, and standalone vs child Pods', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'ing1', type: 'Ingress', data: { label: 'ingress-label' } },
        { id: 'ing2', type: 'Ingress', data: {} },
        { id: 'rs1', type: 'ReplicaSet', data: { baseName: 'rs-app' } },
        { id: 'pod-standalone', type: 'Pod', data: { baseName: 'standalone-pod' } },
        { id: 'pod-child', type: 'Pod', parentId: 'dep1', data: { label: 'child-pod' } }
      ] as any
    });

    // 1. Service Type LoadBalancer matching Ingress label
    const { rerender } = render(
      <ReactFlowProvider>
        <ServiceNode id="s-lb" type="Service" data={{ serviceType: 'LoadBalancer', nodePort: 31000, selector: 'ingress-label' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('app: ingress-label')).toBeDefined();
    expect(screen.getByText('nodePort:')).toBeDefined();

    // 2. Service Type LoadBalancer matching Ingress ID when label is empty
    rerender(
      <ReactFlowProvider>
        <ServiceNode id="s-lb2" type="Service" data={{ serviceType: 'LoadBalancer', selector: 'ing2' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('app: ing2')).toBeDefined();

    // 3. Service matching ReplicaSet baseName
    rerender(
      <ReactFlowProvider>
        <ServiceNode id="s-rs" type="Service" data={{ selector: 'rs-app' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('app: rs-app')).toBeDefined();

    // 4. Service matching standalone Pod baseName
    rerender(
      <ReactFlowProvider>
        <ServiceNode id="s-pod" type="Service" data={{ selector: 'standalone-pod' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('app: standalone-pod')).toBeDefined();

    // 5. Service attempting to target child Pod (should fail selector match and render '---')
    rerender(
      <ReactFlowProvider>
        <ServiceNode id="s-child" type="Service" data={{ selector: 'child-pod' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('app: ---')).toBeDefined();
  });
});
