import { useFlowStore } from '@/store';
import { mapProjectNodes, mapProjectEdges } from '@/components/UI/ResourceManager/resourceManagerHelpers';
import { hydrateNodes } from '@/store/nodeHelpers';

export type BackstageTab = 'home' | 'settings-view' | 'settings-canvas';

export interface RecentFileItem {
  readonly id: number | string;
  readonly name: string;
  readonly location: string;
  readonly fullPath: string;
  readonly updatedAt: string;
  readonly isAutosave?: boolean;
}

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

/**
 * Load recent projects and auto-saved profiles from Wails backend
 */
export const fetchRecentFiles = async (): Promise<RecentFileItem[]> => {
  const items: RecentFileItem[] = [];
  const app = globalThis.go?.main?.App;

  if (app?.GetSetting) {
    const latestAutosaveKey = await app.GetSetting('auto_saved_profile_latest');
    const latestAutosaveContent = await app.GetSetting('auto_saved_profile_content');

    if (latestAutosaveKey && latestAutosaveContent) {
      let ts = Date.now();
      try {
        const parsed = JSON.parse(latestAutosaveContent);
        if (parsed.timestamp) ts = parsed.timestamp;
      } catch {
        // fallback
      }
      const autosavePath = `~/.kube-simulator/autosaves/${latestAutosaveKey}.infra`;
      items.push({
        id: 'autosave-latest',
        name: latestAutosaveKey,
        location: autosavePath,
        fullPath: autosavePath,
        updatedAt: formatDateModified(ts),
        isAutosave: true,
      });
    }
  }

  if (app?.GetProjects) {
    const projects = await app.GetProjects();
    if (Array.isArray(projects)) {
      projects.forEach((p: any) => {
        const relativePath = `.kube-simulator/projects/${p.id}`;
        const fullPath = `~/.kube-simulator/projects/${p.id}/architecture.infra`;
        items.push({
          id: p.id,
          name: p.name,
          location: relativePath,
          fullPath,
          updatedAt: formatDateModified(p.updated_at || p.created_at || Date.now()),
        });
      });
    }
  }

  return items;
};

/**
 * Execute restore operation for selected recent file item
 */
export const restoreRecentFile = async (
  item: RecentFileItem,
  onClose: () => void,
  fitView: (opts?: any) => void
): Promise<void> => {
  const app = globalThis.go?.main?.App;
  if (!app) return;

  if (item.isAutosave) {
    const content = await app.GetSetting('auto_saved_profile_content');
    if (content) {
      try {
        const data = JSON.parse(content);
        const nodesWithStrings = mapProjectNodes(data.nodes);
        const edgesWithStrings = mapProjectEdges(data.edges);
        const hydratedNodes = hydrateNodes(nodesWithStrings, () => useFlowStore.getState());

        useFlowStore.setState({
          nodes: hydratedNodes,
          edges: edgesWithStrings,
          lastActionId: `restore-save-${Date.now()}`,
          lastActionName: 'Restored Recent File',
        });
        onClose();
        setTimeout(() => fitView({ padding: 0.1, duration: 800 }), 50);
      } catch {
        // ignore error
      }
    }
  } else if (typeof item.id === 'number') {
    const res = await app.LoadProject(item.id);
    if (res?.content) {
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
    if (isDark) return "bg-blue-950/20 hover:bg-blue-900/30";
    return "bg-blue-50/40 hover:bg-blue-100/50";
  }
  if (isDark) return "hover:bg-slate-800/50";
  return "hover:bg-slate-100/70";
};

/**
 * Compute style classes for backstage sidebar container
 */
export const getSidebarContainerClass = (isDark: boolean): string => {
  if (isDark) return "w-64 border-r flex flex-col shrink-0 shadow-lg select-none bg-slate-900 border-slate-800";
  return "w-64 border-r flex flex-col shrink-0 shadow-lg select-none bg-blue-900 text-white border-blue-800";
};

/**
 * Compute style classes for backstage back button
 */
export const getBackButtonClass = (isDark: boolean): string => {
  if (isDark) return "p-2.5 rounded-full transition-colors flex items-center justify-center cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200";
  return "p-2.5 rounded-full transition-colors flex items-center justify-center cursor-pointer bg-white/20 hover:bg-white/30 text-white";
};

/**
 * Compute style classes for home item button
 */
export const getHomeItemClass = (activeTab: BackstageTab, isDark: boolean): string => {
  if (activeTab === 'home') {
    if (isDark) return "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer bg-blue-600 text-white";
    return "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer bg-white text-blue-900 font-extrabold shadow-md";
  }
  if (isDark) return "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer text-slate-300 hover:bg-slate-800/80";
  return "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer text-blue-100 hover:bg-white/10";
};

/**
 * Compute style classes for action buttons (Save, Import, Save As, Export)
 */
export const getActionButtonClass = (isDark: boolean): string => {
  if (isDark) return "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer disabled:opacity-50 text-slate-300 hover:bg-slate-800/80";
  return "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer disabled:opacity-50 text-blue-100 hover:bg-white/10";
};

/**
 * Compute style classes for Settings accordion trigger button
 */
export const getSettingsButtonClass = (activeTab: BackstageTab, isDark: boolean): string => {
  if (activeTab.startsWith('settings-')) {
    if (isDark) return "w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer bg-slate-800 text-blue-400";
    return "w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer bg-white/20 text-white";
  }
  if (isDark) return "w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer text-slate-300 hover:bg-slate-800/80";
  return "w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer text-blue-100 hover:bg-white/10";
};

/**
 * Compute style classes for Settings submenu options
 */
export const getSubmenuItemClass = (isActive: boolean, isDark: boolean): string => {
  if (isActive) {
    if (isDark) return "w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all text-left cursor-pointer bg-blue-600 text-white";
    return "w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all text-left cursor-pointer bg-white text-blue-900 shadow-sm";
  }
  if (isDark) return "w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all text-left cursor-pointer text-slate-400 hover:text-white";
  return "w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all text-left cursor-pointer text-blue-100 hover:bg-white/10";
};

/**
 * Compute style classes for Theme toggle button
 */
export const getThemeToggleClass = (isDark: boolean): string => {
  if (isDark) return "w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer bg-slate-800 text-amber-400 hover:bg-slate-700";
  return "w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer bg-white/20 text-white hover:bg-white/30";
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
 * Compute style classes for Save modal table row
 */
export const getSaveRowBgClass = (isAutosave: boolean, isDark: boolean): string => {
  if (isAutosave) {
    if (isDark) return "bg-blue-950/20 hover:bg-blue-900/30";
    return "bg-blue-50/40 hover:bg-blue-100/50";
  }
  if (isDark) return "hover:bg-slate-800/50";
  return "hover:bg-slate-100/70";
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
