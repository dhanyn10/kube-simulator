import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { WorkloadPodsModal } from '@/components/Modals/WorkloadPodsModal';
import { useFlowStore } from '@/store';

describe('WorkloadPodsModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark', nodes: [] });
  });

  const setupTestNodes = () => {
    const deployment = {
      id: 'deploy-1',
      type: 'Deployment',
      data: {
        label: 'web-app',
        replicas: 4,
        podHash: '1pd4l',
        image: 'nginx:latest',
        status: 'ready',
        restartPolicy: 'Always',
      },
    };

    const childPods = [
      {
        id: 'pod-1',
        type: 'Pod',
        parentId: 'deploy-1',
        data: {
          parentId: 'deploy-1',
          replicaSuffixes: ['ktdhh', 'e4u71', 'tns6q', '9a2bc'],
          podHash: '1pd4l',
        },
      },
    ];

    const allNodes = [deployment, ...childPods];
    useFlowStore.setState({ nodes: allNodes as any });
    return { deployment, childPods, allNodes };
  };

  it('renders modal with title, tabs, and pod list when isOpen is true', () => {
    const { deployment } = setupTestNodes();

    render(
      <WorkloadPodsModal
        isOpen={true}
        onClose={onClose}
        selectedNode={deployment}
      />
    );

    expect(screen.getByText(/web-app Workload Manager/i)).toBeDefined();
    expect(screen.getByText(/4 Replicas across worker nodes/i)).toBeDefined();
    expect(screen.getByTestId('tab-setup')).toBeDefined();
    expect(screen.getByTestId('tab-pods')).toBeDefined();

    // In default pods tab: verify all 4 pods are rendered
    expect(screen.getByText('web-app-1pd4l-ktdhh')).toBeDefined();
    expect(screen.getByText('web-app-1pd4l-e4u71')).toBeDefined();
    expect(screen.getByText('web-app-1pd4l-tns6q')).toBeDefined();
    expect(screen.getByText('web-app-1pd4l-9a2bc')).toBeDefined();

    // Verify worker badges are rendered
    expect(screen.getByTestId('worker-summary-worker-1')).toBeDefined();
    expect(screen.getByTestId('worker-summary-worker-2')).toBeDefined();
    expect(screen.getByTestId('worker-summary-worker-3')).toBeDefined();

    // Verify Ready status badge when simulation is not running
    expect(screen.getAllByText('Ready')).toHaveLength(4);

    // Verify numbering (#1) and hash badges are not rendered
    expect(screen.queryByText('#1')).toBeNull();
    expect(screen.queryByTestId('pod-hash-badge-1')).toBeNull();
  });

  it('renders Running status for pods when simulation is running', () => {
    const { deployment } = setupTestNodes();
    useFlowStore.setState({ isSimulating: true });

    render(
      <WorkloadPodsModal
        isOpen={true}
        onClose={onClose}
        selectedNode={deployment}
      />
    );

    expect(screen.getAllByText('Running')).toHaveLength(4);
  });

  it('returns null when isOpen is false', () => {
    const { deployment } = setupTestNodes();

    const { container } = render(
      <WorkloadPodsModal
        isOpen={false}
        onClose={onClose}
        selectedNode={deployment}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('filters pod list based on search query', () => {
    const { deployment } = setupTestNodes();

    render(
      <WorkloadPodsModal
        isOpen={true}
        onClose={onClose}
        selectedNode={deployment}
      />
    );

    const searchInput = screen.getByTestId('workload-pods-search-input');
    fireEvent.change(searchInput, { target: { value: 'ktdhh' } });

    expect(screen.getByText('web-app-1pd4l-ktdhh')).toBeDefined();
    expect(screen.queryByText('web-app-1pd4l-e4u71')).toBeNull();
    expect(screen.queryByText('web-app-1pd4l-tns6q')).toBeNull();
    expect(screen.queryByText('web-app-1pd4l-9a2bc')).toBeNull();

    // Clear search
    const clearBtn = screen.getByLabelText(/Clear pod search query/i);
    fireEvent.click(clearBtn);

    expect(screen.getByText('web-app-1pd4l-ktdhh')).toBeDefined();
    expect(screen.getByText('web-app-1pd4l-e4u71')).toBeDefined();
  });

  it('switches between Setup tab and List Pods tab', () => {
    const { deployment } = setupTestNodes();

    render(
      <WorkloadPodsModal
        isOpen={true}
        onClose={onClose}
        selectedNode={deployment}
      />
    );

    // Click Setup tab
    const setupTabBtn = screen.getByTestId('tab-setup');
    fireEvent.click(setupTabBtn);

    expect(screen.getByText('Workload Name')).toBeDefined();
    expect(screen.getByText('Replicas Count')).toBeDefined();
    expect(screen.getByText('Container Image')).toBeDefined();
    expect(screen.queryByText('Restart Policy')).toBeNull();

    // Click Pods tab
    const podsTabBtn = screen.getByTestId('tab-pods');
    fireEvent.click(podsTabBtn);

    expect(screen.getByText('web-app-1pd4l-ktdhh')).toBeDefined();
  });

  it('handles copying pod name to clipboard', async () => {
    const { deployment } = setupTestNodes();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <WorkloadPodsModal
        isOpen={true}
        onClose={onClose}
        selectedNode={deployment}
      />
    );

    const copyBtn = screen.getByTestId('copy-pod-name-1');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledWith('web-app-1pd4l-ktdhh');
  });

  it('works when child pod is selected instead of parent deployment', () => {
    const { childPods } = setupTestNodes();

    render(
      <WorkloadPodsModal
        isOpen={true}
        onClose={onClose}
        selectedNode={childPods[0]}
      />
    );

    expect(screen.getByText(/web-app Workload Manager/i)).toBeDefined();
    expect(screen.getByText('web-app-1pd4l-ktdhh')).toBeDefined();
  });

  it('triggers terminal logs when View Logs is clicked in Setup tab', () => {
    const { deployment } = setupTestNodes();
    const setTerminalOpen = vi.fn();
    const setTerminalActiveTab = vi.fn();
    const setTerminalSelectedResourceId = vi.fn();

    useFlowStore.setState({
      setTerminalOpen,
      setTerminalActiveTab,
      setTerminalSelectedResourceId,
    } as any);

    render(
      <WorkloadPodsModal
        isOpen={true}
        onClose={onClose}
        selectedNode={deployment}
      />
    );

    fireEvent.click(screen.getByTestId('tab-setup'));
    fireEvent.click(screen.getByText(/View Logs \(kubectl logs\)/i));

    expect(setTerminalSelectedResourceId).toHaveBeenCalledWith('deploy-1');
    expect(setTerminalActiveTab).toHaveBeenCalledWith('logs');
    expect(setTerminalOpen).toHaveBeenCalledWith(true);
    expect(onClose).toHaveBeenCalled();
  });
  it('renders Restart Policy when controller is a standalone Pod and allows selecting options', () => {
    const updateNodeDataMock = vi.fn();
    const podNode = {
      id: 'pod-standalone',
      type: 'Pod',
      data: {
        label: 'single-pod',
        image: 'nginx:latest',
        status: 'ready',
        restartPolicy: 'Always',
      },
    };
    useFlowStore.setState({ nodes: [podNode] as any, updateNodeData: updateNodeDataMock });

    render(
      <WorkloadPodsModal
        isOpen={true}
        onClose={vi.fn()}
        selectedNode={podNode}
      />
    );

    const setupTabBtn = screen.getByTestId('tab-setup');
    fireEvent.click(setupTabBtn);

    expect(screen.getByText('Restart Policy')).toBeDefined();
    expect(screen.queryByTestId('controller-restart-policy-hint')).toBeNull();

    const neverBtn = screen.getByText('Never').closest('button')!;
    expect(neverBtn.disabled).toBe(false);
    fireEvent.click(neverBtn);
    expect(updateNodeDataMock).toHaveBeenCalledWith('pod-standalone', { restartPolicy: 'Never' });
  });

  it('locks Restart Policy and shows hint when controller is a multi-replica Pod or StatefulSet workload', () => {
    const updateNodeDataMock = vi.fn();
    const multiPodNode = {
      id: 'pod-multi',
      type: 'Pod',
      data: {
        label: 'multi-pod',
        image: 'nginx:latest',
        replicas: 4,
        status: 'ready',
        restartPolicy: 'Always',
      },
    };
    useFlowStore.setState({ colorMode: 'dark', nodes: [multiPodNode] as any, updateNodeData: updateNodeDataMock });

    const { rerender } = render(
      <WorkloadPodsModal
        isOpen={true}
        onClose={vi.fn()}
        selectedNode={multiPodNode}
      />
    );

    const setupTabBtn = screen.getByTestId('tab-setup');
    fireEvent.click(setupTabBtn);

    expect(screen.getByText('Restart Policy')).toBeDefined();
    const hint = screen.getByTestId('controller-restart-policy-hint');
    expect(hint).toBeDefined();
    expect(hint.textContent).toContain('Controllers require restartPolicy: Always');

    const neverBtn = screen.getByText('Never').closest('button')!;
    expect(neverBtn.disabled).toBe(true);
    fireEvent.click(neverBtn);
    expect(updateNodeDataMock).not.toHaveBeenCalled();

    const alwaysBtn = screen.getByText('Always').closest('button')!;
    fireEvent.click(alwaysBtn);
    expect(updateNodeDataMock).toHaveBeenCalledWith('pod-multi', { restartPolicy: 'Always' });

    // Light colorMode branch
    useFlowStore.setState({ colorMode: 'light' });
    rerender(
      <WorkloadPodsModal
        isOpen={true}
        onClose={vi.fn()}
        selectedNode={multiPodNode}
      />
    );
    const lightHint = screen.getByTestId('controller-restart-policy-hint');
    expect(lightHint.className).toContain('bg-blue-50');
  });
});
