import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PVCNode } from '@/components/Nodes/PVC';
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

  it('renders Multi-Attach Error status badge and warning icon', () => {
    const props = {
      id: 'pvc1',
      type: 'PVC',
      data: {
        label: 'My PVC',
        accessMode: 'ReadWriteOnce',
        pvcStatus: 'Multi-Attach Error'
      }
    } as any;

    render(
      <ReactFlowProvider>
        <PVCNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Multi-Attach Error')).toBeDefined();
    expect(screen.getByText('RWO')).toBeDefined();
  });

  it('renders in light mode with storageClass correctly', () => {
    useFlowStore.setState({ colorMode: 'light' });

    const props = {
      id: 'pvc-light',
      type: 'PVC',
      data: {
        label: 'Light PVC',
        storageCapacity: '10Gi',
        storageClass: 'standard-light',
        accessMode: 'ReadWriteOnce',
        pvcStatus: 'Bound',
      },
    } as any;

    const { container } = render(
      <ReactFlowProvider>
        <PVCNode {...props} />
      </ReactFlowProvider>
    );

    const capacityLabel = screen.getByText('capacity:');
    expect(capacityLabel.className).toContain('text-slate-400');

    const accessLabel = screen.getByText('access:');
    expect(accessLabel.className).toContain('text-slate-400');

    const storageClassLabel = screen.getByText('Storage Class');
    expect(storageClassLabel.className).toContain('text-slate-400');

    const storageClassContainer = container.querySelector('.border-slate-100');
    expect(storageClassContainer).not.toBeNull();
  });
});
