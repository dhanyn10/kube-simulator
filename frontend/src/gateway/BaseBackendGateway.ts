import yaml from 'js-yaml';
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
 * Base Abstract Gateway providing common helpers and single source of truth
 * for PascalCase parity aliases across Wails and Mock gateway adapters.
 */
export abstract class BaseBackendGateway implements IBackendGateway {
  // Project operations
  abstract getProjects(): Promise<ProjectItem[]>;
  abstract saveProject(name: string, content: string): Promise<number>;
  abstract loadProject(id: number): Promise<ProjectItem | null>;
  abstract deleteProject(id: number): Promise<boolean>;
  abstract updateProject(id: number, content: string): Promise<boolean>;
  abstract exportProjectFile(projectName: string, canvasContent: string, yamlContent: string): Promise<boolean>;
  abstract importProjectFile(): Promise<string>;
  abstract fileExists(filePath: string): Promise<boolean>;
  abstract openFileFolder(filePath: string): Promise<boolean>;

  // Autosave & Settings operations
  abstract getAutosaveProfiles(): Promise<AutosaveItem[]>;
  abstract clearAllAutosaves(): Promise<boolean>;
  abstract getSetting(key: string): Promise<string>;
  abstract saveSetting(key: string, value: string): Promise<boolean>;

  // Internet profiles
  abstract getInternetProfiles(): Promise<InternetProfileItem[]>;
  abstract saveInternetProfile(name: string, profileJson: string): Promise<boolean>;
  abstract deleteInternetProfile(name: string): Promise<boolean>;

  // History operations
  abstract getHistoryLogs(): Promise<HistoryItem[]>;
  abstract getCurrentHistoryIndex(): Promise<number>;
  abstract pushHistory(stateJson: string): Promise<void>;
  abstract jumpToHistory(index: number): Promise<string>;
  abstract undo(): Promise<string | null>;
  abstract redo(): Promise<string | null>;

  // Window operations
  abstract minimizeWindow(): Promise<void>;
  abstract maximizeWindow(): Promise<void>;
  abstract closeWindow(): Promise<void>;
  abstract calculateAppHeight(screenHeight: number): Promise<number>;
  abstract getTargetScreen(screens: any[]): Promise<any>;
  abstract getTargetScreenHeight(screens: any[]): Promise<number | boolean>;

  // Logging & diagnostics
  abstract writeLog(category: string, level: string, message: string): Promise<boolean>;
  abstract openLogFile(filePath?: string): Promise<boolean>;

  // System & Updates
  abstract getSystemInfo(): Promise<SystemInfoData>;
  abstract getSystemResources(): Promise<SystemResourceInfo>;
  abstract checkForUpdates(currentVersion: string): Promise<UpdateInfoData>;
  abstract greet(name: string): Promise<string>;
  abstract setInitialFile(filePath: string): Promise<void>;

  // DockerHub & YAML operations
  abstract generateYaml(nodesJson: string, edgesJson: string): Promise<string>;
  abstract fetchDockerHubPopular(): Promise<string>;
  abstract fetchDockerHubTags(imageName: string): Promise<string>;
  abstract searchDockerHub(query: string): Promise<string>;

  // Event handling
  abstract onEvent(eventName: string, callback: (...args: any[]) => void): () => void;
  abstract emitEvent(eventName: string, ...args: any[]): void;

  /**
   * Converts a JSON string containing manifest objects into formatted YAML with '---' separators.
   */
  protected convertJsonManifestsToYaml(jsonStr: string): string {
    if (!jsonStr) return '';
    try {
      const objects = JSON.parse(jsonStr);
      if (Array.isArray(objects)) {
        return objects.map((obj) => yaml.dump(obj, { indent: 2, noRefs: true })).join('---\n');
      }
      return jsonStr;
    } catch {
      return jsonStr;
    }
  }

  /**
   * Generates YAML manifest client-side from nodes and edges JSON strings.
   */
  protected generateYamlClientSideFallback(nodesJson: string, edgesJson: string): string {
    try {
      const nodes = JSON.parse(nodesJson || '[]');
      const edges = JSON.parse(edgesJson || '[]');
      return generateYamlClientSide(nodes, edges);
    } catch {
      return '';
    }
  }

  /**
   * Creates default update information object.
   */
  protected createDefaultUpdateInfo(currentVersion: string): UpdateInfoData {
    return {
      currentVersion,
      latestVersion: currentVersion,
      updateAvailable: false,
      releaseUrl: '',
      isPrerelease: false,
    };
  }

  // --- PascalCase Parity Aliases (Single Source of Truth) ---
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
