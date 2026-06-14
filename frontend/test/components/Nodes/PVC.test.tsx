import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PVCNode } from '../../../src/components/Nodes/PVC';
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

describe('PVCNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly with default data', () => {
    const props = {
      id: 'pvc1',
      type: 'PVC',
      data: { label: 'My PVC' }
    } as any;

    render(
      <ReactFlowProvider>
        <PVCNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('PVC')).toBeDefined();
    expect(screen.getByText('capacity:')).toBeDefined();
    expect(screen.getByText('1Gi')).toBeDefined();
    expect(screen.getByText('access:')).toBeDefined();
    expect(screen.getByText('RWO')).toBeDefined();
    expect(screen.getByText('Pending')).toBeDefined();
  });

  it('renders custom capacity, class and access mode', () => {
    const props = {
      id: 'pvc1',
      type: 'PVC',
      data: {
        label: 'My PVC',
        storageCapacity: '5Gi',
        storageClass: 'fast',
        accessMode: 'ReadOnlyMany',
        pvcStatus: 'Bound'
      }
    } as any;

    render(
      <ReactFlowProvider>
        <PVCNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('5Gi')).toBeDefined();
    expect(screen.getByText('fast')).toBeDefined();
    expect(screen.getByText('ROX')).toBeDefined();
    expect(screen.getByText('Bound')).toBeDefined();
  });

  it('handles ReadWriteMany access mode', () => {
    const props = {
      id: 'pvc1',
      type: 'PVC',
      data: {
        label: 'My PVC',
        accessMode: 'ReadWriteMany'
      }
    } as any;

    render(
      <ReactFlowProvider>
        <PVCNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('RWX')).toBeDefined();
  });
});
