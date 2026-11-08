import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimpleResourceNode } from '@/components/Nodes/SimpleResourceNode';
import { Database } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';

describe('SimpleResourceNode', () => {
  it('renders title, icon, and children inside BaseNode wrapper', () => {
    const props: any = {
      id: 'node-test-simple',
      type: 'Secret',
      selected: false,
      zIndex: 0,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      dragging: false,
      data: {
        label: 'my-custom-secret',
      },
    };

    render(
      <ReactFlowProvider>
        <SimpleResourceNode
          {...props}
          title="Secret Config"
          icon={Database}
          color="amber"
          bottomSourceClassName="bottom-class"
          rightSourceClassName="right-class"
        >
          <div data-testid="child-content">Secret Details</div>
        </SimpleResourceNode>
      </ReactFlowProvider>
    );

    expect(screen.getByText('my-custom-secret')).toBeDefined();
    expect(screen.getByTestId('child-content')).toBeDefined();
    expect(screen.getByText('Secret Details')).toBeDefined();
  });
});
