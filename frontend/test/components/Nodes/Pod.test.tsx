import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PodNode } from '@/components/Nodes/Pod';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';

// Mock BaseNode since it's complex and uses many ReactFlow hooks
vi.mock('@/components/Nodes/BaseNode', () => ({
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

  it('renders restartPolicy in dark and light modes', () => {
    const props = {
      id: '1',
      type: 'Pod',
      data: {
        label: 'My Pod',
        restartPolicy: 'Always',
        displaySettings: { restartPolicy: true }
      }
    } as any;

    const { rerender } = render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('restart:')).toHaveClass('text-slate-500');
    expect(screen.getByText('Always')).toBeDefined();

    useFlowStore.setState({ colorMode: 'light' });
    rerender(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('restart:')).toHaveClass('text-slate-400');
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

  it('renders attached configMap variables with icon badge and hover card', () => {
    const props = {
      id: 'pod-1',
      type: 'Pod',
      data: {
        label: 'My Pod',
        configMaps: [{ id: 'cm-1', name: 'app-config', configData: [{ key: 'APP_ENV', value: 'production' }] }],
      },
    } as any;

    render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('pod-cm-badge-APP_ENV')).toBeInTheDocument();
    expect(screen.getByText('ConfigMap')).toBeInTheDocument();
    expect(screen.getByText('cm-1')).toBeInTheDocument();
    expect(screen.getByText('APP_ENV:')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
  });

  it('renders worker node assignment row and hides when displaySettings.assignedNode is false', () => {
    const props = {
      id: 'pod-worker-test',
      type: 'Pod',
      data: {
        label: 'My Pod',
        assignedNode: 'worker-2',
      },
    } as any;

    const { rerender } = render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('node:')).toBeInTheDocument();
    expect(screen.getByText('worker-2')).toBeInTheDocument();

    // Rerender with displaySettings.assignedNode = false
    rerender(
      <ReactFlowProvider>
        <PodNode {...props} data={{ ...props.data, displaySettings: { assignedNode: false } }} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText('node:')).toBeNull();
  });

  it('hides worker node row on stacked pod when parentReplicas > 3', () => {
    const props = {
      id: 'pod-stacked-test',
      type: 'Pod',
      parentId: 'dep-1',
      data: {
        label: 'My Stacked Pod',
        parentReplicas: 4,
        replicas: 4,
        assignedNode: 'worker-1',
      },
    } as any;

    render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );

    expect(screen.queryByText('node:')).toBeNull();
  });

  it('resolves type from data.type, then props.type, then Pod fallback', () => {
    // data.type is used when present
    const withDataType = {
      id: 'pod-type-1',
      type: 'Pod',
      data: { label: 'Typed Pod', type: 'Deployment' },
    } as any;
    const { unmount: unmount1 } = render(
      <ReactFlowProvider>
        <PodNode {...withDataType} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('Pod')).toBeDefined();
    unmount1();

    // falls back to props.type when data.type is missing
    const withPropsType = {
      id: 'pod-type-2',
      type: 'CustomType',
      data: { label: 'Props Type Pod' },
    } as any;
    const { unmount: unmount2 } = render(
      <ReactFlowProvider>
        <PodNode {...withPropsType} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('Pod')).toBeDefined();
    unmount2();

    // falls back to 'Pod' when neither is set
    const bare = {
      id: 'pod-type-3',
      type: undefined,
      data: { label: 'Bare Pod' },
    } as any;
    const { unmount: unmount3 } = render(
      <ReactFlowProvider>
        <PodNode {...bare} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('Pod')).toBeDefined();
    unmount3();
  });

  it('renders image row only when data.image is set and displaySettings.image is not false', () => {
    const withImage = {
      id: 'pod-img-1',
      type: 'Pod',
      data: { label: 'Img Pod', image: 'nginx:latest', displaySettings: { image: true } },
    } as any;
    const { rerender } = render(
      <ReactFlowProvider>
        <PodNode {...withImage} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('image:')).toBeDefined();
    expect(screen.getByText('nginx:latest')).toBeDefined();

    // image: false -> hidden even if data.image is set
    rerender(
      <ReactFlowProvider>
        <PodNode {...withImage} data={{ ...withImage.data, displaySettings: { image: false } }} />
      </ReactFlowProvider>
    );
    expect(screen.queryByText('image:')).toBeNull();

    // no image at all -> hidden
    const noImage = {
      id: 'pod-img-2',
      type: 'Pod',
      data: { label: 'No Img Pod' },
    } as any;
    const { unmount } = render(
      <ReactFlowProvider>
        <PodNode {...noImage} />
      </ReactFlowProvider>
    );
    expect(screen.queryByText('image:')).toBeNull();
    unmount();
  });

  it('renders image row in light mode', () => {
    useFlowStore.setState({ colorMode: 'light' });
    const props = {
      id: 'pod-img-light',
      type: 'Pod',
      data: { label: 'Light Img Pod', image: 'redis:7' },
    } as any;
    render(
      <ReactFlowProvider>
        <PodNode {...props} />
      </ReactFlowProvider>
    );
    expect(screen.getByText('image:')).toHaveClass('text-slate-400');
    expect(screen.getByText('redis:7')).toBeDefined();
  });
});
