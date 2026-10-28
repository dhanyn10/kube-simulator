import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PodConfigMapVars } from '@/components/Nodes/PodConfigMapVars';
import { useFlowStore } from '@/store';
import { ReactFlowProvider } from '@xyflow/react';

describe('PodConfigMapVars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [],
    });
  });

  it('renders nothing when configMaps is undefined or empty', () => {
    const data = { label: 'pod-1' } as any;
    const { container } = render(
      <ReactFlowProvider>
        <PodConfigMapVars data={data} nodeId="node-1" />
      </ReactFlowProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when displaySettings.configMapVars is explicitly false', () => {
    const data = {
      label: 'pod-1',
      displaySettings: { configMapVars: false },
      configMaps: [{ id: 'cm-1', name: 'app-config', configData: [{ key: 'PORT', value: '8080' }] }],
    } as any;

    const { container } = render(
      <ReactFlowProvider>
        <PodConfigMapVars data={data} nodeId="node-1" />
      </ReactFlowProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when configMaps exist but configData is empty', () => {
    const data = {
      label: 'pod-1',
      configMaps: [{ id: 'cm-1', name: 'app-config', configData: [] }],
    } as any;

    const { container } = render(
      <ReactFlowProvider>
        <PodConfigMapVars data={data} nodeId="node-1" />
      </ReactFlowProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders configMap variables with icon badge and hover card containing header and direct ID in dark mode', () => {
    const data = {
      label: 'pod-1',
      configMaps: [{ id: 'cm-alpha-123', name: 'app-config', configData: [{ key: 'PORT', value: '8080' }, { key: 'ENV', value: 'production' }] }],
    } as any;

    render(
      <ReactFlowProvider>
        <PodConfigMapVars data={data} nodeId="node-1" />
      </ReactFlowProvider>
    );

    const badgePort = screen.getByTestId('pod-cm-badge-PORT');
    expect(badgePort).toBeInTheDocument();
    expect(badgePort).toHaveClass('text-teal-400');

    // Hover cards
    const hoverCards = screen.getAllByRole('tooltip');
    expect(hoverCards).toHaveLength(2);

    const cardHeaders = screen.getAllByTestId('pod-cm-card-header');
    expect(cardHeaders[0]).toHaveTextContent('ConfigMap');

    const cardBodies = screen.getAllByTestId('pod-cm-card-body');
    expect(cardBodies[0]).toHaveTextContent('cm-alpha-123');
    expect(cardBodies[0]).not.toHaveTextContent('ID:');

    expect(screen.getByText('PORT:')).toBeInTheDocument();
    expect(screen.getByText('8080')).toBeInTheDocument();
    expect(screen.getByText('ENV:')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
  });

  it('renders correctly in light mode with light theme styling on hover card', () => {
    useFlowStore.setState({ colorMode: 'light' });

    const data = {
      label: 'pod-1',
      configMaps: [{ id: 'cm-beta-456', name: 'app-config', configData: [{ key: 'PORT', value: '8080' }] }],
    } as any;

    render(
      <ReactFlowProvider>
        <PodConfigMapVars data={data} nodeId="node-1" />
      </ReactFlowProvider>
    );

    const badge = screen.getByTestId('pod-cm-badge-PORT');
    expect(badge).toHaveClass('text-teal-700');

    const card = screen.getByTestId('pod-cm-card-PORT');
    expect(card).toHaveClass('bg-white');

    const header = screen.getByTestId('pod-cm-card-header');
    expect(header).toHaveTextContent('ConfigMap');

    const body = screen.getByTestId('pod-cm-card-body');
    expect(body).toHaveTextContent('cm-beta-456');
    expect(body).not.toHaveTextContent('ID:');
  });

  it('limits to 3 variables and renders + more button for extra variables', () => {
    const setConfigMapModalTargetNode = vi.fn();
    useFlowStore.setState({ setConfigMapModalTargetNode });

    const data = {
      label: 'pod-1',
      configMaps: [{
        id: 'cm-1',
        name: 'app-config',
        configData: [{ key: 'KEY1', value: 'V1' }, { key: 'KEY2', value: 'V2' }, { key: 'KEY3', value: 'V3' }, { key: 'KEY4', value: 'V4' }, { key: 'KEY5', value: 'V5' }],
      }],
    } as any;

    render(
      <ReactFlowProvider>
        <PodConfigMapVars data={data} nodeId="node-1" />
      </ReactFlowProvider>
    );

    expect(screen.getByText('KEY1:')).toBeInTheDocument();
    expect(screen.getByText('KEY2:')).toBeInTheDocument();
    expect(screen.getByText('KEY3:')).toBeInTheDocument();
    expect(screen.queryByText('KEY4:')).toBeNull();

    const moreBtn = screen.getByTestId('pod-cm-more-btn');
    expect(moreBtn).toHaveTextContent('+ 2 more...');

    fireEvent.click(moreBtn);
    expect(setConfigMapModalTargetNode).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'node-1',
        label: 'pod-1',
      })
    );
  });

  it('clicking icon badge opens modal for that configMap', () => {
    const setConfigMapModalTargetNode = vi.fn();
    useFlowStore.setState({ setConfigMapModalTargetNode });

    const cmItem = { id: 'cm-1', name: 'app-config', configData: [{ key: 'LOG_LEVEL', value: 'debug' }] };
    const data = {
      label: 'my-pod',
      configMaps: [cmItem],
    } as any;

    render(
      <ReactFlowProvider>
        <PodConfigMapVars data={data} nodeId="node-1" />
      </ReactFlowProvider>
    );

    const cmBadge = screen.getByRole('button', { name: /Inspect ConfigMap app-config/i });
    fireEvent.click(cmBadge);

    expect(setConfigMapModalTargetNode).toHaveBeenCalledWith({
      id: 'node-1',
      label: 'my-pod',
      initialItem: cmItem,
    });
  });

  it('inherits configMaps from parent deployment if child pod has parentId and no direct configMaps', () => {
    const parentCm = { id: 'cm-dep', name: 'dep-config', configData: [{ key: 'DATABASE_URL', value: 'postgres://db' }] };

    useFlowStore.setState({
      nodes: [
        {
          id: 'dep-1',
          type: 'Deployment',
          position: { x: 0, y: 0 },
          data: {
            label: 'parent-dep',
            configMaps: [parentCm],
          },
        } as any,
      ],
    });

    const data = {
      label: 'child-pod-1',
      parentId: 'dep-1',
    } as any;

    render(
      <ReactFlowProvider>
        <PodConfigMapVars data={data} nodeId="pod-1" />
      </ReactFlowProvider>
    );

    expect(screen.getByText('DATABASE_URL:')).toBeInTheDocument();
    expect(screen.getByText('postgres://db')).toBeInTheDocument();
    expect(screen.getByTestId('pod-cm-card-body')).toHaveTextContent('cm-dep');
    expect(screen.getByTestId('pod-cm-card-body')).not.toHaveTextContent('ID:');
  });

  it('opens inspect modal targeting parentId and falls back to nodeId when label is missing', () => {
    const setConfigMapModalTargetNode = vi.fn();
    const parentCm = { name: 'app-no-id-cm', configData: [{ key: 'API_KEY', value: 'xyz' }] };

    useFlowStore.setState({
      setConfigMapModalTargetNode,
      nodes: [
        {
          id: 'parent-controller-id',
          type: 'Deployment',
          position: { x: 0, y: 0 },
          data: { configMaps: [parentCm] },
        } as any,
      ],
    });

    const dataWithoutLabel = {
      parentId: 'parent-controller-id',
    } as any;

    render(
      <ReactFlowProvider>
        <PodConfigMapVars data={dataWithoutLabel} nodeId="pod-fallback-id" />
      </ReactFlowProvider>
    );

    const cmBadge = screen.getByRole('button', { name: /Inspect ConfigMap app-no-id-cm/i });
    fireEvent.click(cmBadge);

    expect(setConfigMapModalTargetNode).toHaveBeenCalledWith({
      id: 'parent-controller-id',
      label: 'pod-fallback-id',
      initialItem: parentCm,
    });
  });

  it('renders + more button in light mode with light theme styles', () => {
    useFlowStore.setState({ colorMode: 'light' });

    const data = {
      label: 'pod-1',
      configMaps: [{
        id: 'cm-1',
        name: 'app-config',
        configData: [
          { key: 'K1', value: 'V1' },
          { key: 'K2', value: 'V2' },
          { key: 'K3', value: 'V3' },
          { key: 'K4', value: 'V4' },
        ],
      }],
    } as any;

    render(
      <ReactFlowProvider>
        <PodConfigMapVars data={data} nodeId="node-1" />
      </ReactFlowProvider>
    );

    const moreBtn = screen.getByTestId('pod-cm-more-btn');
    expect(moreBtn).toHaveClass('text-teal-600');
    expect(moreBtn).toHaveTextContent('+ 1 more...');
  });
});
