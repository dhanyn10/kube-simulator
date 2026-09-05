import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFlowStore } from '@/store';

describe('createUiSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      isSimulating: false,
      visibleWidgets: ['w1'],
      customImages: ['img1'],
      isAutosaveEnabled: false,
      isAutofocusEnabled: false,
      isSidebarVisible: true,
      isRightSidebarVisible: true,
      globalEdgeColor: 'old-color',
      globalEdgeErrorColor: 'old-error-color',
      nodes: [],
      edges: []
    });

    // Mock globalThis.go for backend calls
    (globalThis as any).go = {
      main: {
        App: {
          SaveSetting: vi.fn().mockResolvedValue(true),
          GetSetting: vi.fn().mockResolvedValue('')
        }
      }
    };

    // Mock globalThis.runtime
    (globalThis as any).runtime = {
      EventsEmit: vi.fn()
    };
  });

  afterEach(() => {
    delete (globalThis as any).go;
    delete (globalThis as any).runtime;
  });

  it('toggles color mode and emits event', () => {
    const { toggleColorMode } = useFlowStore.getState();
    toggleColorMode();
    expect(useFlowStore.getState().colorMode).toBe('light');
    expect((globalThis as any).runtime.EventsEmit).toHaveBeenCalledWith('theme-sync', 'light');

    toggleColorMode();
    expect(useFlowStore.getState().colorMode).toBe('dark');
    expect((globalThis as any).runtime.EventsEmit).toHaveBeenCalledWith('theme-sync', 'dark');
  });

  it('sets global edge colors and saves to backend', () => {
    const { setGlobalEdgeColors } = useFlowStore.getState();
    setGlobalEdgeColors('new-color', 'new-error');
    expect(useFlowStore.getState().globalEdgeColor).toBe('new-color');
    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('new-error');
    expect((globalThis as any).go.main.App.SaveSetting).toHaveBeenCalledWith('globalEdgeColor', 'new-color');
    expect((globalThis as any).go.main.App.SaveSetting).toHaveBeenCalledWith('globalEdgeErrorColor', 'new-error');
  });

  it('sets sidebar visibility and saves to backend', () => {
    const { setSidebarVisible, setRightSidebarVisible } = useFlowStore.getState();

    setSidebarVisible(false);
    expect(useFlowStore.getState().isSidebarVisible).toBe(false);
    expect((globalThis as any).go.main.App.SaveSetting).toHaveBeenCalledWith('isSidebarVisible', 'false');

    setRightSidebarVisible(false);
    expect(useFlowStore.getState().isRightSidebarVisible).toBe(false);
    expect((globalThis as any).go.main.App.SaveSetting).toHaveBeenCalledWith('isRightSidebarVisible', 'false');
  });

  it('toggles autosave and autofocus', () => {
    const { toggleAutosave, toggleAutofocus } = useFlowStore.getState();

    toggleAutosave();
    expect(useFlowStore.getState().isAutosaveEnabled).toBe(true);

    toggleAutofocus();
    expect(useFlowStore.getState().isAutofocusEnabled).toBe(true);
  });

  it('handles custom images correctly', () => {
    const { addCustomImage, deleteCustomImage } = useFlowStore.getState();

    // Add existing image should do nothing
    addCustomImage('img1');
    expect(useFlowStore.getState().customImages).toHaveLength(1);

    addCustomImage('img2');
    expect(useFlowStore.getState().customImages).toContain('img2');

    deleteCustomImage('img1');
    expect(useFlowStore.getState().customImages).not.toContain('img1');
    expect(useFlowStore.getState().customImages).toHaveLength(1);
  });

  it('sets monitoring and system resources', () => {
    const { setMonitoringOpen, setMonitoringDetached, setSystemResources } = useFlowStore.getState();

    setMonitoringOpen(true);
    expect(useFlowStore.getState().isMonitoringOpen).toBe(true);

    setMonitoringDetached(true);
    expect(useFlowStore.getState().isMonitoringDetached).toBe(true);

    const resources = { cpuCores: 4, totalMemoryGB: 16, freeMemoryGB: 8, cpuUsage: 25 };
    setSystemResources(resources);
    expect(useFlowStore.getState().systemResources).toEqual(resources);
  });

  it('toggles simulation and handles validation failure', () => {
    const { startSimulation, stopSimulation } = useFlowStore.getState();

    // Start simulation with no internet nodes (should return early)
    startSimulation();
    expect(useFlowStore.getState().isSimulating).toBe(false);

    // Test validation failure (HPA with no limits)
    useFlowStore.setState({
        nodes: [
            { id: 'h1', type: 'HPA', data: {} },
            { id: 'd1', type: 'Deployment', data: { label: 'dep' } } // No limits
        ] as any,
        edges: [
            { id: 'e1', source: 'h1', target: 'd1' }
        ] as any
    });

    vi.useFakeTimers();
    startSimulation();
    // It sets isSimulating to true temporarily before stopping
    expect(useFlowStore.getState().isSimulating).toBe(true);

    vi.advanceTimersByTime(3100);
    expect(useFlowStore.getState().isSimulating).toBe(false);
    vi.useRealTimers();

    // Stop simulation
    useFlowStore.setState({ isSimulating: true });
    stopSimulation();
    expect(useFlowStore.getState().isSimulating).toBe(false);
  });

  it('toggles widgets including new ones', () => {
    const { toggleWidget } = useFlowStore.getState();

    // Toggle existing widget
    toggleWidget('w1');
    expect(useFlowStore.getState().visibleWidgets).not.toContain('w1');

    // Toggle new widget
    toggleWidget('new-widget');
    expect(useFlowStore.getState().visibleWidgets).toContain('new-widget');
  });

  it('saves settings to app_settings_json', () => {
    const { saveSettingsJson } = useFlowStore.getState();
    saveSettingsJson();

    expect((globalThis as any).go.main.App.SaveSetting).toHaveBeenCalledWith(
      'app_settings_json',
      expect.stringContaining('"isSidebarVisible":true')
    );
  });

  it('handles invalid JSON in loadSettingsJson gracefully', async () => {
    (globalThis as any).go.main.App.GetSetting = vi.fn().mockResolvedValue('invalid-json{');

    const { loadSettingsJson } = useFlowStore.getState();
    await loadSettingsJson();

    await new Promise(process.nextTick);
    // Should not crash and keep current state
    expect(useFlowStore.getState().isSidebarVisible).toBe(true);
  });

  it('fetches history logs and index via Wails backend', async () => {
    (globalThis as any).go.main.App.GetHistoryLogs = vi.fn().mockResolvedValue(['log1', 'log2']);
    (globalThis as any).go.main.App.GetCurrentHistoryIndex = vi.fn().mockResolvedValue(1);

    const { fetchHistoryLogs } = useFlowStore.getState();
    await fetchHistoryLogs();

    const state = useFlowStore.getState();
    expect(state.historyLogs).toEqual(['log2', 'log1']);
    expect(state.currentHistoryIndex).toBe(1);
    expect(state.isHistoryLoading).toBe(false);
  });

  it('logs OOM and CPU throttled messages when simulation metrics indicate errors', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'i1', type: 'Internet', data: { trafficSpeed: 100 } },
        { id: 'pod-oom', type: 'Pod', data: { label: 'oom-pod', status: 'ready', memoryLimit: '1Mi' } },
        { id: 'pod-throttled', type: 'Pod', data: { label: 'throttled-pod', status: 'ready', cpuLimit: '1m' } }
      ] as any,
      edges: [
        { id: 'e1', source: 'i1', target: 'pod-oom' },
        { id: 'e2', source: 'i1', target: 'pod-throttled' }
      ] as any,
    });

    vi.useFakeTimers();
    const { startSimulation } = useFlowStore.getState();
    startSimulation();

    // Advance timers so tick runs and calculates metrics
    vi.advanceTimersByTime(2000);

    const logsOOM = useFlowStore.getState().terminalLogs['pod-oom'] || [];
    const logsThrottled = useFlowStore.getState().terminalLogs['pod-throttled'] || [];

    expect(logsOOM.length + logsThrottled.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('loads valid settings from app_settings_json', async () => {
    const mockJson = JSON.stringify({
      isSidebarVisible: false,
      isRightSidebarVisible: false,
      isAutofocusEnabled: true,
      isMonitoringOpen: true,
      canvasBgVariant: 'lines',
      canvasBgColor: '#aabbcc',
      canvasBgOpacity: 0.9,
    });

    (globalThis as any).go.main.App.GetSetting = vi.fn().mockResolvedValue(mockJson);

    const { loadSettingsJson } = useFlowStore.getState();
    await loadSettingsJson();

    // Small delay to allow promise resolution
    await new Promise(process.nextTick);

    const state = useFlowStore.getState();
    expect(state.isSidebarVisible).toBe(false);
    expect(state.isRightSidebarVisible).toBe(false);
    expect(state.isAutofocusEnabled).toBe(true);
    expect(state.canvasBgVariant).toBe('lines');
    expect(state.canvasBgColor).toBe('#aabbcc');
    expect(state.canvasBgOpacity).toBe(0.9);
  });

  it('loads legacy settings if app_settings_json is empty', async () => {
    const getSettingMock = vi.fn().mockImplementation((key) => {
      if (key === 'app_settings_json') return Promise.resolve('');
      if (key === 'isSidebarVisible') return Promise.resolve('false');
      if (key === 'isRightSidebarVisible') return Promise.resolve('true');
      return Promise.resolve('');
    });

    (globalThis as any).go.main.App.GetSetting = getSettingMock;

    const { loadSettingsJson } = useFlowStore.getState();
    await loadSettingsJson();

    await new Promise(process.nextTick);

    const state = useFlowStore.getState();
    expect(state.isSidebarVisible).toBe(false);
    expect(state.isRightSidebarVisible).toBe(true);
  });

  it('sets canvas background styles and saves settings', () => {
    const { setCanvasBgVariant, setCanvasBgColor, setCanvasBgOpacity } = useFlowStore.getState();

    setCanvasBgVariant('lines');
    expect(useFlowStore.getState().canvasBgVariant).toBe('lines');

    setCanvasBgColor('#123456');
    expect(useFlowStore.getState().canvasBgColor).toBe('#123456');

    setCanvasBgOpacity(0.5);
    expect(useFlowStore.getState().canvasBgOpacity).toBe(0.5);
  });

  it('successfully starts and runs a simulation tick with internet and workload nodes', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'i1', type: 'Internet', data: { trafficSpeed: 10 } },
        { id: 'd1', type: 'Deployment', data: { label: 'dep1', cpuRequest: '100m' } }
      ] as any,
      edges: [
        { id: 'e1', source: 'i1', target: 'd1' }
      ] as any,
    });

    vi.useFakeTimers();
    const { startSimulation } = useFlowStore.getState();
    startSimulation();

    expect(useFlowStore.getState().isSimulating).toBe(true);

    // Advance 1 second to trigger tick
    vi.advanceTimersByTime(1000);

    vi.useRealTimers();
  });

  it('transitions pending pods to ready during simulation ticks', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'i1', type: 'Internet', data: { trafficSpeed: 10 } },
        { id: 'pod-1', type: 'Pod', parentId: 'd1', data: { label: 'web-pod', status: 'pending', pendingTicks: 0 } }
      ] as any,
      edges: [
        { id: 'e1', source: 'i1', target: 'pod-1' }
      ] as any,
    });

    vi.useFakeTimers();
    const { startSimulation } = useFlowStore.getState();
    startSimulation();

    // Advance 1 second to trigger tick 1
    vi.advanceTimersByTime(1000);
    let state = useFlowStore.getState();
    let pod = state.nodes.find(n => n.id === 'pod-1');
    expect(pod?.data.status).toBe('pending');
    expect(pod?.data.pendingTicks).toBe(1);

    // Advance 1 more second to trigger tick 2 (should transition to ready/Running)
    vi.advanceTimersByTime(1000);
    state = useFlowStore.getState();
    pod = state.nodes.find(n => n.id === 'pod-1');
    expect(pod?.data.status).toBe('ready');
    expect(pod?.data.pendingTicks).toBe(2);

    vi.useRealTimers();
  });

  it('runs rolling updates for deployments tick-by-tick', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'i1', type: 'Internet', data: { trafficSpeed: 10 } },
        {
          id: 'dep-1',
          type: 'Deployment',
          data: {
            label: 'api-dep',
            isRollingUpdate: true,
            rolloutTargetImage: 'nginx:alpine',
            image: 'nginx:latest'
          }
        },
        { id: 'pod-1', type: 'Pod', parentId: 'dep-1', data: { label: 'pod-1', status: 'ready', image: 'nginx:latest' } }
      ] as any,
      edges: [
        { id: 'e1', source: 'i1', target: 'dep-1' },
        { id: 'e2', source: 'dep-1', target: 'pod-1' }
      ] as any,
    });

    vi.useFakeTimers();
    const { startSimulation } = useFlowStore.getState();
    startSimulation();

    // Advance 1 second to trigger tick 1: rollout should select pod-1, update image, and make it pending
    vi.advanceTimersByTime(1000);
    let state = useFlowStore.getState();
    let pod = state.nodes.find(n => n.id === 'pod-1');
    expect(pod?.data.status).toBe('pending');
    expect(pod?.data.image).toBe('nginx:alpine');

    // Advance 1 more second to trigger tick 2: pod pendingTicks becomes 1 (still pending)
    vi.advanceTimersByTime(1000);
    state = useFlowStore.getState();
    pod = state.nodes.find(n => n.id === 'pod-1');
    expect(pod?.data.status).toBe('pending');

    // Advance 1 more second to trigger tick 3: pod pendingTicks becomes 2 (transitions to ready)
    vi.advanceTimersByTime(1000);
    state = useFlowStore.getState();
    pod = state.nodes.find(n => n.id === 'pod-1');
    expect(pod?.data.status).toBe('ready');

    // Advance 1 more second to trigger tick 4: rollout finishes (since pod is ready, no more old pods)
    vi.advanceTimersByTime(1000);
    state = useFlowStore.getState();
    const dep = state.nodes.find(n => n.id === 'dep-1');
    expect(dep?.data.isRollingUpdate).toBe(false);
    expect(dep?.data.rolloutStatus).toBe('Successfully rolled out');

    vi.useRealTimers();
  });

  it('continuously generates logs for all resources in background across resource switching', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'i1', type: 'Internet', data: { trafficSpeed: 10 } },
        { id: 'dep-1', type: 'Deployment', data: { label: 'dep-1' } },
        { id: 'child-pod-1', type: 'Pod', parentId: 'dep-1', data: { label: 'child-pod-1', status: 'ready' } },
        { id: 'standalone-pod-2', type: 'Pod', data: { label: 'standalone-pod-2', status: 'ready' } }
      ] as any,
      edges: [
        { id: 'e1', source: 'i1', target: 'dep-1' }
      ] as any,
      terminalSelectedResourceId: 'child-pod-1',
      terminalLogs: {
        'child-pod-1': ['initial child log'],
        'standalone-pod-2': ['initial standalone log']
      }
    });

    vi.useFakeTimers();
    const { startSimulation, setTerminalSelectedResourceId } = useFlowStore.getState();
    startSimulation();

    // Advance 10 seconds while viewing child-pod-1
    vi.advanceTimersByTime(10000);

    let state = useFlowStore.getState();
    const childLogsCount1 = state.terminalLogs['child-pod-1']?.length || 0;
    const standaloneLogsCount1 = state.terminalLogs['standalone-pod-2']?.length || 0;

    // Both resources should have accumulated logs in the background
    expect(childLogsCount1).toBeGreaterThan(1);
    expect(standaloneLogsCount1).toBeGreaterThan(1);

    // Switch selected resource to standalone-pod-2
    setTerminalSelectedResourceId('standalone-pod-2');

    // Advance 10 more seconds
    vi.advanceTimersByTime(10000);

    state = useFlowStore.getState();
    const childLogsCount2 = state.terminalLogs['child-pod-1']?.length || 0;
    const standaloneLogsCount2 = state.terminalLogs['standalone-pod-2']?.length || 0;

    // Even though standalone-pod-2 was selected, child-pod-1's logs continued to grow in the background
    expect(childLogsCount2).toBeGreaterThan(childLogsCount1);
    expect(standaloneLogsCount2).toBeGreaterThan(standaloneLogsCount1);

    vi.useRealTimers();
  });

  it('manages terminal tabs, modal targets, and terminal logs', () => {
    const {
      setTerminalOpen,
      setTerminalActiveTab,
      setTerminalSelectedResourceId,
      addTerminalLog,
      addActivityLog,
      clearTerminalLogs,
      setRoleModalTargetNode,
      setConfigMapModalTargetNode,
      setSecretModalTargetNode,
      setHpaModalTargetNode,
      setHistoryViewOpen,
      setSimulatedUpdateInfo,
      setSimulatedCurrentVersion,
      setIsAdminAuthenticated,
    } = useFlowStore.getState();

    setTerminalOpen(true);
    expect(useFlowStore.getState().isTerminalOpen).toBe(true);

    setTerminalActiveTab('logs');
    expect(useFlowStore.getState().terminalActiveTab).toBe('logs');

    setTerminalSelectedResourceId('res-1');
    expect(useFlowStore.getState().terminalSelectedResourceId).toBe('res-1');

    addTerminalLog('res-1', 'test log line');
    expect(useFlowStore.getState().terminalLogs['res-1']).toContain('test log line');

    addActivityLog('User created Pod pod-1');
    expect(useFlowStore.getState().activityLogs).toContain('User created Pod pod-1');

    clearTerminalLogs();
    expect(useFlowStore.getState().terminalLogs).toEqual({});
    expect(useFlowStore.getState().activityLogs).toEqual([]);

    setRoleModalTargetNode({ id: 'n1', label: 'Node 1' });
    expect(useFlowStore.getState().roleModalTargetNode).toEqual({ id: 'n1', label: 'Node 1' });

    setConfigMapModalTargetNode({ id: 'n2', label: 'Node 2' });
    expect(useFlowStore.getState().configMapModalTargetNode).toEqual({ id: 'n2', label: 'Node 2' });

    setSecretModalTargetNode({ id: 'n2-secret', label: 'Secret Node 2' });
    expect(useFlowStore.getState().secretModalTargetNode).toEqual({ id: 'n2-secret', label: 'Secret Node 2' });

    setHpaModalTargetNode({ id: 'n3', label: 'Node 3' });
    expect(useFlowStore.getState().hpaModalTargetNode).toEqual({ id: 'n3', label: 'Node 3' });

    setHistoryViewOpen(true);
    expect(useFlowStore.getState().isHistoryViewOpen).toBe(true);
    expect(useFlowStore.getState().isRightSidebarVisible).toBe(true);

    setSimulatedUpdateInfo({ latestVersion: '1.2.3', releaseUrl: 'https://example.com' });
    expect(useFlowStore.getState().simulatedUpdateInfo).toEqual({ latestVersion: '1.2.3', releaseUrl: 'https://example.com' });

    setSimulatedCurrentVersion('1.0.0');
    expect(useFlowStore.getState().simulatedCurrentVersion).toBe('1.0.0');

    setIsAdminAuthenticated(true);
    expect(useFlowStore.getState().isAdminAuthenticated).toBe(true);
  });
});
