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

/**
 * In-memory Mock Adapter for IBackendGateway.
 * Used for deterministic unit testing and browser preview environments.
 */
export class MockBackendGateway extends BaseBackendGateway {
  public readonly projects: Map<number, ProjectItem> = new Map();
  public readonly settings: Map<string, string> = new Map();
  public autosaves: AutosaveItem[] = [];
  public readonly internetProfiles: Map<string, InternetProfileItem> = new Map();
  public readonly historyLogs: HistoryItem[] = [];
  public readonly historySnapshots: string[] = [];
  public currentHistoryIndex: number = -1;
  public readonly loggedMessages: Array<{ category: string; level: string; message: string }> = [];
  public windowState: 'normal' | 'minimized' | 'maximized' | 'closed' = 'normal';
  public initialFile: string = '';
  private readonly eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  // --- Project Operations ---

  async getProjects(): Promise<ProjectItem[]> {
    return Array.from(this.projects.values());
  }

  async saveProject(name: string, content: string): Promise<number> {
    const id = Date.now();
    this.projects.set(id, {
      id,
      name,
      content,
      createdAt: id,
      updatedAt: id,
    });
    return id;
  }

  async loadProject(id: number): Promise<ProjectItem | null> {
    return this.projects.get(id) || null;
  }

  async deleteProject(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }

  async updateProject(id: number, content: string): Promise<boolean> {
    const existing = this.projects.get(id);
    if (!existing) return false;
    this.projects.set(id, {
      ...existing,
      content,
      updatedAt: Date.now(),
    });
    return true;
  }

  async exportProjectFile(_projectName: string, _canvasContent: string, _yamlContent: string): Promise<boolean> {
    return true;
  }

  async importProjectFile(): Promise<string> {
    return '';
  }

  async fileExists(_filePath: string): Promise<boolean> {
    return true;
  }

  async openFileFolder(_filePath: string): Promise<boolean> {
    return true;
  }

  // --- Autosave & Settings Operations ---

  async getAutosaveProfiles(): Promise<AutosaveItem[]> {
    return [...this.autosaves];
  }

  async clearAllAutosaves(): Promise<boolean> {
    this.autosaves = [];
    return true;
  }

  async getSetting(key: string): Promise<string> {
    return this.settings.get(key) || '';
  }

  async saveSetting(key: string, value: string): Promise<boolean> {
    this.settings.set(key, value);
    return true;
  }

  // --- Internet Profiles ---

  async getInternetProfiles(): Promise<InternetProfileItem[]> {
    return Array.from(this.internetProfiles.values());
  }

  async saveInternetProfile(name: string, profileJson: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(profileJson);
      this.internetProfiles.set(name, { ...parsed, name });
      return true;
    } catch {
      return false;
    }
  }

  async deleteInternetProfile(name: string): Promise<boolean> {
    return this.internetProfiles.delete(name);
  }

  // --- History Operations ---

  async getHistoryLogs(): Promise<HistoryItem[]> {
    return [...this.historyLogs];
  }

  async getCurrentHistoryIndex(): Promise<number> {
    return this.currentHistoryIndex;
  }

  async pushHistory(stateJson: string): Promise<void> {
    let actionName = 'Action';
    let timestamp = Date.now();
    try {
      const parsed = JSON.parse(stateJson);
      if (parsed.actionName) actionName = parsed.actionName;
      if (parsed.timestamp) timestamp = parsed.timestamp;
    } catch {
      // ignore
    }

    const nextIndex = this.historySnapshots.length;
    this.historySnapshots.push(stateJson);
    this.historyLogs.push({ index: nextIndex, actionName, timestamp });
    this.currentHistoryIndex = nextIndex;
  }

  async jumpToHistory(index: number): Promise<string> {
    if (index >= 0 && index < this.historySnapshots.length) {
      this.currentHistoryIndex = index;
      return this.historySnapshots[index];
    }
    return '';
  }

  async undo(): Promise<string | null> {
    if (this.currentHistoryIndex > 0) {
      this.currentHistoryIndex -= 1;
      return this.historySnapshots[this.currentHistoryIndex];
    }
    return null;
  }

  async redo(): Promise<string | null> {
    if (this.currentHistoryIndex < this.historySnapshots.length - 1) {
      this.currentHistoryIndex += 1;
      return this.historySnapshots[this.currentHistoryIndex];
    }
    return null;
  }

  // --- Window Operations ---

  async minimizeWindow(): Promise<void> {
    this.windowState = 'minimized';
  }

  async maximizeWindow(): Promise<void> {
    this.windowState = 'maximized';
  }

  async closeWindow(): Promise<void> {
    this.windowState = 'closed';
  }

  async calculateAppHeight(screenHeight: number): Promise<number> {
    return Math.round(screenHeight * 0.85);
  }

  async getTargetScreen(_screens: any[]): Promise<any> {
    return false;
  }

  async getTargetScreenHeight(_screens: any[]): Promise<number | boolean> {
    return 1080;
  }

  // --- Logging Operations ---

  async writeLog(category: string, level: string, message: string): Promise<boolean> {
    this.loggedMessages.push({ category, level, message });
    return true;
  }

  async openLogFile(_filePath?: string): Promise<boolean> {
    return true;
  }

  // --- System & Updates ---

  async getSystemInfo(): Promise<SystemInfoData> {
    return {
      os: 'mock-os',
      arch: 'mock-arch',
      goVersion: 'go1.25.0',
      version: '0.4.0',
    };
  }

  async getSystemResources(): Promise<SystemResourceInfo> {
    return {
      cpuCores: 8,
      cpuUsage: 15,
      totalMemoryGB: 16,
      freeMemoryGB: 12,
    };
  }

  async checkForUpdates(currentVersion: string): Promise<UpdateInfoData> {
    return this.createDefaultUpdateInfo(currentVersion);
  }

  async greet(name: string): Promise<string> {
    return `Hello ${name}!`;
  }

  async setInitialFile(filePath: string): Promise<void> {
    this.initialFile = filePath;
  }

  // --- DockerHub & YAML Operations ---

  async generateYaml(nodesJson: string, edgesJson: string): Promise<string> {
    return this.generateYamlClientSideFallback(nodesJson, edgesJson);
  }

  async fetchDockerHubPopular(): Promise<string> {
    return JSON.stringify({
      results: [
        { name: 'nginx', description: 'Official build of Nginx.' },
        { name: 'redis', description: 'In-memory data structure store' },
      ],
    });
  }

  async fetchDockerHubTags(_imageName: string): Promise<string> {
    return JSON.stringify({
      results: [{ name: 'latest' }, { name: 'alpine' }],
    });
  }

  async searchDockerHub(query: string): Promise<string> {
    return JSON.stringify({
      results: [{ repo_name: query, short_description: `Mock query: ${query}` }],
    });
  }

  // --- Runtime Event Handling ---

  onEvent(eventName: string, callback: (...args: any[]) => void): () => void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    const set = this.eventListeners.get(eventName)!;
    set.add(callback);

    return () => {
      set.delete(callback);
    };
  }

  emitEvent(eventName: string, ...args: any[]): void {
    const set = this.eventListeners.get(eventName);
    if (set) {
      set.forEach((cb) => {
        cb(...args);
      });
    }
  }
}
