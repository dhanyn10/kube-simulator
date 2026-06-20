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
          SaveSetting: vi.fn().mockResolvedValue(true)
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

  it('toggles simulation', () => {
    // Note: startSimulation has its own complex logic, we just test the entry point here
    const { setSimulation } = useFlowStore.getState();

    // Start simulation with no internet nodes (should return early or set isSimulating: false)
    // Actually, with no nodes, it should not set isSimulating to true.
    setSimulation(true);
    expect(useFlowStore.getState().isSimulating).toBe(false);

    // Stop simulation
    useFlowStore.setState({ isSimulating: true });
    setSimulation(false);
    expect(useFlowStore.getState().isSimulating).toBe(false);
  });
});
