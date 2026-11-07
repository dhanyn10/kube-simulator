export interface ProjectItem {
  id: number;
  name: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface AutosaveItem {
  key: string;
  timestamp: number;
  location: string;
}

export interface HistoryItem {
  index: number;
  actionName: string;
  timestamp: number;
}

export interface InternetProfileItem {
  name: string;
  hourly?: Record<string, number>;
  daily?: Record<string, number>;
  timestamp?: number;
}

export interface SystemResourceInfo {
  cpuCores?: number;
  cpuUsage?: number;
  totalMemoryGB?: number;
  freeMemoryGB?: number;
  [key: string]: any;
}

export interface SystemInfoData {
  os: string;
  arch: string;
  goVersion: string;
  version: string;
  [key: string]: string;
}

export interface UpdateInfoData {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  releaseNotes?: string;
  publishedAt?: string;
  isPrerelease: boolean;
}

/**
 * Backend Gateway Port interface (Clean Architecture).
 * Abstracts communication between the React frontend and Go backend.
 * Provides canonical camelCase methods alongside PascalCase aliases
 * for 100% parity with Wails IPC bindings.
 */
export interface IBackendGateway {
  // Project operations
  getProjects(): Promise<ProjectItem[]>;
  saveProject(name: string, content: string): Promise<number>;
  loadProject(id: number): Promise<ProjectItem | null>;
  deleteProject(id: number): Promise<boolean>;
  updateProject(id: number, content: string): Promise<boolean>;
  exportProjectFile(projectName: string, canvasContent: string, yamlContent: string): Promise<boolean>;
  importProjectFile(): Promise<string>;
  fileExists(filePath: string): Promise<boolean>;
  openFileFolder(filePath: string): Promise<boolean>;

  // Autosave & Settings operations
  getAutosaveProfiles(): Promise<AutosaveItem[]>;
  clearAllAutosaves(): Promise<boolean>;
  getSetting(key: string): Promise<string>;
  saveSetting(key: string, value: string): Promise<boolean>;

  // Internet profiles
  getInternetProfiles(): Promise<InternetProfileItem[]>;
  saveInternetProfile(name: string, profileJson: string): Promise<boolean>;
  deleteInternetProfile(name: string): Promise<boolean>;

  // History & Database operations
  getHistoryLogs(): Promise<HistoryItem[]>;
  getCurrentHistoryIndex(): Promise<number>;
  pushHistory(stateJson: string): Promise<void>;
  jumpToHistory(index: number): Promise<string>;
  undo(): Promise<string | null>;
  redo(): Promise<string | null>;

  // Window operations
  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  calculateAppHeight(screenHeight: number): Promise<number>;
  getTargetScreen(screens: any[]): Promise<any>;
  getTargetScreenHeight(screens: any[]): Promise<number | boolean>;

  // Logging & diagnostics
  writeLog(category: string, level: string, message: string): Promise<boolean>;
  openLogFile(filePath?: string): Promise<boolean>;

  // System & Updates
  getSystemInfo(): Promise<SystemInfoData>;
  getSystemResources(): Promise<SystemResourceInfo>;
  checkForUpdates(currentVersion: string): Promise<UpdateInfoData>;
  greet(name: string): Promise<string>;
  setInitialFile(filePath: string): Promise<void>;

  // DockerHub & YAML operations
  generateYaml(nodesJson: string, edgesJson: string): Promise<string>;
  fetchDockerHubPopular(): Promise<string>;
  fetchDockerHubTags(imageName: string): Promise<string>;
  searchDockerHub(query: string): Promise<string>;

  // Runtime event handling
  onEvent(eventName: string, callback: (...args: any[]) => void): () => void;
  emitEvent(eventName: string, ...args: any[]): void;

  // --- PascalCase Parity Aliases ---
  CalculateAppHeight(screenHeight: number): Promise<number>;
  CheckForUpdates(currentVersion: string): Promise<UpdateInfoData>;
  ClearAllAutosaves(): Promise<boolean>;
  CloseWindow(): Promise<void>;
  DeleteInternetProfile(name: string): Promise<boolean>;
  DeleteProject(id: number): Promise<boolean>;
  ExportProjectFile(projectName: string, canvasContent: string, yamlContent: string): Promise<boolean>;
  FetchDockerHubPopular(): Promise<string>;
  FetchDockerHubTags(imageName: string): Promise<string>;
  FileExists(filePath: string): Promise<boolean>;
  GenerateYaml(nodesJson: string, edgesJson: string): Promise<string>;
  GetAutosaveProfiles(): Promise<AutosaveItem[]>;
  GetCurrentHistoryIndex(): Promise<number>;
  GetHistoryLogs(): Promise<HistoryItem[]>;
  GetInternetProfiles(): Promise<InternetProfileItem[]>;
  GetProjects(): Promise<ProjectItem[]>;
  GetSetting(key: string): Promise<string>;
  GetSystemInfo(): Promise<SystemInfoData>;
  GetSystemResources(): Promise<SystemResourceInfo>;
  GetTargetScreen(screens: any[]): Promise<any>;
  GetTargetScreenHeight(screens: any[]): Promise<number | boolean>;
  Greet(name: string): Promise<string>;
  ImportProjectFile(): Promise<string>;
  JumpToHistory(index: number): Promise<string>;
  LoadProject(id: number): Promise<ProjectItem | null>;
  MaximizeWindow(): Promise<void>;
  MinimizeWindow(): Promise<void>;
  OpenFileFolder(filePath: string): Promise<boolean>;
  OpenLogFile(filePath?: string): Promise<boolean>;
  PushHistory(stateJson: string): Promise<void>;
  Redo(): Promise<string | null>;
  SaveInternetProfile(name: string, profileJson: string): Promise<boolean>;
  SaveProject(name: string, content: string): Promise<number>;
  SaveSetting(key: string, value: string): Promise<boolean>;
  SearchDockerHub(query: string): Promise<string>;
  SetInitialFile(filePath: string): Promise<void>;
  Undo(): Promise<string | null>;
  UpdateProject(id: number, content: string): Promise<boolean>;
  WriteLog(category: string, level: string, message: string): Promise<boolean>;
}
