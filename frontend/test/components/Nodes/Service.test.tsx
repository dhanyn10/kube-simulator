import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceNode } from '../../../src/components/Nodes/Service';
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

describe('ServiceNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly with default data', () => {
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
    expect(screen.getByText('port:')).toBeDefined();
    expect(screen.getByText('targetPort:')).toBeDefined();
    expect(screen.getByText('Selector')).toBeDefined();
    expect(screen.getByText('app: app-label')).toBeDefined();
  });

  it('renders custom ports and selector', () => {
    const props = {
      id: 's1',
      type: 'Service',
      data: {
        label: 'My Service',
        port: 8080,
        targetPort: 9090,
        selector: 'my-app'
      }
    } as any;

    render(
      <ReactFlowProvider>
        <ServiceNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('8080')).toBeDefined();
    expect(screen.getByText('9090')).toBeDefined();
    expect(screen.getByText('app: my-app')).toBeDefined();
  });

  it('respects displaySettings', () => {
    const props = {
      id: 's1',
      type: 'Service',
      data: {
        label: 'My Service',
        displaySettings: {
            port: false,
            targetPort: false,
            selector: false
        }
      }
    } as any;

    render(
      <ReactFlowProvider>
        <ServiceNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText('port:')).toBeNull();
    expect(screen.queryByText('targetPort:')).toBeNull();
    expect(screen.queryByText('Selector')).toBeNull();
  });
});
