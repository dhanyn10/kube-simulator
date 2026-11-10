import { useFlowStore } from '@/store';
import { setCurrentSessionAutosaveKey } from '@/store/useFlowStore';
import { mapProjectNodes, mapProjectEdges } from '@/components/Modals/resource-manager/resourceManagerHelpers';
import { hydrateNodes } from '@/store/nodeHelpers';
import { logger } from '@/lib/logger';
import { getBackendGateway, WailsBackendGateway, IBackendGateway } from '@/gateway';

export type BackstageTab = 'home' | 'settings-view' | 'settings-canvas';

export interface RecentFileItem {
  readonly id: number | string;
  readonly name: string;
  readonly location: string;
  readonly fullPath: string;
  readonly updatedAt: string;
  readonly isAutosave?: boolean;
  readonly nodes?: any[];
  readonly content?: string;
}

/**
 * Safely parse nodes array from JSON content string
 */
export const parseNodesFromContent = (content?: string): any[] => {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.nodes) ? parsed.nodes : [];
  } catch {
    return [];
  }
};

/**
 * Format a raw date/timestamp string or number to DD/MM/YYYY HH:mm:ss
 */
export const formatDateModified = (val?: string | number): string => {
  if (!val) return new Date().toLocaleString('en-GB');
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const isBackendAvailable = (gateway: IBackendGateway): boolean => {
  if (gateway instanceof WailsBackendGateway) {
    return Boolean((globalThis as any).go?.main?.App);
  }
  return true;
};

const fetchAutosaveProfiles = async (gateway: IBackendGateway): Promise<RecentFileItem[]> => {
  const autosaves = await gateway.getAutosaveProfiles();
  if (!Array.isArray(autosaves)) return [];

  // Sort descending by timestamp and only retain the 1 most recent autosaved session in Recent Projects
  const sorted = [...autosaves].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const latestOnly = sorted.slice(0, 1);

  const results = await Promise.all(
    latestOnly.map(async (a) => {
      let content = await gateway.getSetting(a.key);
      if (!content) {
        content = await gateway.getSetting('auto_saved_profile_content');
      }
      return {
        id: `autosave-${a.key}`,
        name: a.key,
        location: a.location,
        fullPath: a.location,
        updatedAt: formatDateModified(a.timestamp),
        isAutosave: true,
        nodes: parseNodesFromContent(content),
        content,
      };
    })
  );

  return results;
};

const fetchFallbackAutosaveProfile = async (gateway: IBackendGateway): Promise<RecentFileItem[]> => {
  const latestAutosaveKey = await gateway.getSetting('auto_saved_profile_latest');
  const latestAutosaveContent = await gateway.getSetting('auto_saved_profile_content');
  if (!latestAutosaveKey || !latestAutosaveContent) return [];

  let ts = Date.now();
  try {
    const parsed = JSON.parse(latestAutosaveContent);
    if (parsed.timestamp) ts = parsed.timestamp;
  } catch (err) {
    logger.error('[FileBackstage] Failed to parse latest autosave timestamp', err);
  }
  const autosaveLocation = `~/.kube-simulator/autosaves/${latestAutosaveKey}.infra`;
  const exists = await gateway.fileExists(autosaveLocation);
  if (!exists) return [];

  return [{
    id: 'autosave-latest',
    name: latestAutosaveKey,
    location: autosaveLocation,
    fullPath: autosaveLocation,
    updatedAt: formatDateModified(ts),
    isAutosave: true,
    nodes: parseNodesFromContent(latestAutosaveContent),
    content: latestAutosaveContent,
  }];
};

const fetchSavedProjects = async (gateway: IBackendGateway): Promise<RecentFileItem[]> => {
  const projects = await gateway.getProjects();
  if (!Array.isArray(projects)) return [];

  const projectChecks = projects.map(async (p) => {
    const fullPath = `~/.kube-simulator/projects/project_${p.id}.infra`;
    const exists = await gateway.fileExists(fullPath);
    if (exists) {
      return {
        id: p.id,
        name: p.name,
        location: fullPath,
        fullPath,
        updatedAt: formatDateModified(p.updatedAt || (p as any).updated_at || (p as any).created_at || Date.now()),
        nodes: parseNodesFromContent(p.content),
        content: p.content,
      } as RecentFileItem;
    }
    return null;
  });

  const results = await Promise.all(projectChecks);
  return results.filter((item): item is RecentFileItem => item !== null);
};

/**
 * Load recent projects and auto-saved profiles from Wails backend
 */
export const fetchRecentFiles = async (): Promise<RecentFileItem[]> => {
  const gateway = getBackendGateway();
  if (!isBackendAvailable(gateway)) return [];

  let items = await fetchAutosaveProfiles(gateway);
  if (items.length === 0) {
    items = await fetchFallbackAutosaveProfile(gateway);
  }
  const savedProjects = await fetchSavedProjects(gateway);
  return [...items, ...savedProjects];
};

/**
 * Execute delete operation for selected recent file item
 */
export const deleteRecentFile = async (
  item: RecentFileItem,
  reloadFiles: () => Promise<void>
): Promise<void> => {
  const gateway = getBackendGateway();
  if (!isBackendAvailable(gateway)) return;

  if (item.isAutosave) {
    await gateway.saveSetting(item.name, '');
    const latest = await gateway.getSetting('auto_saved_profile_latest');
    if (latest === item.name) {
      await gateway.saveSetting('auto_saved_profile_latest', '');
      await gateway.saveSetting('auto_saved_profile_content', '');
    }
  } else if (typeof item.id === 'number') {
    await gateway.deleteProject(item.id);
  }
  await reloadFiles();
};

/**
 * Execute cleanup of all autosave files and settings
 */
export const clearAllAutosaves = async (
  reloadFiles: () => Promise<void>
): Promise<void> => {
  const gateway = getBackendGateway();
  if (!isBackendAvailable(gateway)) return;

  await gateway.clearAllAutosaves();
  await reloadFiles();
};

/**
 * Execute open folder operation in OS file explorer for selected recent file item
 */
export const openRecentFileFolder = async (item: RecentFileItem): Promise<void> => {
  const gateway = getBackendGateway();
  if (!isBackendAvailable(gateway)) return;
  await gateway.openFileFolder(item.location || item.fullPath);
};

export const restoreRecentFile = async (
  item: RecentFileItem,
  onClose: () => void,
  fitView: (opts?: any) => void
): Promise<void> => {
  const gateway = getBackendGateway();
  if (!isBackendAvailable(gateway)) return;

  if (item.isAutosave) {
    let content = await gateway.getSetting(item.name);
    if (!content) {
      content = await gateway.getSetting('auto_saved_profile_content');
    }
    if (content) {
      try {
        const data = JSON.parse(content);
        const nodesWithStrings = mapProjectNodes(data.nodes || []);
        const edgesWithStrings = mapProjectEdges(data.edges || []);
        const hydratedNodes = hydrateNodes(nodesWithStrings, () => useFlowStore.getState());

        setCurrentSessionAutosaveKey(item.name);
        useFlowStore.setState({
          nodes: hydratedNodes,
          edges: edgesWithStrings,
          currentProject: null,
          lastActionId: `restore-save-${Date.now()}`,
          lastActionName: 'Restored Recent File',
        });
        onClose();
        setTimeout(() => fitView({ padding: 0.1, duration: 800 }), 50);
      } catch (err) {
        logger.error('[FileBackstage] Failed to restore recent autosave file', err);
      }
    }
  } else if (typeof item.id === 'number') {
    const res = await gateway.loadProject(item.id);
    if (res?.content) {
      try {
        const data = JSON.parse(res.content);
        const nodesWithStrings = mapProjectNodes(data.nodes);
        const edgesWithStrings = mapProjectEdges(data.edges);
        const hydratedNodes = hydrateNodes(nodesWithStrings, () => useFlowStore.getState());

        useFlowStore.setState({
          nodes: hydratedNodes,
          edges: edgesWithStrings,
          currentProject: { id: item.id, name: item.name },
          lastSavedSnapshot: res.content,
          lastActionId: `load-recent-${Date.now()}`,
          lastActionName: 'Load Recent Project',
        });
        onClose();
        setTimeout(() => fitView({ padding: 0.1, duration: 800 }), 50);
      } catch (err) {
        logger.error(`[FileBackstage] Failed to load recent project ${item.id}`, err);
      }
    }
  }
};

/**
 * Compute style classes for backstage tabs to avoid nested ternaries
 */
export const getBackstageTabClass = (
  tabName: BackstageTab,
  activeTab: BackstageTab,
  colorMode: 'dark' | 'light'
): string => {
  const isActive = activeTab === tabName;
  const isDark = colorMode === 'dark';

  if (isActive) {
    if (isDark) return "bg-blue-600 text-white";
    return "bg-white text-blue-900 font-extrabold shadow-md";
  }
  if (isDark) return "text-slate-300 hover:bg-slate-800/80";
  return "text-blue-100 hover:bg-white/10";
};

/**
 * Compute style classes for settings submenu items to avoid nested ternaries
 */
export const getSettingsSubmenuClass = (
  tabName: BackstageTab,
  activeTab: BackstageTab,
  colorMode: 'dark' | 'light'
): string => {
  const isActive = activeTab === tabName;
  const isDark = colorMode === 'dark';

  if (isActive) {
    if (isDark) return "bg-blue-600 text-white";
    return "bg-white text-blue-900 shadow-sm";
  }
  if (isDark) return "text-slate-400 hover:text-white";
  return "text-blue-100 hover:bg-white/10";
};

/**
 * Compute style classes for table row based on autosave and dark mode to avoid nested ternaries
 */
export const getTableRowClass = (isAutosave: boolean, isDark: boolean): string => {
  if (isAutosave) {
    if (isDark) return "backstage-table-row-autosave-dark";
    return "backstage-table-row-autosave-light";
  }
  if (isDark) return "backstage-table-row-normal-dark";
  return "backstage-table-row-normal-light";
};

/**
 * Compute style classes for backstage sidebar container
 */
export const getSidebarContainerClass = (isDark: boolean): string => {
  if (isDark) return "backstage-sidebar-dark";
  return "backstage-sidebar-light";
};

/**
 * Compute style classes for backstage back button
 */
export const getBackButtonClass = (isDark: boolean): string => {
  if (isDark) return "backstage-btn-back-dark";
  return "backstage-btn-back-light";
};

/**
 * Compute style classes for home item button
 */
export const getHomeItemClass = (activeTab: BackstageTab, isDark: boolean): string => {
  const base = "backstage-nav-btn";
  if (activeTab === 'home') {
    if (isDark) return `${base} backstage-item-active-dark`;
    return `${base} backstage-item-active-light`;
  }
  if (isDark) return `${base} backstage-item-inactive-dark`;
  return `${base} backstage-item-inactive-light`;
};

/**
 * Compute style classes for action buttons (Save, Import, Save As, Export)
 */
export const getActionButtonClass = (isDark: boolean): string => {
  const base = "backstage-nav-btn";
  if (isDark) return `${base} backstage-item-inactive-dark`;
  return `${base} backstage-item-inactive-light`;
};

/**
 * Compute style classes for Settings accordion trigger button
 */
export const getSettingsButtonClass = (activeTab: BackstageTab, isDark: boolean): string => {
  if (activeTab.startsWith('settings-')) {
    if (isDark) return "backstage-settings-active-dark";
    return "backstage-settings-active-light";
  }
  if (isDark) return "backstage-settings-inactive-dark";
  return "backstage-settings-inactive-light";
};

/**
 * Compute style classes for Settings submenu options
 */
export const getSubmenuItemClass = (isActive: boolean, isDark: boolean): string => {
  if (isActive) {
    if (isDark) return "backstage-submenu-active-dark";
    return "backstage-submenu-active-light";
  }
  if (isDark) return "backstage-submenu-inactive-dark";
  return "backstage-submenu-inactive-light";
};

/**
 * Compute style classes for Theme toggle button
 */
export const getThemeToggleClass = (isDark: boolean): string => {
  if (isDark) return "backstage-theme-toggle-dark";
  return "backstage-theme-toggle-light";
};

/**
 * Compute background class for Autosave toggle switch button
 */
export const getAutosaveSwitchBgClass = (isAutosaveEnabled: boolean, isDark: boolean): string => {
  if (isAutosaveEnabled) return "bg-emerald-500";
  if (isDark) return "bg-slate-700";
  return "bg-slate-300";
};

/**
 * Compute style classes for Save modal table row by delegating to getTableRowClass
 */
export const getSaveRowBgClass = (isAutosave: boolean, isDark: boolean): string => {
  return getTableRowClass(isAutosave, isDark);
};

/**
 * Determine active header profile name for Save Modal
 */
export const getHeaderProfileName = (
  currentProject: { name: string } | null,
  newProjectName: string
): string => {
  if (currentProject) return currentProject.name;
  if (newProjectName) return newProjectName;
  return 'Auto-Saved Profile';
};
