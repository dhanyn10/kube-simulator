import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Home,
  Save,
  FilePlus,
  Upload,
  FileCode,
  Sliders,
  Eye,
  Grid,
  Folder,
  Clock,
  FileText,
  Check,
  Sun,
  Moon,
  RotateCcw,
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { mapProjectNodes, mapProjectEdges } from '../UI/ResourceManager/resourceManagerHelpers';
import { hydrateNodes } from '../../store/nodeHelpers';
import { useFitView } from '../../hooks/useFitView';
import { formatAutosaveKey } from '../../store/useFlowStore';
import { ColorPalette } from '../UI/ColorPalette';
import { WindowControls } from './WindowControls';

export interface FileBackstageViewProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaveAs: () => void;
  readonly onImportFile: () => void;
  readonly onExportYaml: () => void;
}

interface RecentFileItem {
  id: number | string;
  name: string;
  location: string;
  fullPath: string;
  updatedAt: string;
  isAutosave?: boolean;
}

type BackstageTab = 'home' | 'settings-view' | 'settings-canvas';

/**
 * Format a raw date/timestamp string or number to DD/MM/YYYY HH:mm:ss
 */
const formatDateModified = (val?: string | number): string => {
  if (!val) return new Date().toLocaleString('en-GB');
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
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
 * MS Word 2021 Style Fullscreen File Backstage View
 */
export const FileBackstageView = ({
  isOpen,
  onClose,
  onSaveAs,
  onImportFile,
  onExportYaml,
}: FileBackstageViewProps) => {
  const fitView = useFitView();
  const colorMode = useFlowStore((state) => state.colorMode);
  const toggleColorMode = useFlowStore((state) => state.toggleColorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const currentProject = useFlowStore((state) => state.currentProject);

  // Settings store hooks
  const isSidebarVisible = useFlowStore((state) => state.isSidebarVisible);
  const isRightSidebarVisible = useFlowStore((state) => state.isRightSidebarVisible);
  const isMonitoringOpen = useFlowStore((state) => state.isMonitoringOpen);
  const isAutofocusEnabled = useFlowStore((state) => state.isAutofocusEnabled);

  const setSidebarVisible = useFlowStore((state) => state.setSidebarVisible);
  const setRightSidebarVisible = useFlowStore((state) => state.setRightSidebarVisible);
  const setMonitoringOpen = useFlowStore((state) => state.setMonitoringOpen);
  const toggleAutofocus = useFlowStore((state) => state.toggleAutofocus);

  const canvasBgVariant = useFlowStore((state) => state.canvasBgVariant);
  const canvasBgColor = useFlowStore((state) => state.canvasBgColor);
  const canvasBgOpacity = useFlowStore((state) => state.canvasBgOpacity);

  const setCanvasBgVariant = useFlowStore((state) => state.setCanvasBgVariant);
  const setCanvasBgColor = useFlowStore((state) => state.setCanvasBgColor);
  const setCanvasBgOpacity = useFlowStore((state) => state.setCanvasBgOpacity);

  const [activeTab, setActiveTab] = useState<BackstageTab>('home');
  const [isSettingsExpanded, setIsSettingsExpanded] = useState<boolean>(true);

  // Save / Home tab states
  const [newProjectName, setNewProjectName] = useState('');
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([]);
  const [activeLocation, setActiveLocation] = useState<string>('~/.kube-simulator/app_settings_json');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: RecentFileItem | null } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const isCanvasEmpty = nodes.length === 0;

  const loadRecentFiles = async () => {
    const items: RecentFileItem[] = [];
    const app = globalThis.go?.main?.App;

    // Fetch latest auto-saved profile
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

    // Fetch saved projects
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

    setRecentFiles(items);
  };

  useEffect(() => {
    if (!isOpen) return;
    loadRecentFiles();

    const currentKey = formatAutosaveKey(new Date());

    if (currentProject) {
      setActiveLocation(`~/.kube-simulator/projects/${currentProject.id}/architecture.infra`);
      setNewProjectName(currentProject.name);
    } else {
      setActiveLocation(`~/.kube-simulator/autosaves/${currentKey}.infra`);
      setNewProjectName(currentKey);
    }
  }, [isOpen, currentProject]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      globalThis.addEventListener('click', handleClickOutside);
      globalThis.addEventListener('contextmenu', handleClickOutside);
    }
    return () => {
      globalThis.removeEventListener('click', handleClickOutside);
      globalThis.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [contextMenu]);

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleRowContextMenu = (e: React.MouseEvent, item: RecentFileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  // Directly update current active project / profile
  const handleQuickSaveCurrent = async () => {
    const content = JSON.stringify({ nodes, edges });
    const app = globalThis.go?.main?.App;

    if (currentProject && currentProject.id !== -1 && app?.UpdateProject) {
      const success = await app.UpdateProject(currentProject.id, content);
      if (success) {
        useFlowStore.setState({ lastSavedSnapshot: content });
        await loadRecentFiles();
        onClose();
        return;
      }
    }

    const saveName = newProjectName.trim() || formatAutosaveKey(new Date());
    if (app?.SaveProject) {
      const id = await app.SaveProject(saveName, content);
      if (id !== undefined) {
        useFlowStore.setState({
          currentProject: { id, name: saveName },
          lastSavedSnapshot: content,
        });
        await loadRecentFiles();
        onClose();
      }
    }
  };

  const handleRestoreFile = async (item: RecentFileItem) => {
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

  if (!isOpen) return null;

  const activeBtnClass = "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/10 border-blue-600";
  const inactiveBtnClass = colorMode === 'dark'
    ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"
    : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700";

  return (
    <div
      data-testid="file-backstage-view"
      className={cn(
        "fixed inset-0 z-[200] flex font-sans animate-in fade-in zoom-in-95 duration-150 select-none",
        colorMode === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      )}
    >
      {/* OS Window Controls - Positioned at top right edge of application window */}
      <div className="absolute top-0 right-0 z-50">
        <WindowControls colorMode={colorMode} />
      </div>

      {/* MS Word Left Sidebar */}
      <div className={cn(
        "w-64 border-r flex flex-col shrink-0 shadow-lg",
        colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-blue-900 text-white border-blue-800"
      )}>
        {/* Back Button (← Arrow) */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            data-testid="file-backstage-back-btn"
            className={cn(
              "p-2.5 rounded-full transition-colors flex items-center justify-center cursor-pointer",
              colorMode === 'dark'
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                : "bg-white/20 hover:bg-white/30 text-white"
            )}
            title="Return to Canvas (Esc)"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-extrabold text-sm tracking-wide uppercase">File Menu</h2>
            <p className="text-[10px] opacity-70 font-medium">Kube Simulator</p>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          {/* Home Item (contains Recent Files & Profiles) */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={cn(
              "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer",
              activeTab === 'home'
                ? colorMode === 'dark' ? "bg-blue-600 text-white" : "bg-white text-blue-900 font-extrabold shadow-md"
                : colorMode === 'dark' ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
            )}
          >
            <Home size={16} />
            <span>Home</span>
          </button>

          {/* Direct Save Action (Updates current active profile) */}
          <button
            type="button"
            onClick={handleQuickSaveCurrent}
            disabled={isCanvasEmpty}
            className={cn(
              "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer disabled:opacity-50",
              colorMode === 'dark' ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
            )}
          >
            <Save size={16} />
            <span>Save</span>
          </button>

          {/* Save As... Item */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSaveAs();
            }}
            className={cn(
              "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer",
              colorMode === 'dark' ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
            )}
          >
            <FilePlus size={16} />
            <span>Save As...</span>
          </button>

          {/* Import Item */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onImportFile();
            }}
            className={cn(
              "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer",
              colorMode === 'dark' ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
            )}
          >
            <Upload size={16} />
            <span>Import</span>
          </button>

          {/* Export YAML Item */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onExportYaml();
            }}
            className={cn(
              "w-full px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-left cursor-pointer",
              colorMode === 'dark' ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
            )}
          >
            <FileCode size={16} />
            <span>Export YAML</span>
          </button>

          <div className={cn("my-2 border-t", colorMode === 'dark' ? "border-slate-800" : "border-white/15")} />

          {/* Settings Section with Submenus */}
          <div>
            <button
              type="button"
              onClick={() => {
                setIsSettingsExpanded(!isSettingsExpanded);
                if (activeTab === 'home') {
                  setActiveTab('settings-view');
                }
              }}
              className={cn(
                "w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer",
                activeTab.startsWith('settings-')
                  ? colorMode === 'dark' ? "bg-slate-800 text-blue-400" : "bg-white/20 text-white"
                  : colorMode === 'dark' ? "text-slate-300 hover:bg-slate-800/80" : "text-blue-100 hover:bg-white/10"
              )}
            >
              <div className="flex items-center gap-3">
                <Sliders size={16} />
                <span>Settings</span>
              </div>
              {isSettingsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {/* Submenu Items */}
            {isSettingsExpanded && (
              <div className="ml-5 mt-1 pl-2 border-l border-white/20 space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('settings-view')}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all text-left cursor-pointer",
                    activeTab === 'settings-view'
                      ? colorMode === 'dark' ? "bg-blue-600 text-white" : "bg-white text-blue-900 shadow-sm"
                      : colorMode === 'dark' ? "text-slate-400 hover:text-white" : "text-blue-100 hover:bg-white/10"
                  )}
                >
                  <Eye size={14} />
                  <span>View & Layout</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('settings-canvas')}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all text-left cursor-pointer",
                    activeTab === 'settings-canvas'
                      ? colorMode === 'dark' ? "bg-blue-600 text-white" : "bg-white text-blue-900 shadow-sm"
                      : colorMode === 'dark' ? "text-slate-400 hover:text-white" : "text-blue-100 hover:bg-white/10"
                  )}
                >
                  <Grid size={14} />
                  <span>Canvas Grid</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer Theme Toggle */}
        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={toggleColorMode}
            className={cn(
              "w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer",
              colorMode === 'dark' ? "bg-slate-800 text-amber-400 hover:bg-slate-700" : "bg-white/20 text-white hover:bg-white/30"
            )}
          >
            <span className="flex items-center gap-2">
              {colorMode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>Theme Mode</span>
            </span>
            <span className="uppercase text-[10px] font-extrabold opacity-80">{colorMode}</span>
          </button>
        </div>
      </div>

      {/* Main Backstage Content Panel */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        <div className="max-w-4xl mx-auto space-y-6 pt-2">

          {/* TAB 1: HOME & RECENT FILES */}
          {activeTab === 'home' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight">Home & Recent Profiles</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Quickly restore recent architecture files and auto-saved profiles</p>
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                  <Home size={24} />
                </div>
              </div>

              {/* Current Active Profile Header */}
              <div className={cn(
                "p-4 rounded-2xl border flex items-center justify-between shadow-xs",
                colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              )}>
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                    <Folder size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold tracking-tight font-mono">
                      {currentProject ? currentProject.name : (newProjectName || 'Auto-Saved Profile')}
                    </div>
                    <p
                      title={activeLocation}
                      className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5 cursor-help"
                    >
                      <span>Location:</span>
                      <span className="text-blue-500 font-bold truncate max-w-[480px]">{activeLocation}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Date Modified</span>
                  <span className="text-xs font-mono font-medium">{formatDateModified(Date.now())}</span>
                </div>
              </div>

              {/* Save Input Row */}
              <div className="space-y-2">
                <label className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
                  Active Profile Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter project/architecture name..."
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className={cn(
                      "flex-1 px-4 py-2.5 text-xs outline-none rounded-xl border font-medium transition-all",
                      colorMode === 'dark'
                        ? "bg-slate-900 border-slate-800 text-slate-200 focus:border-blue-500"
                        : "bg-white border-slate-200 text-slate-800 focus:border-blue-400"
                    )}
                  />
                  <button
                    type="button"
                    onClick={handleQuickSaveCurrent}
                    disabled={isCanvasEmpty}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-900/10 transition-all cursor-pointer"
                  >
                    <Save size={15} /> Save Active Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSaveAs();
                    }}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer",
                      colorMode === 'dark'
                        ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                        : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                    )}
                  >
                    <FilePlus size={15} /> Save As File...
                  </button>
                </div>
              </div>

              {/* Recent Files Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                    Recent Files & Auto-Saved Profiles
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">Right-click profile for context options</span>
                </div>

                <div className={cn(
                  "overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border custom-scrollbar",
                  colorMode === 'dark' ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"
                )}>
                  <table className="w-full text-left border-collapse">
                    <thead className={cn(
                      "sticky top-0 text-[10px] uppercase font-bold tracking-wider select-none z-10 border-b",
                      colorMode === 'dark' ? "bg-slate-900 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-500 border-slate-200"
                    )}>
                      <tr>
                        <th className="py-3 px-4">Name & Location</th>
                        <th className="py-3 px-4 text-right">Date Modified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs font-medium">
                      {recentFiles.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-center py-10 text-slate-500">
                            No recent files or auto-saved profiles found
                          </td>
                        </tr>
                      ) : (
                        recentFiles.map((file) => (
                          <tr
                            key={String(file.id)}
                            onContextMenu={(e) => handleRowContextMenu(e, file)}
                            onDoubleClick={() => handleRestoreFile(file)}
                            className={cn(
                              "transition-colors cursor-pointer select-none",
                              file.isAutosave
                                ? colorMode === 'dark' ? "bg-blue-950/20 hover:bg-blue-900/30" : "bg-blue-50/40 hover:bg-blue-100/50"
                                : colorMode === 'dark' ? "hover:bg-slate-800/50" : "hover:bg-slate-100/70"
                            )}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "p-2 rounded-lg shrink-0 mt-0.5",
                                  file.isAutosave ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                                )}>
                                  {file.isAutosave ? <Clock size={16} /> : <FileText size={16} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold truncate max-w-[320px]">{file.name}</span>
                                    {file.isAutosave && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                        Auto-Save
                                      </span>
                                    )}
                                    {currentProject?.id === file.id && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                                        <Check size={9} /> Active
                                      </span>
                                    )}
                                  </div>
                                  <div className={cn(
                                    "mt-1 px-2 py-0.5 rounded border inline-flex items-center gap-1.5 text-[10px] font-mono max-w-full",
                                    colorMode === 'dark'
                                      ? "bg-slate-950 border-slate-800 text-slate-400"
                                      : "bg-slate-100 border-slate-200 text-slate-600"
                                  )}>
                                    <span className="opacity-60 font-semibold shrink-0">Location:</span>
                                    <span title={file.fullPath} className="truncate hover:text-blue-400 cursor-help">
                                      {file.location}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right text-xs font-mono text-slate-400 align-top pt-3.5">
                              {file.updatedAt}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SETTINGS - VIEW */}
          {activeTab === 'settings-view' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight">View & Layout Settings</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Toggle panels, sidebars, and autofocus behaviors</p>
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                  <Eye size={24} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Toggle Components */}
                <label className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none",
                  colorMode === 'dark' ? "bg-slate-900 border-slate-800 hover:bg-slate-800/60" : "bg-white border-slate-200 hover:bg-slate-50"
                )}>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Components Sidebar</span>
                    <span className="text-xs opacity-60">Show left resource palette</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSidebarVisible}
                    onChange={() => setSidebarVisible(!isSidebarVisible)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                {/* Toggle Utilities */}
                <label className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none",
                  colorMode === 'dark' ? "bg-slate-900 border-slate-800 hover:bg-slate-800/60" : "bg-white border-slate-200 hover:bg-slate-50"
                )}>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Utilities Sidebar</span>
                    <span className="text-xs opacity-60">Show right configuration panel</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isRightSidebarVisible}
                    onChange={() => setRightSidebarVisible(!isRightSidebarVisible)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                {/* Toggle Simulation */}
                <label className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none",
                  colorMode === 'dark' ? "bg-slate-900 border-slate-800 hover:bg-slate-800/60" : "bg-white border-slate-200 hover:bg-slate-50"
                )}>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Simulation Panel</span>
                    <span className="text-xs opacity-60">Show monitoring graph & telemetry</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isMonitoringOpen}
                    onChange={() => setMonitoringOpen(!isMonitoringOpen)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                {/* Toggle Autofocus */}
                <label className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all select-none",
                  colorMode === 'dark' ? "bg-slate-900 border-slate-800 hover:bg-slate-800/60" : "bg-white border-slate-200 hover:bg-slate-50"
                )}>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Autofocus</span>
                    <span className="text-xs opacity-60">Auto zoom on node selection</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isAutofocusEnabled}
                    onChange={() => toggleAutofocus()}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: SETTINGS - CANVAS */}
          {activeTab === 'settings-canvas' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight">Canvas Grid Customization</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Customize background patterns, dot/line colors, and grid opacity</p>
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                  <Grid size={24} />
                </div>
              </div>

              {/* Background Pattern */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block">Background Pattern</span>
                <div className="flex gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={() => setCanvasBgVariant('dots')}
                    className={cn(
                      "flex-1 py-3 px-5 rounded-2xl border text-xs font-bold transition-all cursor-pointer",
                      canvasBgVariant === 'dots' ? activeBtnClass : inactiveBtnClass
                    )}
                  >
                    Dots Pattern
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasBgVariant('lines')}
                    className={cn(
                      "flex-1 py-3 px-5 rounded-2xl border text-xs font-bold transition-all cursor-pointer",
                      canvasBgVariant === 'lines' ? activeBtnClass : inactiveBtnClass
                    )}
                  >
                    Lines Grid
                  </button>
                </div>
              </div>

              {/* Color Controls */}
              <div className="space-y-3">
                <div className="flex items-center justify-between max-w-md">
                  <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Grid / Dot Color</span>
                  {canvasBgColor !== 'default' && (
                    <button
                      type="button"
                      onClick={() => setCanvasBgColor('default')}
                      className="text-xs font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={12} /> Reset Color
                    </button>
                  )}
                </div>

                <ColorPalette
                  selectedColor={canvasBgColor}
                  onSelect={setCanvasBgColor}
                  className="max-w-md"
                />
              </div>

              {/* Opacity Control */}
              <div className="space-y-3 max-w-md">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase text-slate-400 tracking-wider">Opacity / Intensity</span>
                  <span className="font-extrabold text-blue-500">{Math.round(canvasBgOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={canvasBgOpacity}
                  onChange={(e) => setCanvasBgOpacity(Number.parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Profile Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className={cn(
            "fixed z-[250] min-w-[180px] py-1.5 rounded-xl border shadow-2xl text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100",
            colorMode === 'dark'
              ? "bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/50"
              : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50"
          )}
        >
          <button
            type="button"
            onClick={() => {
              toggleColorMode();
              setContextMenu(null);
            }}
            className={cn(
              "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors cursor-pointer",
              colorMode === 'dark' ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
            )}
          >
            {colorMode === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600" />}
            <span>Change Theme</span>
          </button>

          {contextMenu.item && (
            <button
              type="button"
              onClick={() => {
                const targetItem = contextMenu.item;
                setContextMenu(null);
                if (targetItem) handleRestoreFile(targetItem);
              }}
              className={cn(
                "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors text-blue-500 hover:text-blue-400 cursor-pointer",
                colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-100"
              )}
            >
              <RotateCcw size={15} />
              <span>Load Profile</span>
            </button>
          )}

          <div className={cn("my-1 border-t", colorMode === 'dark' ? "border-slate-800" : "border-slate-100")} />

          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onClose();
            }}
            className={cn(
              "w-full px-3.5 py-2 text-left flex items-center gap-2.5 font-medium transition-colors text-rose-500 hover:text-rose-400 cursor-pointer",
              colorMode === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-100"
            )}
          >
            <X size={15} />
            <span>Close File Menu</span>
          </button>
        </div>
      )}
    </div>
  );
};
