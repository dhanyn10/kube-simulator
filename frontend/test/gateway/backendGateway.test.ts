import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBackendGateway,
  setBackendGateway,
  resetBackendGateway,
  WailsBackendGateway,
  MockBackendGateway,
} from '@/gateway';

describe('Clean Architecture Backend Gateway', () => {
  beforeEach(() => {
    resetBackendGateway();
    delete (globalThis as any).go;
    delete (globalThis as any).runtime;
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
      await mock.minimizeWindow();
      await mock.maximizeWindow();
      await mock.closeWindow();
      await mock.setInitialFile('/test/path');

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
      expect(await gateway.openLogFile()).toBe(true);
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
      expect(await gateway.generateYaml('[]', '[]')).toBe('apiVersion: v1');
      expect(await gateway.fetchDockerHubPopular()).toContain('nginx');
      expect(await gateway.fetchDockerHubTags('nginx')).toContain('latest');
      expect(await gateway.searchDockerHub('redis')).toContain('redis');
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
  });
});
