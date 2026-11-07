import {
  IBackendGateway,
  ProjectItem,
  AutosaveItem,
  HistoryItem,
  InternetProfileItem,
  SystemInfoData,
  SystemResourceInfo,
  UpdateInfoData,
} from './IBackendGateway';
import { generateYamlClientSide } from '@/lib/manifestGenerator';

/**
 * Concrete Wails Adapter for IBackendGateway.
 * Dynamically binds to `globalThis.go.main.App` and `globalThis.runtime`,
 * providing graceful fallbacks when executed in a pure browser or test environment.
 */
export class WailsBackendGateway implements IBackendGateway {
  private get app(): any {
    if (typeof globalThis !== 'undefined') {
      return (globalThis as any).go?.main?.App;
    }
    return undefined;
  }

  private get runtime(): any {
    if (typeof globalThis !== 'undefined') {
      return (globalThis as any).runtime;
    }
    return undefined;
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
    if (typeof this.app?.MinimizeWindow === 'function') {
      await this.app.MinimizeWindow();
    }
  }

  async maximizeWindow(): Promise<void> {
    if (typeof this.app?.MaximizeWindow === 'function') {
      await this.app.MaximizeWindow();
    }
  }

  async closeWindow(): Promise<void> {
    if (typeof this.app?.CloseWindow === 'function') {
      await this.app.CloseWindow();
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
    return true;
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
      version: '0.4.0',
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
    return {
      currentVersion,
      latestVersion: currentVersion,
      updateAvailable: false,
      releaseUrl: '',
      isPrerelease: false,
    };
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
      return this.app.GenerateYaml(nodesJson, edgesJson);
    }
    try {
      const nodes = JSON.parse(nodesJson || '[]');
      const edges = JSON.parse(edgesJson || '[]');
      return generateYamlClientSide(nodes, edges);
    } catch {
      return '';
    }
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
      return this.runtime.EventsOn(eventName, callback);
    }
    return () => {};
  }

  emitEvent(eventName: string, ...args: any[]): void {
    if (typeof this.runtime?.EventsEmit === 'function') {
      this.runtime.EventsEmit(eventName, ...args);
    }
  }

  // --- PascalCase Parity Aliases ---
  CalculateAppHeight(s: number) { return this.calculateAppHeight(s); }
  CheckForUpdates(v: string) { return this.checkForUpdates(v); }
  ClearAllAutosaves() { return this.clearAllAutosaves(); }
  CloseWindow() { return this.closeWindow(); }
  DeleteInternetProfile(n: string) { return this.deleteInternetProfile(n); }
  DeleteProject(id: number) { return this.deleteProject(id); }
  ExportProjectFile(p: string, c: string, y: string) { return this.exportProjectFile(p, c, y); }
  FetchDockerHubPopular() { return this.fetchDockerHubPopular(); }
  FetchDockerHubTags(i: string) { return this.fetchDockerHubTags(i); }
  FileExists(p: string) { return this.fileExists(p); }
  GenerateYaml(n: string, e: string) { return this.generateYaml(n, e); }
  GetAutosaveProfiles() { return this.getAutosaveProfiles(); }
  GetCurrentHistoryIndex() { return this.getCurrentHistoryIndex(); }
  GetHistoryLogs() { return this.getHistoryLogs(); }
  GetInternetProfiles() { return this.getInternetProfiles(); }
  GetProjects() { return this.getProjects(); }
  GetSetting(k: string) { return this.getSetting(k); }
  GetSystemInfo() { return this.getSystemInfo(); }
  GetSystemResources() { return this.getSystemResources(); }
  GetTargetScreen(s: any[]) { return this.getTargetScreen(s); }
  GetTargetScreenHeight(s: any[]) { return this.getTargetScreenHeight(s); }
  Greet(n: string) { return this.greet(n); }
  ImportProjectFile() { return this.importProjectFile(); }
  JumpToHistory(i: number) { return this.jumpToHistory(i); }
  LoadProject(id: number) { return this.loadProject(id); }
  MaximizeWindow() { return this.maximizeWindow(); }
  MinimizeWindow() { return this.minimizeWindow(); }
  OpenFileFolder(p: string) { return this.openFileFolder(p); }
  OpenLogFile(p?: string) { return this.openLogFile(p); }
  PushHistory(s: string) { return this.pushHistory(s); }
  Redo() { return this.redo(); }
  SaveInternetProfile(n: string, p: string) { return this.saveInternetProfile(n, p); }
  SaveProject(n: string, c: string) { return this.saveProject(n, c); }
  SaveSetting(k: string, v: string) { return this.saveSetting(k, v); }
  SearchDockerHub(q: string) { return this.searchDockerHub(q); }
  SetInitialFile(p: string) { return this.setInitialFile(p); }
  Undo() { return this.undo(); }
  UpdateProject(id: number, c: string) { return this.updateProject(id, c); }
  WriteLog(c: string, l: string, m: string) { return this.writeLog(c, l, m); }
}