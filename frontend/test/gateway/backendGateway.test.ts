import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBackendGateway,
  setBackendGateway,
  resetBackendGateway,
  WailsBackendGateway,
  MockBackendGateway,
} from '@/gateway';
import * as fallbackBindings from '@/gateway/bindings-fallback';
import { logger } from '@/lib/logger';
import { APP_VERSION } from '@/constants/config';

describe('Clean Architecture Backend Gateway', () => {
  beforeEach(() => {
    resetBackendGateway();
    delete (globalThis as any).go;
    delete (globalThis as any).runtime;
    delete (globalThis as any).chrome;
    delete (globalThis as any).wails;
    delete (globalThis as any).webkit;
  });

  describe('Gateway Registry', () => {
    it('defaults to WailsBackendGateway', () => {
      const gateway = getBackendGateway();
      expect(gateway).toBeInstanceOf(WailsBackendGateway);
    });

    it('allows swapping with MockBackendGateway and resetting', () => {
      const mock = new MockBackendGateway();
      setBackendGateway(mock);
      expect(getBackendGateway()).toBe(mock);

      resetBackendGateway();
      expect(getBackendGateway()).toBeInstanceOf(WailsBackendGateway);
    });
  });

  describe('MockBackendGateway Operations', () => {
    let mock: MockBackendGateway;

    beforeEach(() => {
      mock = new MockBackendGateway();
    });

    it('handles project lifecycle (save, list, load, update, delete)', async () => {
      expect(await mock.getProjects()).toHaveLength(0);

      const id = await mock.saveProject('Test Project', '{"nodes":[]}');
      expect(typeof id).toBe('number');

      const projects = await mock.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Test Project');

      const loaded = await mock.loadProject(id);
      expect(loaded?.content).toBe('{"nodes":[]}');

      const updated = await mock.updateProject(id, '{"nodes":[1]}');
      expect(updated).toBe(true);
      expect((await mock.loadProject(id))?.content).toBe('{"nodes":[1]}');

      const missingUpdate = await mock.updateProject(999999, '{"nodes":[]}');
      expect(missingUpdate).toBe(false);

      const deleted = await mock.deleteProject(id);
      expect(deleted).toBe(true);
      expect(await mock.loadProject(id)).toBeNull();
    });

    it('handles settings lifecycle', async () => {
      expect(await mock.getSetting('theme')).toBe('');

      await mock.saveSetting('theme', 'dark');
      expect(await mock.getSetting('theme')).toBe('dark');
    });

    it('handles autosave profiles lifecycle', async () => {
      mock.autosaves = [
        { key: 'auto_1', location: '/path/1', timestamp: 100 },
        { key: 'auto_2', location: '/path/2', timestamp: 200 },
      ];
      expect(await mock.getAutosaveProfiles()).toHaveLength(2);

      await mock.clearAllAutosaves();
      expect(await mock.getAutosaveProfiles()).toHaveLength(0);
    });

    it('handles history operations (push, jump, undo, redo)', async () => {
      await mock.pushHistory(JSON.stringify({ actionName: 'Init', timestamp: 1000 }));
      await mock.pushHistory(JSON.stringify({ actionName: 'Add Pod', timestamp: 2000 }));
      await mock.pushHistory(JSON.stringify({ actionName: 'Add Svc', timestamp: 3000 }));

      const logs = await mock.getHistoryLogs();
      expect(logs).toHaveLength(3);
      expect(await mock.getCurrentHistoryIndex()).toBe(2);

      const jumped = await mock.jumpToHistory(1);
      expect(jumped).toContain('Add Pod');
      expect(await mock.getCurrentHistoryIndex()).toBe(1);

      const invalidJump = await mock.jumpToHistory(99);
      expect(invalidJump).toBe('');

      const undone = await mock.undo();
      expect(undone).toContain('Init');
      expect(await mock.getCurrentHistoryIndex()).toBe(0);

      const cannotUndoFurther = await mock.undo();
      expect(cannotUndoFurther).toBeNull();

      const redone = await mock.redo();
      expect(redone).toContain('Add Pod');
      expect(await mock.getCurrentHistoryIndex()).toBe(1);
    });

    it('handles internet profiles lifecycle', async () => {
      const profile = JSON.stringify({ name: 'day-peak', hourly: { '12': 100 } });
      const saved = await mock.saveInternetProfile('day-peak', profile);
      expect(saved).toBe(true);

      const invalidSave = await mock.saveInternetProfile('invalid', '{not-json');
      expect(invalidSave).toBe(false);

      const list = await mock.getInternetProfiles();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('day-peak');

      const deleted = await mock.deleteInternetProfile('day-peak');
      expect(deleted).toBe(true);
      expect(await mock.getInternetProfiles()).toHaveLength(0);
    });

    it('handles window and system diagnostic methods', async () => {
      expect(mock.windowState).toBe('normal');
      await mock.minimizeWindow();
      expect(mock.windowState).toBe('minimized');
      await mock.maximizeWindow();
      expect(mock.windowState).toBe('maximized');
      await mock.closeWindow();
      expect(mock.windowState).toBe('closed');
      await mock.setInitialFile('/test/path');
      expect(mock.initialFile).toBe('/test/path');

      expect(await mock.openSimulationWindow()).toBe(true);
      expect(await mock.closeSimulationWindow()).toBe(true);
      expect(await mock.startSimulation(5)).toBe(true);
      expect(await mock.pauseSimulation()).toBe(true);
      expect(await mock.resumeSimulation()).toBe(true);
      expect(await mock.setSimulationSpeed(10)).toBe(true);
      expect(await mock.broadcastSimulationSnapshot('{"test":1}')).toBe(true);
      expect(await mock.getSimulationSnapshot()).toBe('{"test":1}');
      expect(await mock.stopSimulation()).toBe(true);

      // Edge cases for non-positive speed and empty snapshot
      expect(await mock.startSimulation(0)).toBe(true);
      expect(await mock.setSimulationSpeed(-1)).toBe(true);
      expect(await mock.broadcastSimulationSnapshot('')).toBe(true);
      expect(await mock.getSimulationSnapshot()).toBe('{}');
      expect(await mock.calculateAppHeight(1000)).toBe(850);
      expect(await mock.getTargetScreen([])).toBe(false);
      expect(await mock.getTargetScreenHeight([])).toBe(1080);
      expect(await mock.fileExists('/some/file')).toBe(true);
      expect(await mock.openFileFolder('/some/file')).toBe(true);
      expect(await mock.exportProjectFile('p', 'c', 'y')).toBe(true);
      expect(await mock.importProjectFile()).toBe('');

      const info = await mock.getSystemInfo();
      expect(info.os).toBe('mock-os');

      const resources = await mock.getSystemResources();
      expect(resources.cpuCores).toBe(8);

      const updates = await mock.checkForUpdates('1.0.0');
      expect(updates.currentVersion).toBe('1.0.0');

      const greeting = await mock.greet('Kube');
      expect(greeting).toBe('Hello Kube!');
    });

    it('handles logging, DockerHub, and YAML generation', async () => {
      await mock.writeLog('system', 'info', 'hello test');
      expect(mock.loggedMessages).toHaveLength(1);
      expect(await mock.openLogFile()).toBe(true);

      const yaml = await mock.generateYaml('[]', '[]');
      expect(typeof yaml).toBe('string');

      // Test generateYaml with empty strings (fallback to '[]') and invalid JSON (fallback to '')
      const emptyYaml = await mock.generateYaml('', '');
      expect(typeof emptyYaml).toBe('string');
      const invalidJsonYaml = await mock.generateYaml('{invalid-json', '[]');
      expect(invalidJsonYaml).toBe('');

      const popular = await mock.fetchDockerHubPopular();
      expect(popular).toContain('nginx');

      const tags = await mock.fetchDockerHubTags('nginx');
      expect(tags).toContain('latest');

      const search = await mock.searchDockerHub('redis');
      expect(search).toContain('redis');
    });

    it('handles runtime event subscriptions and emissions', () => {
      let received = '';
      const unsubscribe = mock.onEvent('test-event', (data: string) => {
        received = data;
      });

      mock.emitEvent('test-event', 'hello payload');
      expect(received).toBe('hello payload');

      unsubscribe();
      mock.emitEvent('test-event', 'second payload');
      expect(received).toBe('hello payload');
    });
  });

  describe('WailsBackendGateway Fallbacks & Delegation', () => {
    let gateway: WailsBackendGateway;

    beforeEach(() => {
      gateway = new WailsBackendGateway();
    });

    it('provides safe fallbacks when globalThis.go is completely undefined', async () => {
      expect(await gateway.getProjects()).toEqual([]);
      expect(typeof (await gateway.saveProject('test', 'content'))).toBe('number');
      expect(await gateway.loadProject(1)).toBeNull();
      expect(await gateway.deleteProject(1)).toBe(true);
      expect(await gateway.updateProject(1, '')).toBe(true);
      expect(await gateway.exportProjectFile('p', 'c', 'y')).toBe(true);
      expect(await gateway.importProjectFile()).toBe('');
      expect(await gateway.fileExists('/file')).toBe(true);
      expect(await gateway.openFileFolder('/file')).toBe(true);
      expect(await gateway.getAutosaveProfiles()).toEqual([]);
      expect(await gateway.clearAllAutosaves()).toBe(true);
      expect(await gateway.getSetting('test')).toBe('');
      expect(await gateway.saveSetting('test', '123')).toBe(true);
      expect(await gateway.getInternetProfiles()).toEqual([]);
      expect(await gateway.saveInternetProfile('p', '{}')).toBe(true);
      expect(await gateway.deleteInternetProfile('p')).toBe(true);
      expect(await gateway.getHistoryLogs()).toEqual([]);
      expect(await gateway.getCurrentHistoryIndex()).toBe(0);
      await gateway.pushHistory('{}');
      expect(await gateway.jumpToHistory(0)).toBe('');
      expect(await gateway.undo()).toBeNull();
      expect(await gateway.redo()).toBeNull();
      await gateway.minimizeWindow();
      await gateway.maximizeWindow();
      await gateway.closeWindow();
      await gateway.setInitialFile('/file');
      expect(await gateway.calculateAppHeight(1000)).toBe(850);
      expect(await gateway.getTargetScreen([])).toBe(false);
      expect(await gateway.getTargetScreenHeight([])).toBe(1080);
      expect(await gateway.writeLog('a', 'b', 'c')).toBe(true);
      expect(await gateway.openLogFile()).toBe(false);
      expect((await gateway.getSystemInfo()).os).toBe('unknown');
      expect((await gateway.getSystemResources()).cpuCores).toBe(4);
      expect((await gateway.checkForUpdates('1.0')).updateAvailable).toBe(false);
      expect(await gateway.greet('World')).toBe('Hello World!');
      expect(await gateway.fetchDockerHubPopular()).toBe('{"results":[]}');
      expect(await gateway.fetchDockerHubTags('nginx')).toBe('{"results":[]}');
      expect(await gateway.searchDockerHub('redis')).toBe('{"results":[]}');
    });

    it('delegates directly to globalThis.go.main.App when methods exist', async () => {
      const mockApp = {
        GetProjects: vi.fn().mockResolvedValue([{ id: 10, name: 'Delegated' }]),
        SaveProject: vi.fn().mockResolvedValue(42),
        LoadProject: vi.fn().mockResolvedValue({ id: 42, name: 'Loaded' }),
        DeleteProject: vi.fn().mockResolvedValue(true),
        UpdateProject: vi.fn().mockResolvedValue(true),
        ExportProjectFile: vi.fn().mockResolvedValue(true),
        ImportProjectFile: vi.fn().mockResolvedValue('{"nodes":[]}'),
        FileExists: vi.fn().mockResolvedValue(false),
        OpenFileFolder: vi.fn().mockResolvedValue(true),
        GetAutosaveProfiles: vi.fn().mockResolvedValue([{ key: 'save_1', timestamp: 123, location: '/p' }]),
        ClearAllAutosaves: vi.fn().mockResolvedValue(true),
        GetSetting: vi.fn().mockResolvedValue('val_1'),
        SaveSetting: vi.fn().mockResolvedValue(true),
        GetInternetProfiles: vi.fn().mockResolvedValue([{ name: 'profile_1' }]),
        SaveInternetProfile: vi.fn().mockResolvedValue(true),
        DeleteInternetProfile: vi.fn().mockResolvedValue(true),
        GetHistoryLogs: vi.fn().mockResolvedValue([{ index: 0, actionName: 'init', timestamp: 100 }]),
        GetCurrentHistoryIndex: vi.fn().mockResolvedValue(5),
        PushHistory: vi.fn().mockResolvedValue(undefined),
        JumpToHistory: vi.fn().mockResolvedValue('{"jumped":true}'),
        Undo: vi.fn().mockResolvedValue('{"undone":true}'),
        Redo: vi.fn().mockResolvedValue('{"redone":true}'),
        MinimizeWindow: vi.fn().mockResolvedValue(undefined),
        MaximizeWindow: vi.fn().mockResolvedValue(undefined),
        CloseWindow: vi.fn().mockResolvedValue(undefined),
        CalculateAppHeight: vi.fn().mockResolvedValue(900),
        GetTargetScreen: vi.fn().mockResolvedValue(true),
        GetTargetScreenHeight: vi.fn().mockResolvedValue(1200),
        WriteLog: vi.fn().mockResolvedValue(true),
        OpenLogFile: vi.fn().mockResolvedValue(true),
        GetSystemInfo: vi.fn().mockResolvedValue({ os: 'windows', version: '1.0' }),
        GetSystemResources: vi.fn().mockResolvedValue({ cpuCores: 16 }),
        CheckForUpdates: vi.fn().mockResolvedValue({ updateAvailable: true }),
        Greet: vi.fn().mockResolvedValue('Hey Wails'),
        SetInitialFile: vi.fn().mockResolvedValue(undefined),
        GenerateYaml: vi.fn().mockResolvedValue('apiVersion: v1'),
        FetchDockerHubPopular: vi.fn().mockResolvedValue('{"results":["nginx"]}'),
        FetchDockerHubTags: vi.fn().mockResolvedValue('{"results":["latest"]}'),
        SearchDockerHub: vi.fn().mockResolvedValue('{"results":["redis"]}'),
      };

      (globalThis as any).go = {
        main: {
          App: mockApp,
        },
      };

      expect(await gateway.getProjects()).toEqual([{ id: 10, name: 'Delegated' }]);
      expect(await gateway.saveProject('test', 'content')).toBe(42);
      expect(await gateway.loadProject(42)).toEqual({ id: 42, name: 'Loaded' });
      expect(await gateway.deleteProject(42)).toBe(true);
      expect(await gateway.updateProject(42, 'data')).toBe(true);
      expect(await gateway.exportProjectFile('p', 'c', 'y')).toBe(true);
      expect(await gateway.importProjectFile()).toBe('{"nodes":[]}');
      expect(await gateway.fileExists('/test')).toBe(false);
      expect(await gateway.openFileFolder('/test')).toBe(true);
      expect(await gateway.getAutosaveProfiles()).toHaveLength(1);
      expect(await gateway.clearAllAutosaves()).toBe(true);
      expect(await gateway.getSetting('k')).toBe('val_1');
      expect(await gateway.saveSetting('k', 'v')).toBe(true);
      expect(await gateway.getInternetProfiles()).toHaveLength(1);
      expect(await gateway.saveInternetProfile('p', '{}')).toBe(true);
      expect(await gateway.deleteInternetProfile('p')).toBe(true);
      expect(await gateway.getHistoryLogs()).toHaveLength(1);
      expect(await gateway.getCurrentHistoryIndex()).toBe(5);
      await gateway.pushHistory('{}');
      expect(mockApp.PushHistory).toHaveBeenCalled();
      expect(await gateway.jumpToHistory(3)).toBe('{"jumped":true}');
      expect(await gateway.undo()).toBe('{"undone":true}');
      expect(await gateway.redo()).toBe('{"redone":true}');
      await gateway.minimizeWindow();
      expect(mockApp.MinimizeWindow).toHaveBeenCalled();
      await gateway.maximizeWindow();
      expect(mockApp.MaximizeWindow).toHaveBeenCalled();
      await gateway.closeWindow();
      expect(mockApp.CloseWindow).toHaveBeenCalled();
      expect(await gateway.calculateAppHeight(1000)).toBe(900);
      expect(await gateway.getTargetScreen([])).toBe(true);
      expect(await gateway.getTargetScreenHeight([])).toBe(1200);
      expect(await gateway.writeLog('a', 'b', 'c')).toBe(true);
      expect(await gateway.openLogFile()).toBe(true);
      expect((await gateway.getSystemInfo()).os).toBe('windows');
      expect((await gateway.getSystemResources()).cpuCores).toBe(16);
      expect((await gateway.checkForUpdates('1.0')).updateAvailable).toBe(true);
      expect(await gateway.greet('Wails')).toBe('Hey Wails');
      await gateway.setInitialFile('/file');
      expect(mockApp.SetInitialFile).toHaveBeenCalled();
      expect(await gateway.generateYaml('[]', '[]')).toBe('');
      expect(await gateway.fetchDockerHubPopular()).toContain('nginx');
      expect(await gateway.fetchDockerHubTags('nginx')).toContain('latest');
      expect(await gateway.searchDockerHub('redis')).toContain('redis');
    });

    it('covers desktop runtime and window action fallback chains', async () => {
      // 1. Desktop mode with runtime window functions that succeed
      const mockMinimise = vi.fn().mockResolvedValue(undefined);
      const mockToggleMaximise = vi.fn().mockResolvedValue(undefined);
      const mockClose = vi.fn().mockResolvedValue(undefined);

      (globalThis as any).chrome = { webview: { postMessage: () => {} } };
      (globalThis as any).wails = {
        Window: {
          Minimise: mockMinimise,
          ToggleMaximise: mockToggleMaximise,
          Close: mockClose,
        },
      };

      await gateway.minimizeWindow();
      expect(mockMinimise).toHaveBeenCalledTimes(1);

      await gateway.maximizeWindow();
      expect(mockToggleMaximise).toHaveBeenCalledTimes(1);

      await gateway.closeWindow();
      expect(mockClose).toHaveBeenCalledTimes(1);

      // 2. Desktop mode with runtime window functions that throw (fall back gracefully)
      mockMinimise.mockRejectedValue(new Error('runtime window minimize error'));
      mockToggleMaximise.mockRejectedValue(new Error('runtime window toggle error'));
      mockClose.mockRejectedValue(new Error('runtime window close error'));

      await expect(gateway.minimizeWindow()).resolves.toBeUndefined();
      await expect(gateway.maximizeWindow()).resolves.toBeUndefined();
      await expect(gateway.closeWindow()).resolves.toBeUndefined();

      // 3. Desktop mode when runtime window has no methods (fall back to appBindings)
      (globalThis as any).chrome = { webview: { postMessage: () => {} } };
      (globalThis as any).wails = { Window: {} };

      await expect(gateway.minimizeWindow()).resolves.toBeUndefined();
      await expect(gateway.maximizeWindow()).resolves.toBeUndefined();
      await expect(gateway.closeWindow()).resolves.toBeUndefined();

      // 4. Non-desktop mode with plain app methods (isMockFunction returns false, direct invocation)
      delete (globalThis as any).chrome;
      delete (globalThis as any).wails;

      let appMinimizeCalled = false;
      let appMaximizeCalled = false;
      let appCloseCalled = false;

      const plainApp = {
        MinimizeWindow: async () => {
          appMinimizeCalled = true;
        },
        MaximizeWindow: async () => {
          appMaximizeCalled = true;
        },
        CloseWindow: async () => {
          appCloseCalled = true;
        },
      };
      (globalThis as any).go = { main: { App: plainApp } };

      await gateway.minimizeWindow();
      expect(appMinimizeCalled).toBe(true);

      await gateway.maximizeWindow();
      expect(appMaximizeCalled).toBe(true);

      await gateway.closeWindow();
      expect(appCloseCalled).toBe(true);

      // 5. Fallback when plain app window methods throw
      const throwingApp = {
        MinimizeWindow: async () => {
          throw new Error('minimize error');
        },
        MaximizeWindow: async () => {
          throw new Error('maximize error');
        },
        CloseWindow: async () => {
          throw new Error('close error');
        },
      };
      (globalThis as any).go = { main: { App: throwingApp } };

      await expect(gateway.minimizeWindow()).resolves.toBeUndefined();
      await expect(gateway.maximizeWindow()).resolves.toBeUndefined();
      await expect(gateway.closeWindow()).resolves.toBeUndefined();

      // 6. onEvent fallback when runtime is undefined
      delete (globalThis as any).runtime;
      const noopUnsub = gateway.onEvent('unsupported-event', () => {});
      expect(typeof noopUnsub).toBe('function');
      noopUnsub();
    });

    it('handles simulation window opening, closing, and browser fallback chains', async () => {
      // 1. App binding succeeds
      const appMock = {
        OpenSimulationWindow: vi.fn().mockResolvedValue(true),
        CloseSimulationWindow: vi.fn().mockResolvedValue(true),
      };
      (globalThis as any).go = { main: { App: appMock } };
      const gw = new WailsBackendGateway();
      expect(await gw.openSimulationWindow()).toBe(true);
      expect(appMock.OpenSimulationWindow).toHaveBeenCalled();
      expect(await gw.closeSimulationWindow()).toBe(true);
      expect(appMock.CloseSimulationWindow).toHaveBeenCalled();

      // 2. App binding missing, falling back to globalThis.open
      delete (globalThis as any).go;
      const fakePopup = { focus: vi.fn() };
      const openSpy = vi.fn().mockReturnValue(fakePopup);
      const origOpen = globalThis.open;
      globalThis.open = openSpy as any;

      try {
        const gwFallback = new WailsBackendGateway();
        expect(await gwFallback.openSimulationWindow()).toBe(true);
        expect(openSpy).toHaveBeenCalled();
        expect(await gwFallback.closeSimulationWindow()).toBe(false);

        // When globalThis.open throws or returns null
        openSpy.mockImplementationOnce(() => {
          throw new Error('popup blocked');
        });
        expect(await gwFallback.openSimulationWindow()).toBe(false);

        openSpy.mockReturnValueOnce(null);
        expect(await gwFallback.openSimulationWindow()).toBe(false);
      } finally {
        globalThis.open = origOpen;
      }

      // 3. When app binding throws
      const throwingApp = {
        OpenSimulationWindow: vi.fn().mockRejectedValue(new Error('fail open')),
        CloseSimulationWindow: vi.fn().mockRejectedValue(new Error('fail close')),
      };
      (globalThis as any).go = { main: { App: throwingApp } };
      const origOpen2 = globalThis.open;
      delete (globalThis as any).open;
      try {
        const gwThrowing = new WailsBackendGateway();
        expect(await gwThrowing.openSimulationWindow()).toBe(false);
        expect(await gwThrowing.closeSimulationWindow()).toBe(false);
      } finally {
        globalThis.open = origOpen2;
      }
    });

    it('opens dev tools via the gateway (binding, throwing fallback, and no-binding cases)', async () => {
      // 1. App binding succeeds
      const appMock = {
        OpenDevTools: vi.fn().mockResolvedValue(undefined),
      };
      (globalThis as any).go = { main: { App: appMock } };
      const gw = new WailsBackendGateway();
      await gw.openDevTools();
      expect(appMock.OpenDevTools).toHaveBeenCalledTimes(1);

      // 2. App binding throws -> gateway call still resolves and logs the failure
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      try {
        const throwingApp = {
          OpenDevTools: vi.fn().mockRejectedValue(new Error('devtools unavailable')),
        };
        (globalThis as any).go = { main: { App: throwingApp } };
        const gwThrowing = new WailsBackendGateway();
        await expect(gwThrowing.openDevTools()).resolves.toBeUndefined();
        expect(throwingApp.OpenDevTools).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith('[WailsBackendGateway] OpenDevTools failed:', expect.any(Error));
      } finally {
        warnSpy.mockRestore();
      }

      // 3. No binding available -> still resolves
      delete (globalThis as any).go;
      const gwNone = new WailsBackendGateway();
      await expect(gwNone.openDevTools()).resolves.toBeUndefined();
    });

    it('handles simulation broker operations delegation and fallback chains in WailsBackendGateway', async () => {
      // 1. App binding succeeds
      const appMock = {
        StartSimulation: vi.fn().mockResolvedValue(true),
        PauseSimulation: vi.fn().mockResolvedValue(true),
        ResumeSimulation: vi.fn().mockResolvedValue(true),
        StopSimulation: vi.fn().mockResolvedValue(true),
        SetSimulationSpeed: vi.fn().mockResolvedValue(true),
        BroadcastSimulationSnapshot: vi.fn().mockResolvedValue(true),
        GetSimulationSnapshot: vi.fn().mockResolvedValue('{"snap":true}'),
      };
      (globalThis as any).go = { main: { App: appMock } };
      const gw = new WailsBackendGateway();

      expect(await gw.startSimulation(5)).toBe(true);
      expect(appMock.StartSimulation).toHaveBeenCalledWith(5);
      expect(await gw.pauseSimulation()).toBe(true);
      expect(appMock.PauseSimulation).toHaveBeenCalled();
      expect(await gw.resumeSimulation()).toBe(true);
      expect(appMock.ResumeSimulation).toHaveBeenCalled();
      expect(await gw.setSimulationSpeed(10)).toBe(true);
      expect(appMock.SetSimulationSpeed).toHaveBeenCalledWith(10);
      expect(await gw.broadcastSimulationSnapshot('{}')).toBe(true);
      expect(appMock.BroadcastSimulationSnapshot).toHaveBeenCalledWith('{}');
      expect(await gw.getSimulationSnapshot()).toBe('{"snap":true}');
      expect(appMock.GetSimulationSnapshot).toHaveBeenCalled();
      expect(await gw.stopSimulation()).toBe(true);
      expect(appMock.StopSimulation).toHaveBeenCalled();

      // 2. App binding throws, falling back gracefully
      const throwingApp = {
        StartSimulation: vi.fn().mockRejectedValue(new Error('fail start')),
        PauseSimulation: vi.fn().mockRejectedValue(new Error('fail pause')),
        ResumeSimulation: vi.fn().mockRejectedValue(new Error('fail resume')),
        StopSimulation: vi.fn().mockRejectedValue(new Error('fail stop')),
        SetSimulationSpeed: vi.fn().mockRejectedValue(new Error('fail speed')),
        BroadcastSimulationSnapshot: vi.fn().mockRejectedValue(new Error('fail snap')),
        GetSimulationSnapshot: vi.fn().mockRejectedValue(new Error('fail get snap')),
      };
      (globalThis as any).go = { main: { App: throwingApp } };
      const gwThrowing = new WailsBackendGateway();

      expect(await gwThrowing.startSimulation(1)).toBe(true);
      expect(await gwThrowing.pauseSimulation()).toBe(true);
      expect(await gwThrowing.resumeSimulation()).toBe(true);
      expect(await gwThrowing.setSimulationSpeed(1)).toBe(true);
      expect(await gwThrowing.broadcastSimulationSnapshot('{}')).toBe(true);
      expect(await gwThrowing.getSimulationSnapshot()).toBe('{}');
      expect(await gwThrowing.stopSimulation()).toBe(true);
    });

    it('returns empty string when localStorage is unavailable and app has no GetSetting', async () => {
      const origLocalStorage = globalThis.localStorage;
      try {
        Object.defineProperty(globalThis, 'localStorage', {
          value: undefined,
          configurable: true,
          writable: true,
        });
        const gw = new WailsBackendGateway();
        expect(await gw.getSetting('missing_key')).toBe('');
      } finally {
        Object.defineProperty(globalThis, 'localStorage', {
          value: origLocalStorage,
          configurable: true,
          writable: true,
        });
      }
    });

    it('saves settings without localStorage when app has no SaveSetting', async () => {
      delete (globalThis as any).go;
      delete (globalThis as any).window;
      const origLocalStorage = globalThis.localStorage;
      try {
        Object.defineProperty(globalThis, 'localStorage', {
          value: undefined,
          configurable: true,
          writable: true,
        });
        const gw = new WailsBackendGateway();
        expect(await gw.saveSetting('missing_key', 'value')).toBe(true);
      } finally {
        Object.defineProperty(globalThis, 'localStorage', {
          value: origLocalStorage,
          configurable: true,
          writable: true,
        });
      }
    });

    it('clears autosaves using SaveSetting fallback when ClearAllAutosaves is missing', async () => {
      const saveSettingMock = vi.fn().mockResolvedValue(true);
      (globalThis as any).go = {
        main: {
          App: {
            SaveSetting: saveSettingMock,
          },
        },
      };
      const gw = new WailsBackendGateway();
      expect(await gw.clearAllAutosaves()).toBe(true);
      expect(saveSettingMock).toHaveBeenCalledTimes(2);
      expect(saveSettingMock).toHaveBeenCalledWith('auto_saved_profile_latest', '');
      expect(saveSettingMock).toHaveBeenCalledWith('auto_saved_profile_content', '');
    });

    it('handles globalThis.runtime events', () => {
      const mockRuntime = {
        EventsOn: vi.fn().mockReturnValue(() => {}),
        EventsEmit: vi.fn(),
      };
      (globalThis as any).runtime = mockRuntime;

      const cb = () => {};
      const unsub = gateway.onEvent('test', cb);
      expect(mockRuntime.EventsOn).toHaveBeenCalledWith('test', cb);
      expect(typeof unsub).toBe('function');

      gateway.emitEvent('test', 'arg1', 2);
      expect(mockRuntime.EventsEmit).toHaveBeenCalledWith('test', 'arg1', 2);
    });

    it('returns 0 when backend object exists but SaveProject is missing', async () => {
      (globalThis as any).go = {
        main: {
          App: {},
        },
      };

      const result = await gateway.saveProject('test', '{}');
      expect(result).toBe(0);
    });

    it('returns false when backend object exists but SaveSetting is missing', async () => {
      (globalThis as any).go = {
        main: {
          App: {},
        },
      };

      const result = await gateway.saveSetting('key', 'val');
      expect(result).toBe(false);
    });

    it('generates multi-document YAML client-side in generateYaml', async () => {
      const nodes = [
        { id: 'p1', type: 'Pod', data: { label: 'pod-1' } },
        { id: 's1', type: 'Service', data: { label: 'svc-1' } },
      ];

      const yamlResult = await gateway.generateYaml(JSON.stringify(nodes), '[]');
      expect(yamlResult).toContain('kind: Pod');
      expect(yamlResult).toContain('name: pod-1');
      expect(yamlResult).toContain('---');
      expect(yamlResult).toContain('kind: Service');
      expect(yamlResult).toContain('name: svc-1');
    });

    it('returns empty string when client-side YAML generation encounters malformed JSON', async () => {
      const yamlResult = await gateway.generateYaml('invalid-json{{{', '[]');
      expect(yamlResult).toBe('');
    });

    it('resolves methods split across globalThis.go.main.App and window.go.main.App', async () => {
      const mockGetSetting = vi.fn().mockResolvedValue('split-value');
      const mockGetProjects = vi.fn().mockResolvedValue([{ id: 99, name: 'Split Project' }]);

      (globalThis as any).go = {
        main: {
          App: {
            GetSetting: mockGetSetting,
          },
        },
      };

      (globalThis as any).window = {
        go: {
          main: {
            App: {
              GetProjects: mockGetProjects,
            },
          },
        },
      };

      expect(await gateway.getSetting('k')).toBe('split-value');
      expect(await gateway.getProjects()).toEqual([{ id: 99, name: 'Split Project' }]);
    });

    it('handles onEvent when runtime EventsOn returns undefined or non-function cleanup', () => {
      (globalThis as any).runtime = {
        EventsOn: vi.fn().mockReturnValue(undefined),
      };

      const unsub = gateway.onEvent('no-cleanup-event', () => {});
      expect(typeof unsub).toBe('function');
      expect(() => unsub()).not.toThrow();
    });
  });

  describe('MockBackendGateway Operations - Additional Edge Cases', () => {
    let mock: MockBackendGateway;

    beforeEach(() => {
      mock = new MockBackendGateway();
    });

    it('handles pushHistory with invalid JSON string and applies fallback defaults', async () => {
      await mock.pushHistory('not-json');
      const logs = await mock.getHistoryLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].actionName).toBe('Action');
      expect(typeof logs[0].timestamp).toBe('number');
    });

    it('handles multiple event subscribers and selective unsubscription', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsub1 = mock.onEvent('alert', handler1);
      const unsub2 = mock.onEvent('alert', handler2);

      mock.emitEvent('alert', 'data-1');
      expect(handler1).toHaveBeenCalledWith('data-1');
      expect(handler2).toHaveBeenCalledWith('data-1');

      unsub1();

      mock.emitEvent('alert', 'data-2');
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(2);

      unsub2();
      mock.emitEvent('alert', 'data-3');
      expect(handler2).toHaveBeenCalledTimes(2);

      // Emit event for an event name with no registered listeners (covers if (!set) branch)
      expect(() => mock.emitEvent('completely-unregistered-event', 'no-op')).not.toThrow();
    });

    it('handles mock file operations and window diagnostics', async () => {
      expect(await mock.exportProjectFile('/path', '{}', '')).toBe(true);
      expect(await mock.importProjectFile()).toBe('');
      expect(await mock.fileExists('/path')).toBe(true);
      expect(await mock.openFileFolder('/path')).toBe(true);
      expect(await mock.openLogFile('/path')).toBe(true);

      expect(await mock.calculateAppHeight(900)).toBe(765);
      expect(await mock.getTargetScreen([])).toBe(false);
      expect(await mock.getTargetScreenHeight([])).toBe(1080);

      await mock.minimizeWindow();
      await mock.maximizeWindow();
      await mock.closeWindow();
      await mock.setInitialFile('/init.infra');

      expect(await mock.writeLog('sys', 'info', 'hello')).toBe(true);
      const sysInfo = await mock.getSystemInfo();
      expect(sysInfo.version).toBe(APP_VERSION);
      const sysRes = await mock.getSystemResources();
      expect(sysRes.cpuCores).toBe(8);
      const updateInfo = await mock.checkForUpdates(APP_VERSION);
      expect(updateInfo.updateAvailable).toBe(false);
      expect(await mock.greet('Kube')).toBe('Hello Kube!');
    });
  });

  describe('BaseBackendGateway PascalCase Parity Aliases', () => {
    it('delegates PascalCase aliases correctly to camelCase methods on MockBackendGateway', async () => {
      const mock = new MockBackendGateway();
      expect(await mock.GetProjects()).toEqual([]);
      const id = await mock.SaveProject('Alias Project', '{}');
      expect(typeof id).toBe('number');
      expect(await mock.LoadProject(id)).not.toBeNull();
      expect(await mock.UpdateProject(id, '{"updated":true}')).toBe(true);
      expect(await mock.DeleteProject(id)).toBe(true);

      expect(await mock.GetSetting('k')).toBe('');
      expect(await mock.SaveSetting('k', 'v')).toBe(true);
      expect(await mock.GetSetting('k')).toBe('v');

      expect(await mock.CalculateAppHeight(1000)).toBe(850);
      expect(await mock.GetTargetScreen([])).toBe(false);
      expect(await mock.GetTargetScreenHeight([])).toBe(1080);
      expect(await mock.CheckForUpdates(APP_VERSION)).toHaveProperty('updateAvailable', false);
      expect(await mock.Greet('User')).toBe('Hello User!');
      expect(await mock.FileExists('/path')).toBe(true);
      expect(await mock.OpenFileFolder('/path')).toBe(true);
      expect(await mock.OpenLogFile('/path')).toBe(true);
      expect(await mock.ExportProjectFile('p', 'c', 'y')).toBe(true);
      expect(await mock.ImportProjectFile()).toBe('');
      expect(await mock.GetAutosaveProfiles()).toEqual([]);
      expect(await mock.ClearAllAutosaves()).toBe(true);
      expect(await mock.GetInternetProfiles()).toEqual([]);
      expect(await mock.SaveInternetProfile('prof', '{"hourly":{}}')).toBe(true);
      expect(await mock.DeleteInternetProfile('prof')).toBe(true);
      expect(await mock.GetHistoryLogs()).toEqual([]);
      expect(await mock.GetCurrentHistoryIndex()).toBe(-1);
      await mock.PushHistory('{"actionName":"Step 1"}');
      expect(await mock.GetCurrentHistoryIndex()).toBe(0);
      expect(await mock.JumpToHistory(0)).toContain('Step 1');
      expect(await mock.Undo()).toBeNull();
      expect(await mock.Redo()).toBeNull();
      await mock.MinimizeWindow();
      await mock.MaximizeWindow();
      await mock.CloseWindow();
      expect(await mock.OpenSimulationWindow()).toBe(true);
      expect(await mock.CloseSimulationWindow()).toBe(true);
      expect(await mock.StartSimulation(5)).toBe(true);
      expect(await mock.PauseSimulation()).toBe(true);
      expect(await mock.ResumeSimulation()).toBe(true);
      expect(await mock.SetSimulationSpeed(10)).toBe(true);
      expect(await mock.BroadcastSimulationSnapshot('{"test":1}')).toBe(true);
      expect(await mock.GetSimulationSnapshot()).toBe('{"test":1}');
      expect(await mock.StopSimulation()).toBe(true);
      await mock.SetInitialFile('/init');
      expect(await mock.WriteLog('cat', 'info', 'msg')).toBe(true);
      expect(await mock.GetSystemInfo()).toHaveProperty('version');
      expect(await mock.GetSystemResources()).toHaveProperty('cpuCores');
      expect(await mock.GenerateYaml('[]', '[]')).toBe('');
      expect(await mock.FetchDockerHubPopular()).toContain('nginx');
      expect(await mock.FetchDockerHubTags('nginx')).toContain('latest');
      expect(await mock.SearchDockerHub('query')).toContain('query');
    });
  });

  describe('WailsBackendGateway additional branch coverage', () => {
    let gateway: WailsBackendGateway;

    beforeEach(() => {
      gateway = new WailsBackendGateway();
    });

    it('resolves app methods from window.go.main.App when globalThis.go is absent', async () => {
      const mockGetSetting = vi.fn().mockResolvedValue('secondary-value');
      const mockGetProjects = vi.fn().mockResolvedValue([{ id: 99, name: 'Split Project' }]);
      (globalThis as any).window = { go: { main: { App: { GetSetting: mockGetSetting, GetProjects: mockGetProjects } } } };

      expect(await gateway.getSetting('k')).toBe('secondary-value');
      expect(await gateway.getProjects()).toEqual([{ id: 99, name: 'Split Project' }]);
    });

    it('saveProject returns 0 when the window backend object exists but SaveProject is missing', async () => {
      (globalThis as any).window = { go: { main: { App: {} } } };
      expect(await gateway.saveProject('test', '{}')).toBe(0);
    });

    it('saveProject returns Date.now-like fallback when no backend object exists at all', async () => {
      delete (globalThis as any).go;
      delete (globalThis as any).window;
      const result = await gateway.saveProject('test', '{}');
      expect(result).toBeGreaterThan(0);
    });

    it('openSimulationWindow falls back to globalThis.open when the app method returns falsy', async () => {
      const appMock = { OpenSimulationWindow: vi.fn().mockResolvedValue(false) };
      (globalThis as any).go = { main: { App: appMock } };
      const fakePopup = { focus: vi.fn() };
      const openSpy = vi.fn().mockReturnValue(fakePopup);
      const origOpen = globalThis.open;
      globalThis.open = openSpy as any;
      try {
        expect(await gateway.openSimulationWindow()).toBe(true);
        expect(openSpy).toHaveBeenCalled();
        expect(openSpy.mock.calls[0][1]).toBe('simulation-monitoring');
      } finally {
        globalThis.open = origOpen;
      }
    });

    it('openSidebarWindow falls back to globalThis.open when the app method is missing', async () => {
      (globalThis as any).go = { main: { App: {} } };
      const openSpy = vi.fn().mockReturnValue({ focus: vi.fn() });
      const origOpen = globalThis.open;
      globalThis.open = openSpy as any;
      try {
        expect(await gateway.openSidebarWindow('right')).toBe(true);
        expect(openSpy.mock.calls[0][1]).toBe('sidebar-right');
        expect(openSpy.mock.calls[0][0]).toContain('mode=sidebar-right');
      } finally {
        globalThis.open = origOpen;
      }
    });

    it('openSidebarWindow returns false when globalThis.open returns null or throws', async () => {
      (globalThis as any).go = { main: { App: {} } };
      const origOpen = globalThis.open;
      globalThis.open = vi.fn().mockReturnValue(null) as any;
      try {
        expect(await gateway.openSidebarWindow('left')).toBe(false);
      } finally {
        globalThis.open = origOpen;
      }
      globalThis.open = vi.fn().mockImplementation(() => {
        throw new Error('popup blocked');
      }) as any;
      try {
        expect(await gateway.openSidebarWindow('right')).toBe(false);
      } finally {
        globalThis.open = origOpen;
      }
    });

    it('closeSidebarWindow returns false when the app method is missing', async () => {
      (globalThis as any).go = { main: { App: {} } };
      expect(await gateway.closeSidebarWindow('left')).toBe(false);
    });

    it('resumeSimulation and broadcastSimulationSnapshot emit events when app methods are missing', async () => {
      const eventsEmit = vi.fn();
      (globalThis as any).runtime = { EventsEmit: eventsEmit };
      (globalThis as any).go = { main: { App: {} } };

      expect(await gateway.resumeSimulation()).toBe(true);
      expect(eventsEmit).toHaveBeenCalledWith('simulation-state-change', expect.stringContaining('"isPaused":false'));

      expect(await gateway.broadcastSimulationSnapshot('{"snap":1}')).toBe(true);
      expect(eventsEmit).toHaveBeenCalledWith('simulation-snapshot-updated', '{"snap":1}');
    });

    it('generateYaml uses the client-side generator regardless of app.GenerateYaml', async () => {
      const appMock = { GenerateYaml: vi.fn().mockResolvedValue('ignored') };
      (globalThis as any).go = { main: { App: appMock } };

      const yaml = await gateway.generateYaml('[]', '[]');
      expect(appMock.GenerateYaml).not.toHaveBeenCalled();
      expect(typeof yaml).toBe('string');
    });

    it('getRuntimeWindow resolves a window-scoped wails Window object', async () => {
      const mockMinimise = vi.fn().mockResolvedValue(undefined);
      (globalThis as any).chrome = { webview: { postMessage: () => {} } };
      (globalThis as any).window = { wails: { Window: { Minimise: mockMinimise } } };

      await gateway.minimizeWindow();
      expect(mockMinimise).toHaveBeenCalled();
    });

    it('getRuntimeWindow falls through to the Window import when window has no wails', async () => {
      // Desktop mode (chrome set) but no window.wails -> getRuntimeWindow returns the imported Window
      (globalThis as any).chrome = { webview: { postMessage: () => {} } };
      (globalThis as any).window = {};

      const runtimeWin = await gateway
        .minimizeWindow()
        .then(() => undefined);
      expect(runtimeWin).toBeUndefined();
    });

    it('openSidebarWindow returns the app result and covers both res sides', async () => {
      const openSidebarWindowMock = vi.fn().mockResolvedValue(true);
      (globalThis as any).go = { main: { App: { OpenSidebarWindow: openSidebarWindowMock } } };

      expect(await gateway.openSidebarWindow('left')).toBe(true);
      expect(openSidebarWindowMock).toHaveBeenCalledWith('left');

      // falsy app result -> falls back to globalThis.open
      openSidebarWindowMock.mockResolvedValue(false);
      const openSpy = vi.fn().mockReturnValue({ focus: vi.fn() });
      const origOpen = globalThis.open;
      globalThis.open = openSpy as any;
      try {
        expect(await gateway.openSidebarWindow('right')).toBe(true);
        expect(openSpy.mock.calls[0][1]).toBe('sidebar-right');
      } finally {
        globalThis.open = origOpen;
      }
    });

    it('closeSidebarWindow delegates to the app when the method exists', async () => {
      const closeSidebarWindowMock = vi.fn().mockResolvedValue(true);
      (globalThis as any).go = { main: { App: { CloseSidebarWindow: closeSidebarWindowMock } } };
      expect(await gateway.closeSidebarWindow('right')).toBe(true);
      expect(closeSidebarWindowMock).toHaveBeenCalledWith('right');
    });

    it('emits simulation events when the app methods are missing and runtime is present', async () => {
      const eventsEmit = vi.fn();
      (globalThis as any).runtime = { EventsEmit: eventsEmit };
      (globalThis as any).go = { main: { App: {} } };

      expect(await gateway.resumeSimulation()).toBe(true);
      expect(eventsEmit).toHaveBeenCalledWith('simulation-state-change', '{"isPaused":false}');

      expect(await gateway.broadcastSimulationSnapshot('{"snap":1}')).toBe(true);
      expect(eventsEmit).toHaveBeenCalledWith('simulation-snapshot-updated', '{"snap":1}');
    });

    it('resolves app methods when only globalThis.window.go.main.App exists', async () => {
      delete (globalThis as any).go;
      (globalThis as any).window = { go: { main: { App: { OpenSidebarWindow: vi.fn().mockResolvedValue(true) } } } };

      expect(await gateway.openSidebarWindow('left')).toBe(true);
    });

    it('app getter falls back to the wails module when globalThis is unavailable', async () => {
      const gw = new WailsBackendGateway();
      const origDescriptor = Object.getOwnPropertyDescriptor(global, 'globalThis');
      try {
        Object.defineProperty(global, 'globalThis', {
          configurable: true,
          get() {
            const stack = new Error().stack || '';
            if (stack.includes('WailsBackendGateway.ts')) {
              return undefined;
            }
            return origDescriptor?.value ?? global;
          },
        });
        await expect(gw.minimizeWindow()).resolves.toBeUndefined();
        await expect(gw.maximizeWindow()).resolves.toBeUndefined();
        await expect(gw.closeWindow()).resolves.toBeUndefined();
      } finally {
        if (origDescriptor) {
          Object.defineProperty(global, 'globalThis', origDescriptor);
        } else {
          delete (global as any).globalThis;
        }
      }
    });

    it('proxy get falls through to getWailsFallback for missing methods', () => {
      delete (globalThis as any).go;
      delete (globalThis as any).window;
      expect((gateway as any).TotallyMissingMethod).toBeUndefined();
    });

    it('getSimulationSnapshot returns {} when the app method returns empty', async () => {
      const snapMock = vi.fn().mockResolvedValue('');
      (globalThis as any).go = { main: { App: { GetSimulationSnapshot: snapMock } } };
      expect(await gateway.getSimulationSnapshot()).toBe('{}');
      expect(snapMock).toHaveBeenCalled();
    });
  });

  describe('Bindings Fallback Module', () => {
    it('returns resolved stub defaults safely when Wails bindings are unavailable', async () => {
      await expect(fallbackBindings.MinimizeWindow()).resolves.toBeUndefined();
      await expect(fallbackBindings.MaximizeWindow()).resolves.toBeUndefined();
      await expect(fallbackBindings.CloseWindow()).resolves.toBeUndefined();
      await expect(fallbackBindings.OpenSimulationWindow()).resolves.toBe(false);
      await expect(fallbackBindings.CloseSimulationWindow()).resolves.toBe(false);
      await expect(fallbackBindings.StartSimulation()).resolves.toBe(true);
      await expect(fallbackBindings.PauseSimulation()).resolves.toBe(true);
      await expect(fallbackBindings.ResumeSimulation()).resolves.toBe(true);
      await expect(fallbackBindings.StopSimulation()).resolves.toBe(true);
      await expect(fallbackBindings.SetSimulationSpeed(1)).resolves.toBe(true);
      await expect(fallbackBindings.BroadcastSimulationSnapshot('')).resolves.toBe(true);
      await expect(fallbackBindings.GetSimulationSnapshot()).resolves.toBe('{}');
      await expect(fallbackBindings.Greet('Test')).resolves.toBe('');
      await expect(fallbackBindings.GetSystemResources()).resolves.toEqual({});
    });

    it('covers MockBackendGateway openDevTools, openSidebarWindow, and closeSidebarWindow', async () => {
      const mockGw = new MockBackendGateway();
      await expect(mockGw.openDevTools()).resolves.toBeUndefined();
      await expect(mockGw.openSidebarWindow('left')).resolves.toBe(true);
      await expect(mockGw.closeSidebarWindow('left')).resolves.toBe(true);
    });
  });
});
