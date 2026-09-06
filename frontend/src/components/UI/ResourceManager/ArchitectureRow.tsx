import { Save, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface Project {
  id: number;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ArchitectureRowProps {
  p: Project;
  isActive: boolean;
  hasChanges: boolean;
  isCanvasEmpty: boolean;
  currentContent: string;
  confirmOverwriteId: number | null;
  setConfirmOverwriteId: (id: number | null) => void;
  onOverwrite: (id: number) => void;
  onUpdate: () => void;
  onLoad: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  colorMode: 'dark' | 'light';
}

export const ArchitectureRow = ({
  p,
  isActive,
  hasChanges,
  isCanvasEmpty,
  currentContent,
  confirmOverwriteId,
  setConfirmOverwriteId,
  onOverwrite,
  onUpdate,
  onLoad,
  onDelete,
  colorMode
}: ArchitectureRowProps) => {
  const isConfirming = confirmOverwriteId === p.id;

  const renderActions = () => {
    if (isConfirming) {
      return (
        <div className="flex items-center gap-2 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 shrink-0">
          <span className="text-[9px] font-black text-red-500 uppercase tracking-wider shrink-0">OVERWRITE?</span>
          <button type="button" onClick={() => onOverwrite(p.id)} className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 transition-colors shrink-0">YES</button>
          <button type="button" onClick={() => setConfirmOverwriteId(null)} className="text-[10px] font-black text-slate-500 hover:text-slate-400 transition-colors shrink-0">NO</button>
        </div>
      );
    }

    const deleteButton = (
      <button
        type="button"
        onClick={() => onDelete(p.id)}
        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors shrink-0"
        title="Delete project"
      >
        <Trash2 size={13} />
      </button>
    );

    if (isActive) {
      return (
        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && (
            <button
              type="button"
              onClick={onUpdate}
              className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors flex items-center gap-1 shadow shadow-emerald-950/20 shrink-0"
            >
              <Save size={12} /> Update
            </button>
          )}
          {deleteButton}
        </div>
      );
    }

    const showOverwrite = !isCanvasEmpty && p.content !== currentContent;

    return (
      <div className="flex items-center gap-2 shrink-0">
        {showOverwrite && (
          <button
            type="button"
            onClick={() => setConfirmOverwriteId(p.id)}
            className="px-2.5 py-1 text-[10px] font-bold text-amber-500 hover:bg-amber-500/10 rounded transition-colors border border-amber-500/20 shrink-0"
          >
            Overwrite
          </button>
        )}
        <button
          type="button"
          onClick={() => onLoad(p.id, p.name)}
          className="px-2.5 py-1 text-[10px] font-bold text-blue-500 hover:bg-blue-500/10 rounded transition-colors border border-blue-500/20 shrink-0"
        >
          Open
        </button>
        {deleteButton}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-all duration-150 hover:shadow-md min-w-0 gap-3",
        colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/80 hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300",
        isActive && (colorMode === 'dark' ? "border-blue-500 bg-blue-950/10" : "border-blue-300 bg-blue-50/20")
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-xs flex items-center gap-1.5 min-w-0">
          <span className="truncate flex-1" title={p.name}>{p.name}</span>
          {isActive && (
            <span className="text-[9px] bg-blue-500 text-white px-1 py-0.2 rounded uppercase tracking-wider font-bold shrink-0">Active</span>
          )}
        </div>
        <div className="text-[9px] text-slate-500 font-mono mt-0.5 shrink-0">
          {new Date(p.updatedAt * 1000).toLocaleString()}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {renderActions()}
      </div>
    </div>
  );
};
