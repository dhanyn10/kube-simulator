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
});
