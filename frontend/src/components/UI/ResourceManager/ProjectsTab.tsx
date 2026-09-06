import { Plus } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ArchitectureRow, Project } from './ArchitectureRow';

export interface ProjectsTabProps {
  projectName: string;
  setProjectName: (name: string) => void;
  handleSave: () => void;
  projects: Project[];
  currentProject: { id: number; name: string } | null;
  hasChanges: boolean;
  isCanvasEmpty: boolean;
  currentContent: string;
  confirmOverwriteId: number | null;
  setConfirmOverwriteId: (id: number | null) => void;
  handleOverwrite: (id: number) => void;
  handleUpdate: () => void;
  handleLoad: (id: number, name: string) => void;
  handleDelete: (id: number) => void;
  colorMode: 'dark' | 'light';
}

export const ProjectsTab = ({
  projectName,
  setProjectName,
  handleSave,
  projects,
  currentProject,
  hasChanges,
  isCanvasEmpty,
  currentContent,
  confirmOverwriteId,
  setConfirmOverwriteId,
  handleOverwrite,
  handleUpdate,
  handleLoad,
  handleDelete,
  colorMode
}: ProjectsTabProps) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Architecture Archives</h3>
      <p className="text-[10px] text-slate-500 leading-tight">Create, update, restore, or manage local Kubernetes system architectures.</p>
    </div>

    <div className={cn(
      "p-3 rounded-lg border flex gap-3 items-center",
      colorMode === 'dark' ? "bg-slate-950/20 border-slate-800" : "bg-slate-50 border-slate-200"
    )}>
      <div className="flex-1">
        <input
          type="text"
          placeholder="Enter new architecture name..."
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className={cn(
            "w-full px-3 py-1.5 text-xs outline-none rounded border focus:ring-1 focus:ring-blue-500/50",
            colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200"
          )}
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={!projectName.trim()}
        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/10 transition-all"
      >
        <Plus size={14} /> Save New
      </button>
    </div>

    <div className="space-y-2">
      {projects.length === 0 ? (
        <div className={cn("text-center py-12 rounded-xl border border-dashed", colorMode === 'dark' ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400")}>
          No saved architectures found
        </div>
      ) : (
        projects.map((p) => (
          <ArchitectureRow
            key={p.id}
            p={p}
            isActive={currentProject?.id === p.id}
            hasChanges={hasChanges}
            isCanvasEmpty={isCanvasEmpty}
            currentContent={currentContent}
            confirmOverwriteId={confirmOverwriteId}
            setConfirmOverwriteId={setConfirmOverwriteId}
            onOverwrite={handleOverwrite}
            onUpdate={handleUpdate}
            onLoad={handleLoad}
            onDelete={handleDelete}
            colorMode={colorMode}
          />
        ))
      )}
    </div>
  </div>
);
