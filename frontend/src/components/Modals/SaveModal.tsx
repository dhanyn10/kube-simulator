import React, { useState, useEffect } from 'react';
import { Save, Folder, Clock, FileText, Check, FilePlus } from 'lucide-react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { Modal } from './Modal';
import { generateTimestampedProjectName, mapProjectNodes, mapProjectEdges } from '../UI/ResourceManager/resourceManagerHelpers';
import { hydrateNodes } from '../../store/nodeHelpers';
import { useFitView } from '../../hooks/useFitView';

export interface SaveModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaveAs: () => void;
}

interface RecentFileItem {
  id: number | string;
  name: string;
  location: string;
  updatedAt: string;
  isAutosave?: boolean;
}

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

export const SaveModal = ({ isOpen, onClose, onSaveAs }: SaveModalProps) => {
  const fitView = useFitView();
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const currentProject = useFlowStore((state) => state.currentProject);

  const [newProjectName, setNewProjectName] = useState('');
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([]);
  const [activeLocation, setActiveLocation] = useState<string>('Local Storage (.kube-simulator)');

  const isCanvasEmpty = nodes.length === 0;

  const loadRecentFiles = async () => {
    const items: RecentFileItem[] = [];
    const app = globalThis.go?.main?.App;

    // 1. Fetch latest auto-saved profile from settings
    if (app?.GetSetting) {
      const latestAutosaveKey = await app.GetSetting('auto_saved_profile_latest');
      const latestAutosaveContent = await app.GetSetting('auto_saved_profile_content');

      if (latestAutosaveKey && latestAutosaveContent) {
        try {
          const parsed = JSON.parse(latestAutosaveContent);
          items.push({
            id: 'autosave-latest',
            name: latestAutosaveKey,
            location: '.kube-simulator/app_settings_json',
            updatedAt: formatDateModified(parsed.timestamp || Date.now()),
            isAutosave: true,
          });
        } catch {
          items.push({
            id: 'autosave-latest',
            name: latestAutosaveKey,
            location: '.kube-simulator/app_settings_json',
            updatedAt: formatDateModified(Date.now()),
            isAutosave: true,
          });
        }
      }
    }

    // 2. Fetch saved projects from SQLite/Badger DB
    if (app?.GetProjects) {
      const projects = await app.GetProjects();
      if (Array.isArray(projects)) {
        projects.forEach((p: any) => {
          items.push({
            id: p.id,
            name: p.name,
            location: `.kube-simulator/projects/${p.id}`,
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

    if (currentProject) {
      setActiveLocation(`.kube-simulator/projects/${currentProject.id}`);
      setNewProjectName(currentProject.name);
    } else {
      setActiveLocation('Local Storage (.kube-simulator)');
      setNewProjectName(generateTimestampedProjectName());
    }
  }, [isOpen, currentProject]);

  const handleQuickSaveCurrent = async () => {
    const content = JSON.stringify({ nodes, edges });
    const app = globalThis.go?.main?.App;

    if (currentProject && currentProject.id !== -1 && app?.UpdateProject) {
      const success = await app.UpdateProject(currentProject.id, content);
      if (success) {
        useFlowStore.setState({ lastSavedSnapshot: content });
        loadRecentFiles();
        onClose();
        return;
      }
    }

    // Save as new project
    if (newProjectName.trim() && app?.SaveProject) {
      const id = await app.SaveProject(newProjectName.trim(), content);
      if (id !== undefined) {
        useFlowStore.setState({
          currentProject: { id, name: newProjectName.trim() },
          lastSavedSnapshot: content,
        });
        loadRecentFiles();
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save Architecture & Recent Files"
      icon={Save}
      widthClass="w-[720px]"
      maxHeightClass="h-[75vh]"
    >
      <div className="space-y-5 p-1 font-sans">
        {/* Current Location & Status Header */}
        <div className={cn(
          "p-3.5 rounded-xl border flex items-center justify-between",
          colorMode === 'dark' ? "bg-slate-900/90 border-slate-800" : "bg-slate-50 border-slate-200"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <Folder size={18} />
            </div>
            <div>
              <div className="text-xs font-bold tracking-tight text-slate-200">
                {currentProject ? currentProject.name : 'Unsaved Session Architecture'}
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                <span>Location:</span>
                <span className="text-blue-400 font-bold">{activeLocation}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Date Modified</span>
            <span className="text-[11px] font-mono font-medium text-slate-300">{formatDateModified(Date.now())}</span>
          </div>
        </div>

        {/* Quick Save / Name Input */}
        <div className="space-y-2">
          <label className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
            Save Current Architecture
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter architecture name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className={cn(
                "flex-1 px-3 py-2 text-xs outline-none rounded-lg border font-medium transition-all",
                colorMode === 'dark'
                  ? "bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500"
                  : "bg-white border-slate-200 text-slate-800 focus:border-blue-400"
              )}
            />
            <button
              type="button"
              onClick={handleQuickSaveCurrent}
              disabled={isCanvasEmpty || !newProjectName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/10 transition-all"
            >
              <Save size={14} /> Save
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSaveAs();
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all",
                colorMode === 'dark'
                  ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
              )}
            >
              <FilePlus size={14} /> Save As...
            </button>
          </div>
        </div>

        {/* Recent Files & Auto-Saved Profiles List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              Recent Files & Auto-Saved Profiles
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">MS Word Style Recent Files</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
            {recentFiles.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6 border border-dashed rounded-lg">
                No recent files or auto-saved profiles found
              </p>
            ) : (
              recentFiles.map((file) => (
                <div
                  key={String(file.id)}
                  className={cn(
                    "p-3 rounded-xl border flex items-center justify-between transition-all",
                    file.isAutosave
                      ? colorMode === 'dark' ? "bg-blue-950/20 border-blue-800/50" : "bg-blue-50/50 border-blue-200"
                      : colorMode === 'dark' ? "bg-slate-900/60 border-slate-800 hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      file.isAutosave ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {file.isAutosave ? <Clock size={16} /> : <FileText size={16} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{file.name}</span>
                        {file.isAutosave && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Auto-Save Profile
                          </span>
                        )}
                        {currentProject?.id === file.id && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Check size={10} /> Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>Path: {file.location}</span>
                        <span>•</span>
                        <span>Date Modified: {file.updatedAt}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestoreFile(file)}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow transition-colors"
                  >
                    {file.isAutosave ? 'Restore' : 'Open'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
