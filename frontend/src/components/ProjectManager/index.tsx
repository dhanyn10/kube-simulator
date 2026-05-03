import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, X, Plus } from 'lucide-react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { hydrateNodes } from '../../store/nodeHelpers';

// @ts-ignore
import * as App from '../../../wailsjs/go/main/App';

interface Project {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectManager = ({ isOpen, onClose }: ProjectManagerProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState('');
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const loadProjects = async () => {
    // @ts-ignore
    if (window.go?.main?.App?.GetProjects) {
      // @ts-ignore
      const res = await window.go.main.App.GetProjects();
      setProjects(res || []);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const currentProject = useFlowStore((state) => state.currentProject);
  const lastSavedSnapshot = useFlowStore((state) => state.lastSavedSnapshot);
  const hasChanges = JSON.stringify({ nodes, edges }) !== lastSavedSnapshot;

  const handleUpdate = async () => {
    if (!currentProject) return;
    const content = JSON.stringify({ nodes, edges });
    // @ts-ignore
    if (window.go?.main?.App?.UpdateProject) {
      // @ts-ignore
      const success = await window.go.main.App.UpdateProject(currentProject.id, content);
      if (success) {
        useFlowStore.setState({ lastSavedSnapshot: content });
        loadProjects();
        onClose();
      }
    }
  };

  const handleSave = async () => {
    if (!projectName.trim()) return;
    const content = JSON.stringify({ nodes, edges });
    // @ts-ignore
    if (window.go?.main?.App?.SaveProject) {
      // @ts-ignore
      const id = await window.go.main.App.SaveProject(projectName, content);
      useFlowStore.setState({ 
        currentProject: { id, name: projectName },
        lastSavedSnapshot: content
      });
      setProjectName('');
      loadProjects();
    }
  };

  const handleLoad = async (id: number, name: string) => {
    // @ts-ignore
    if (window.go?.main?.App?.LoadProject) {
      // @ts-ignore
      const res = await window.go.main.App.LoadProject(id);
      if (res && res.content) {
        const data = JSON.parse(res.content);
        const hydratedNodes = hydrateNodes(data.nodes || [], () => useFlowStore.getState());
        useFlowStore.setState({
          nodes: hydratedNodes,
          edges: data.edges || [],
          currentProject: { id, name },
          lastSavedSnapshot: res.content
        });
        onClose();
      }
    }
  };

  const handleDelete = async (id: number) => {
    // @ts-ignore
    if (window.go?.main?.App?.DeleteProject) {
      // @ts-ignore
      await window.go.main.App.DeleteProject(id);
      if (currentProject?.id === id) {
        useFlowStore.setState({ currentProject: null, lastSavedSnapshot: null });
      }
      loadProjects();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className={cn(
          "w-[520px] max-h-[80vh] rounded-2xl border shadow-2xl flex flex-col",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="text-blue-500" size={20} />
            <h2 className="text-lg font-bold">Project Manager</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-500/10 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* New Project */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Save As New Project</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Project Name..."
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg border outline-none focus:ring-2",
                  colorMode === 'dark' ? "bg-slate-950 border-slate-800 focus:ring-blue-500/50" : "bg-slate-50 border-slate-200 focus:ring-blue-500/20"
                )}
              />
              <button
                onClick={handleSave}
                disabled={!projectName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-2 transition-all whitespace-nowrap"
              >
                <Plus size={16} />
                Save New
              </button>
            </div>
          </div>

          {/* Project List */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Saved Projects</label>
            <div className="grid gap-2">
              {projects.length === 0 ? (
                <div className={cn("text-center py-8 rounded-xl border border-dashed", colorMode === 'dark' ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400")}>
                  No projects found
                </div>
              ) : (
                projects.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-lg group",
                      colorMode === 'dark' ? "bg-slate-800/50 border-slate-700 hover:border-blue-500/50" : "bg-white border-slate-200 hover:border-blue-400",
                      currentProject?.id === p.id && (colorMode === 'dark' ? "ring-2 ring-blue-500 bg-slate-800" : "ring-2 ring-blue-400 bg-blue-50/30")
                    )}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        {p.name}
                        {currentProject?.id === p.id && (
                          <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter animate-pulse">Active</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {new Date(p.updatedAt * 1000).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentProject?.id === p.id ? (
                        hasChanges && (
                          <button
                            onClick={handleUpdate}
                            className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-900/20"
                          >
                            <Save size={14} />
                            Update Data
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleLoad(p.id, p.name)}
                          className="px-3 py-1.5 text-xs font-bold text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors border border-blue-500/20"
                        >
                          Open
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-slate-500/5">
          <p className="text-[10px] text-center text-slate-500 font-medium">
            Projects are stored locally in your SQLite database.
          </p>
        </div>
      </div>
    </div>
  );
};
