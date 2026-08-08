import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InternetNode } from '../../../src/components/Nodes/Internet';
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

describe('InternetNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly with default data', () => {
    const props = {
      id: 'internet-1',
      type: 'Internet',
      data: { label: 'My Internet' }
    } as any;

    render(
      <ReactFlowProvider>
        <InternetNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Internet')).toBeDefined();
  });
});
