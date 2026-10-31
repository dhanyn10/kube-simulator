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
    const selectorEl = screen.getByText('app: ---');
    expect(selectorEl).toBeDefined();
    expect(selectorEl.style.color).toBe('');
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
    const validSelectorEl = screen.getByText('app: my-app');
    expect(validSelectorEl).toBeDefined();
    expect(validSelectorEl.style.color).toBe('var(--color-mat-amber)');
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

  it('covers Deployment and ReplicaSet fallback matching via node ID when label/baseName are missing', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'dep-nolabel', type: 'Deployment', data: {} },
        { id: 'pod-dataparent', type: 'Pod', data: { parentId: 'dep-nolabel' } },
      ] as any
    });

    const { rerender } = render(
      <ReactFlowProvider>
        <ServiceNode id="s-idmatch" type="Service" data={{ selector: 'dep-nolabel' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('app: dep-nolabel')).toBeDefined();

    // Standalone pod with data.parentId set
    rerender(
      <ReactFlowProvider>
        <ServiceNode id="s-dataparentpod" type="Service" data={{ selector: 'pod-dataparent' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('app: ---')).toBeDefined();
  });

  it('covers standalone Pod matching by node ID fallback when label and baseName are missing', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'pod-id-only', type: 'Pod', data: {} }
      ] as any
    });

    render(
      <ReactFlowProvider>
        <ServiceNode id="s-podid" type="Service" data={{ selector: 'pod-id-only' }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('app: pod-id-only')).toBeDefined();
  });

  it('covers LoadBalancer service type targeting Deployment when Ingress node is also present on canvas', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'ing1', type: 'Ingress', data: { label: 'other-ingress' } },
        { id: 'dep1', type: 'Deployment', data: { label: 'target-dep' } },
      ] as any
    });

    render(
      <ReactFlowProvider>
        <ServiceNode id="s-lb-dep" type="Service" data={{ serviceType: 'LoadBalancer', selector: 'target-dep' }} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('app: target-dep')).toBeDefined();
  });

  it('covers explicit displaySettings.selector = true with invalid vs valid selector', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'dep1', type: 'Deployment', data: { label: 'valid-app' } }
      ] as any
    });

    const { rerender } = render(
      <ReactFlowProvider>
        <ServiceNode
          id="s-explicit-sel"
          type="Service"
          data={{
            selector: 'invalid-app',
            displaySettings: { selector: true }
          }}
        />
      </ReactFlowProvider>
    );

    const invalidEl = screen.getByText('app: ---');
    expect(invalidEl.style.color).toBe('');

    rerender(
      <ReactFlowProvider>
        <ServiceNode
          id="s-explicit-sel"
          type="Service"
          data={{
            selector: 'valid-app',
            displaySettings: { selector: true }
          }}
        />
      </ReactFlowProvider>
    );

    const validEl = screen.getByText('app: valid-app');
    expect(validEl.style.color).toBe('var(--color-mat-amber)');
  });

  it('renders nodePort in light mode', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(
      <ReactFlowProvider>
        <ServiceNode id="s-np-light" type="Service" data={{ serviceType: 'NodePort', nodePort: 30080 }} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('nodePort:')).toHaveClass('text-slate-400');

    // LoadBalancer with multiple ingressTargets
    useFlowStore.setState({
      nodes: [
        { id: 'ing-1', type: 'Ingress', data: { label: 'ingress-one' } },
        { id: 'ing-2', type: 'Ingress', data: {} },
      ] as any,
    });
    render(
      <ReactFlowProvider>
        <ServiceNode
          id="s-multi-ing"
          type="Service"
          data={{
            serviceType: 'LoadBalancer',
            ingressTargets: ['ingress-one', 'ing-2', 'stale-ingress'],
          }}
        />
      </ReactFlowProvider>
    );
    expect(screen.getByText('app: ingress-one, ing-2')).toBeDefined();
  });
});
