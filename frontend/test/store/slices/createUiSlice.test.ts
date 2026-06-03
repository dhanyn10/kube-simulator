import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '../../../src/store';

describe('createUiSlice via useFlowStore', () => {
  beforeEach(() => {
    useFlowStore.setState({
      colorMode: 'dark',
      customImages: ['my-web-app:v1.0', 'backend-api:latest'],
      isAutosaveEnabled: false,
    });

    globalThis.go = {
        main: {
          App: {
            SaveSetting: vi.fn().mockResolvedValue(true)
          }
        }
      } as any;
  });

  it('should toggle color mode', () => {
    useFlowStore.getState().toggleColorMode();
    expect(useFlowStore.getState().colorMode).toBe('light');
  });

  it('should add custom image', () => {
    useFlowStore.getState().addCustomImage('test:latest');
    expect(useFlowStore.getState().customImages).toContain('test:latest');
  });

  it('should delete custom image', () => {
    useFlowStore.getState().deleteCustomImage('my-web-app:v1.0');
    expect(useFlowStore.getState().customImages).not.toContain('my-web-app:v1.0');
  });

  it('should toggle autosave', () => {
    useFlowStore.getState().toggleAutosave();
    expect(useFlowStore.getState().isAutosaveEnabled).toBe(true);
  });

  it('should set simulation state and run a tick', async () => {
    vi.useFakeTimers();
    useFlowStore.setState({
      nodes: [
        { id: 'i1', type: 'Internet', data: { traffic: 1000, currentTraffic: 0 }, position: { x: 0, y: 0 } },
        { id: 'd1', type: 'Deployment', data: { replicas: 1, cpuLimit: '1000m', memoryLimit: '1024Mi' }, position: { x: 200, y: 0 } }
      ],
      edges: [{ id: 'e1', source: 'i1', target: 'd1', type: 'custom' }],
      isSimulating: false,
      simulationMetrics: {}
    });

    useFlowStore.getState().setSimulation(true);
    expect(useFlowStore.getState().isSimulating).toBe(true);

    // Advance time by 1s to trigger simulation tick
    await vi.advanceTimersByTimeAsync(1000);

    expect(useFlowStore.getState().simulationMetrics['d1']).toBeDefined();

    useFlowStore.getState().setSimulation(false);
    expect(useFlowStore.getState().isSimulating).toBe(false);
    vi.useRealTimers();
  });

  it('should set right sidebar visibility', () => {
    useFlowStore.getState().setRightSidebarVisible(true);
    expect(useFlowStore.getState().isRightSidebarVisible).toBe(true);
    useFlowStore.getState().setRightSidebarVisible(false);
    expect(useFlowStore.getState().isRightSidebarVisible).toBe(false);
  });

  it('should set global edge colors', () => {
    useFlowStore.getState().setGlobalEdgeColors('#ff0000', '#00ff00');
    expect(useFlowStore.getState().globalEdgeColor).toBe('#ff0000');
    expect(useFlowStore.getState().globalEdgeErrorColor).toBe('#00ff00');
  });

  it('should set system resources', () => {
    const res = { cpuCores: 8, totalMemoryGB: 32, freeMemoryGB: 16, cpuUsage: 10 };
    useFlowStore.getState().setSystemResources(res);
    expect(useFlowStore.getState().systemResources).toEqual(res);
  });

  it('should toggle widgets', () => {
    useFlowStore.setState({ visibleWidgets: ['w1'] });
    useFlowStore.getState().toggleWidget('w2');
    expect(useFlowStore.getState().visibleWidgets).toContain('w2');
    useFlowStore.getState().toggleWidget('w1');
    expect(useFlowStore.getState().visibleWidgets).not.toContain('w1');
  });

  it('should set monitoring states', () => {
    useFlowStore.getState().setMonitoringOpen(true);
    expect(useFlowStore.getState().isMonitoringOpen).toBe(true);
    useFlowStore.getState().setMonitoringDetached(true);
    expect(useFlowStore.getState().isMonitoringDetached).toBe(true);
  });

  it('should set sidebar visibility', () => {
    useFlowStore.getState().setSidebarVisible(false);
    expect(useFlowStore.getState().isSidebarVisible).toBe(false);
  });
});
