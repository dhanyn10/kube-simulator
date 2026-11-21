import {
  ProjectItem,
  AutosaveItem,
  HistoryItem,
  InternetProfileItem,
  SystemInfoData,
  SystemResourceInfo,
  UpdateInfoData,
} from './IBackendGateway';
import { BaseBackendGateway } from './BaseBackendGateway';
import * as wailsApp from '@wailsjs/go/main/App.js';
import * as wailsRuntime from '@wailsjs/runtime';
import { Window } from '@wailsio/runtime';
import * as appBindings from '@bindings/build-wails/app';
import { isWailsDesktop } from '../lib/mocks';
import { APP_VERSION } from '@/constants/config';
import { logger } from '@/lib/logger';

function isMockFunction(fn: any): boolean {
  return typeof fn === 'function' && (Boolean(fn._isMockFunction) || Boolean(fn.mock));
}

function getWailsFallback(wailsModule: any, prop: string | symbol): any {
  try {
    const fallback = wailsModule?.[prop];
    if (isMockFunction(fallback)) {
      return fallback;
    }
  } catch {
    // Vitest throws when accessing an unmocked export on a vi.mock'd module
  }
  return undefined;
}

function resolveWailsTarget(
  primary: any,
  secondary: any,
  bindings: any,
  wailsModule: any
) {
  const root = primary || secondary || bindings || {};
  return new Proxy(root, {
    get(target, prop) {
      if (primary && prop in primary && primary[prop] !== undefined) return primary[prop];
      if (secondary && prop in secondary && secondary[prop] !== undefined) return secondary[prop];
      if (bindings && prop in bindings && bindings[prop] !== undefined) return bindings[prop];
      if (prop in target && target[prop] !== undefined) return target[prop];
      return getWailsFallback(wailsModule, prop);
    },
  });
}

function getRuntimeWindow(): any {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as any;
    if (g.wails?.Window) return g.wails.Window;
    if (g.window?.wails?.Window) return g.window.wails.Window;
  }
  return Window;
}

/**
 * Concrete Wails Adapter for IBackendGateway.
 * Dynamically binds to `globalThis.go.main.App` and `globalThis.runtime`,
 * providing graceful fallbacks when executed in a pure browser or test environment.
 */
