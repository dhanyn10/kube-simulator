import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PodNode } from '../../../src/components/Nodes/Pod';
import { useFlowStore } from '../../../src/store';
import { ReactFlowProvider } from '@xyflow/react';

// Mock BaseNode since it's complex and uses many ReactFlow hooks
vi.mock('../../../src/components/Nodes/BaseNode', () => ({
  BaseNode: ({ children, title }: any) => (
    <div data-testid="base-node">
      <span>{title}</span>
      {children}
    </div>
  )
}));

describe('PodNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly with default data', () => {
    const props = {
      id: '1',
      type: 'Pod',
      data: { label: 'My Pod' }
    } as any;

    render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Pod')).toBeDefined();
  });

  it('renders resource limits when present in dark mode', () => {
    const props = {
      id: '1',
      type: 'Pod',
      data: {
        label: 'My Pod',
        cpuLimit: '200m',
        memoryLimit: '256Mi',
        displaySettings: { resources: true }
      }
    } as any;

    render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('cpu:')).toHaveClass('text-slate-500');
    expect(screen.getByText('200m')).toBeDefined();
    expect(screen.getByText('mem:')).toHaveClass('text-slate-500');
    expect(screen.getByText('256Mi')).toBeDefined();
  });

  it('renders resource limits in light mode with correct slate classes', () => {
    useFlowStore.setState({ colorMode: 'light' });
    const props = {
      id: '1',
      type: 'Pod',
      data: {
        label: 'My Pod',
        cpuLimit: '500m',
        memoryLimit: '512Mi',
        displaySettings: { resources: true }
      }
    } as any;

    render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('cpu:')).toHaveClass('text-slate-400');
    expect(screen.getByText('500m')).toBeDefined();
    expect(screen.getByText('mem:')).toHaveClass('text-slate-400');
    expect(screen.getByText('512Mi')).toBeDefined();
  });

  it('renders cpuLimit only when memoryLimit is absent', () => {
    const props = {
      id: '1',
      type: 'Pod',
      data: {
        label: 'My Pod',
        cpuLimit: '200m',
        displaySettings: { resources: true }
      }
    } as any;

    render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('cpu:')).toBeDefined();
    expect(screen.queryByText('mem:')).toBeNull();
  });

  it('renders memoryLimit only when cpuLimit is absent', () => {
    const props = {
      id: '1',
      type: 'Pod',
      data: {
        label: 'My Pod',
        memoryLimit: '256Mi',
        displaySettings: { resources: true }
      }
    } as any;

    render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText('cpu:')).toBeNull();
    expect(screen.getByText('mem:')).toBeDefined();
  });

  it('hides resources when displaySettings.resources is false', () => {
    const props = {
      id: '1',
      type: 'Pod',
      data: {
        label: 'My Pod',
        cpuLimit: '200m',
        displaySettings: { resources: false }
      }
    } as any;

    render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText('cpu:')).toBeNull();
  });
});