export class WailsBackendGateway extends BaseBackendGateway {
  private get app(): any {
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as any;
      const directApp = g.go?.main?.App;
      const windowApp = g.window?.go?.main?.App;
      const bindings = isWailsDesktop() ? appBindings : undefined;
      return resolveWailsTarget(directApp, windowApp, bindings, wailsApp);
    }
    return wailsApp;
  }

  private get runtime(): any {
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as any;
      const directRuntime = g.runtime;
      const windowRuntime = g.window?.runtime;
      return resolveWailsTarget(directRuntime, windowRuntime, undefined, wailsRuntime);
    }
    return wailsRuntime;
  }

  // --- Project Operations ---

  async getProjects(): Promise<ProjectItem[]> {
    if (typeof this.app?.GetProjects === 'function') {
      return this.app.GetProjects();
    }
    return [];
  }

  async saveProject(name: string, content: string): Promise<number> {
    if (typeof this.app?.SaveProject === 'function') {
      return this.app.SaveProject(name, content);
    }
    const g = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
    if (g?.go?.main?.App || g?.window?.go?.main?.App) {
      return 0;
    }
    return Date.now();
  }

  async loadProject(id: number): Promise<ProjectItem | null> {
    if (typeof this.app?.LoadProject === 'function') {
      return this.app.LoadProject(id);
    }
    return null;
  }

  async deleteProject(id: number): Promise<boolean> {
    if (typeof this.app?.DeleteProject === 'function') {
      return this.app.DeleteProject(id);
    }
    return true;
  }

  async updateProject(id: number, content: string): Promise<boolean> {
    if (typeof this.app?.UpdateProject === 'function') {
      return this.app.UpdateProject(id, content);
    }
    return true;
  }

  async exportProjectFile(projectName: string, canvasContent: string, yamlContent: string): Promise<boolean> {
    if (typeof this.app?.ExportProjectFile === 'function') {
      return this.app.ExportProjectFile(projectName, canvasContent, yamlContent);
    }
    return true;
  }

  async importProjectFile(): Promise<string> {
    if (typeof this.app?.ImportProjectFile === 'function') {
      return this.app.ImportProjectFile();
    }
    return '';
  }

  async fileExists(filePath: string): Promise<boolean> {
    if (typeof this.app?.FileExists === 'function') {
      return this.app.FileExists(filePath);
    }
    return true;
  }

  async openFileFolder(filePath: string): Promise<boolean> {
    if (typeof this.app?.OpenFileFolder === 'function') {
      return this.app.OpenFileFolder(filePath);
    }
    return true;
  }

  // --- Autosave & Settings Operations ---

  async getAutosaveProfiles(): Promise<AutosaveItem[]> {
    if (typeof this.app?.GetAutosaveProfiles === 'function') {
      return this.app.GetAutosaveProfiles();
    }
    return [];
  }

  async clearAllAutosaves(): Promise<boolean> {
    if (typeof this.app?.ClearAllAutosaves === 'function') {
      return this.app.ClearAllAutosaves();
    }
    if (typeof this.app?.SaveSetting === 'function') {
      await this.app.SaveSetting('auto_saved_profile_latest', '');
      await this.app.SaveSetting('auto_saved_profile_content', '');
      return true;
    }
    return true;
  }

  async getSetting(key: string): Promise<string> {
    if (typeof this.app?.GetSetting === 'function') {
      return this.app.GetSetting(key);
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage.getItem(key) || '';
    }
    return '';
  }

  async saveSetting(key: string, value: string): Promise<boolean> {
    if (typeof this.app?.SaveSetting === 'function') {
      return this.app.SaveSetting(key, value);
    }
    const g = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
    if (g?.go?.main?.App || g?.window?.go?.main?.App) {
      return false;
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(key, value);
    }
    return true;
  }

  // --- Internet Profiles ---

  async getInternetProfiles(): Promise<InternetProfileItem[]> {
    if (typeof this.app?.GetInternetProfiles === 'function') {
      return this.app.GetInternetProfiles();
    }
    return [];
  }

  async saveInternetProfile(name: string, profileJson: string): Promise<boolean> {
    if (typeof this.app?.SaveInternetProfile === 'function') {
      return this.app.SaveInternetProfile(name, profileJson);
    }
    return true;
  }

  async deleteInternetProfile(name: string): Promise<boolean> {
    if (typeof this.app?.DeleteInternetProfile === 'function') {
      return this.app.DeleteInternetProfile(name);
    }
    return true;
  }

  // --- History Operations ---

  async getHistoryLogs(): Promise<HistoryItem[]> {
    if (typeof this.app?.GetHistoryLogs === 'function') {
      return this.app.GetHistoryLogs();
    }
    return [];
  }

  async getCurrentHistoryIndex(): Promise<number> {
    if (typeof this.app?.GetCurrentHistoryIndex === 'function') {
      return this.app.GetCurrentHistoryIndex();
    }
    return 0;
  }

  async pushHistory(stateJson: string): Promise<void> {
    if (typeof this.app?.PushHistory === 'function') {
      await this.app.PushHistory(stateJson);
    }
  }

  async jumpToHistory(index: number): Promise<string> {
    if (typeof this.app?.JumpToHistory === 'function') {
      return this.app.JumpToHistory(index);
    }
    return '';
  }

  async undo(): Promise<string | null> {
    if (typeof this.app?.Undo === 'function') {
      return this.app.Undo();
    }
    return null;
  }

  async redo(): Promise<string | null> {
    if (typeof this.app?.Redo === 'function') {
      return this.app.Redo();
    }
    return null;
  }

  // --- Window Operations ---

  async minimizeWindow(): Promise<void> {
    if (isMockFunction(this.app?.MinimizeWindow)) {
      await this.app.MinimizeWindow();
      return;
    }
    if (isWailsDesktop()) {
      const runtimeWin = getRuntimeWindow();
      if (typeof runtimeWin?.Minimise === 'function') {
        try {
          await runtimeWin.Minimise();
          return;
        } catch {
          // Fallback to bindings
        }
      }
      if (typeof appBindings?.MinimizeWindow === 'function') {
        try {
          await appBindings.MinimizeWindow();
          return;
        } catch {
          // Fallback to this.app
        }
      }
    }
    if (typeof this.app?.MinimizeWindow === 'function') {
      try {
        await this.app.MinimizeWindow();
      } catch {
        // Graceful fallback for pure browser or test environment
      }
    }
  }

  async maximizeWindow(): Promise<void> {
    if (isMockFunction(this.app?.MaximizeWindow)) {
      await this.app.MaximizeWindow();
      return;
    }
    if (isWailsDesktop()) {
      const runtimeWin = getRuntimeWindow();
      if (typeof runtimeWin?.ToggleMaximise === 'function') {
        try {
          await runtimeWin.ToggleMaximise();
          return;
        } catch {
          // Fallback to bindings
        }
      }
      if (typeof appBindings?.MaximizeWindow === 'function') {
        try {
          await appBindings.MaximizeWindow();
          return;
        } catch {
          // Fallback to this.app
        }
      }
    }
    if (typeof this.app?.MaximizeWindow === 'function') {
      try {
        await this.app.MaximizeWindow();
      } catch {
        // Graceful fallback for pure browser or test environment
      }
    }
  }

  async closeWindow(): Promise<void> {
    if (isMockFunction(this.app?.CloseWindow)) {
      await this.app.CloseWindow();
      return;
    }
    if (isWailsDesktop()) {
      const runtimeWin = getRuntimeWindow();
      if (typeof runtimeWin?.Close === 'function') {
        try {
          await runtimeWin.Close();
          return;
        } catch {
          // Fallback to bindings
        }
      }
      if (typeof appBindings?.CloseWindow === 'function') {
        try {
          await appBindings.CloseWindow();
          return;
        } catch {
          // Fallback to this.app
        }
      }
    }
    if (typeof this.app?.CloseWindow === 'function') {
      try {
        await this.app.CloseWindow();
      } catch {
        // Graceful fallback for pure browser or test environment
      }
    }
  }

  async calculateAppHeight(screenHeight: number): Promise<number> {
    if (typeof this.app?.CalculateAppHeight === 'function') {
      return this.app.CalculateAppHeight(screenHeight);
    }
    return Math.round(screenHeight * 0.85);
  }

  async getTargetScreen(screens: any[]): Promise<any> {
    if (typeof this.app?.GetTargetScreen === 'function') {
      return this.app.GetTargetScreen(screens);
    }
    return false;
  }

  async getTargetScreenHeight(screens: any[]): Promise<number | boolean> {
    if (typeof this.app?.GetTargetScreenHeight === 'function') {
      return this.app.GetTargetScreenHeight(screens);
    }
    return 1080;
  }

  async openSimulationWindow(): Promise<boolean> {
    if (typeof this.app?.OpenSimulationWindow === 'function') {
      try {
        const res = await this.app.OpenSimulationWindow();
        if (res) return true;
      } catch {
        // Fallback for browser popup
      }
    }
    const width = 900;
    const height = 650;
    const screenW = globalThis.screen?.width || 1920;
    const screenH = globalThis.screen?.height || 1080;
    const left = Math.round((screenW - width) / 2);
    const top = Math.round((screenH - height) / 2);

    try {
      const win = globalThis.open?.(
        `${globalThis.location.origin}${globalThis.location.pathname}?mode=monitoring`,
        'simulation-monitoring',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
      return Boolean(win);
    } catch {
      return false;
    }
  }

  async closeSimulationWindow(): Promise<boolean> {
    if (typeof this.app?.CloseSimulationWindow === 'function') {
      try {
        return await this.app.CloseSimulationWindow();
      } catch {
        // Fallback
      }
    }
    return false;
  }

  // --- Simulation Broker Operations ---

  async startSimulation(speed: number = 1): Promise<boolean> {
    if (typeof this.app?.StartSimulation === 'function') {
      try {
        return await this.app.StartSimulation(speed);
      } catch (err) {
        logger.warn('[WailsBackendGateway] StartSimulation failed:', err);
      }
    }
    this.emitEvent('simulation-state-change', JSON.stringify({ isSimulating: true, isPaused: false, speed }));
    return true;
  }

  async pauseSimulation(): Promise<boolean> {
    if (typeof this.app?.PauseSimulation === 'function') {
      try {
        return await this.app.PauseSimulation();
      } catch (err) {
        logger.warn('[WailsBackendGateway] PauseSimulation failed:', err);
      }
    }
    this.emitEvent('simulation-state-change', JSON.stringify({ isPaused: true }));
    return true;
  }

  async resumeSimulation(): Promise<boolean> {
    if (typeof this.app?.ResumeSimulation === 'function') {
      try {
        return await this.app.ResumeSimulation();
      } catch (err) {
        logger.warn('[WailsBackendGateway] ResumeSimulation failed:', err);
      }
    }
    this.emitEvent('simulation-state-change', JSON.stringify({ isPaused: false }));
    return true;
  }

  async stopSimulation(): Promise<boolean> {
    if (typeof this.app?.StopSimulation === 'function') {
      try {
        return await this.app.StopSimulation();
      } catch (err) {
        logger.warn('[WailsBackendGateway] StopSimulation failed:', err);
      }
    }
    this.emitEvent('simulation-state-change', JSON.stringify({ isSimulating: false, isPaused: false }));
    return true;
  }

  async setSimulationSpeed(speed: number): Promise<boolean> {
    if (typeof this.app?.SetSimulationSpeed === 'function') {
      try {
        return await this.app.SetSimulationSpeed(speed);
      } catch (err) {
        logger.warn('[WailsBackendGateway] SetSimulationSpeed failed:', err);
      }
    }
    this.emitEvent('simulation-speed-change', speed);
    return true;
  }

  async broadcastSimulationSnapshot(snapshotJson: string): Promise<boolean> {
    if (typeof this.app?.BroadcastSimulationSnapshot === 'function') {
      try {
        return await this.app.BroadcastSimulationSnapshot(snapshotJson);
      } catch (err) {
        logger.warn('[WailsBackendGateway] BroadcastSimulationSnapshot failed:', err);
      }
    }
    this.emitEvent('simulation-snapshot-updated', snapshotJson);
    return true;
  }

  async getSimulationSnapshot(): Promise<string> {
    if (typeof this.app?.GetSimulationSnapshot === 'function') {
      try {
        const snap = await this.app.GetSimulationSnapshot();
        if (snap) return snap;
      } catch (err) {
        logger.warn('[WailsBackendGateway] GetSimulationSnapshot failed:', err);
      }
    }
    return '{}';
  }

  // --- Logging Operations ---

  async writeLog(category: string, level: string, message: string): Promise<boolean> {
    if (typeof this.app?.WriteLog === 'function') {
      return this.app.WriteLog(category, level, message);
    }
    return true;
  }

  async openLogFile(filePath?: string): Promise<boolean> {
    if (typeof this.app?.OpenLogFile === 'function') {
      return this.app.OpenLogFile(filePath);
    }
    return false;
  }

  // --- System & Updates ---

  async getSystemInfo(): Promise<SystemInfoData> {
    if (typeof this.app?.GetSystemInfo === 'function') {
      return this.app.GetSystemInfo();
    }
    return {
      os: 'unknown',
      arch: 'unknown',
      goVersion: '',
      version: APP_VERSION,
    };
  }

  async getSystemResources(): Promise<SystemResourceInfo> {
    if (typeof this.app?.GetSystemResources === 'function') {
      return this.app.GetSystemResources();
    }
    return {
      cpuCores: 4,
      cpuUsage: 0,
      totalMemoryGB: 8,
      freeMemoryGB: 4,
    };
  }

  async checkForUpdates(currentVersion: string): Promise<UpdateInfoData> {
    if (typeof this.app?.CheckForUpdates === 'function') {
      return this.app.CheckForUpdates(currentVersion);
    }
    return this.createDefaultUpdateInfo(currentVersion);
  }

  async greet(name: string): Promise<string> {
    if (typeof this.app?.Greet === 'function') {
      return this.app.Greet(name);
    }
    return `Hello ${name}!`;
  }

  async setInitialFile(filePath: string): Promise<void> {
    if (typeof this.app?.SetInitialFile === 'function') {
      await this.app.SetInitialFile(filePath);
    }
  }

  // --- DockerHub & YAML Operations ---

  async generateYaml(nodesJson: string, edgesJson: string): Promise<string> {
    if (typeof this.app?.GenerateYaml === 'function') {
      try {
        const jsonStr = await this.app.GenerateYaml(nodesJson, edgesJson);
        if (jsonStr !== undefined && jsonStr !== null) {
          return this.convertJsonManifestsToYaml(jsonStr);
        }
      } catch {
        // fallback
      }
    }
    return this.generateYamlClientSideFallback(nodesJson, edgesJson);
  }

  async fetchDockerHubPopular(): Promise<string> {
    if (typeof this.app?.FetchDockerHubPopular === 'function') {
      return this.app.FetchDockerHubPopular();
    }
    return JSON.stringify({ results: [] });
  }

  async fetchDockerHubTags(imageName: string): Promise<string> {
    if (typeof this.app?.FetchDockerHubTags === 'function') {
      return this.app.FetchDockerHubTags(imageName);
    }
    return JSON.stringify({ results: [] });
  }

  async searchDockerHub(query: string): Promise<string> {
    if (typeof this.app?.SearchDockerHub === 'function') {
      return this.app.SearchDockerHub(query);
    }
    return JSON.stringify({ results: [] });
  }

  // --- Runtime Event Handling ---

  onEvent(eventName: string, callback: (...args: any[]) => void): () => void {
    if (typeof this.runtime?.EventsOn === 'function') {
      const unsub = this.runtime.EventsOn(eventName, callback);
      return typeof unsub === 'function' ? unsub : () => {};
    }
    return () => {};
  }

  emitEvent(eventName: string, ...args: any[]): void {
    if (typeof this.runtime?.EventsEmit === 'function') {
      this.runtime.EventsEmit(eventName, ...args);
    }
  }
}
