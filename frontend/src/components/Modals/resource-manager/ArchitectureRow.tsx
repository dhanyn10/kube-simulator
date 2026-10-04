import { Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Project {
  id: number;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ArchitectureRowProps {
  p?: Project;
  proj?: Project;
  isActive?: boolean;
  isLoaded?: boolean;
  isSelected?: boolean;
  hasChanges?: boolean;
  isCanvasEmpty?: boolean;
  currentContent?: string;
  confirmOverwriteId?: number | null;
  setConfirmOverwriteId?: (id: number | null) => void;
  onOverwrite?: (id: number) => void;
  onUpdate?: () => void;
  onLoad?: (id: number, name: string) => void;
  onDelete?: (id: number) => void;
  onSelect?: () => void;
  colorMode: 'dark' | 'light';
}

export const ArchitectureRow = (props: ArchitectureRowProps) => {
  const project = props.p || props.proj;
  if (!project) return null;

  const isActive = props.isActive ?? props.isLoaded ?? false;
  const isSelected = props.isSelected ?? false;
  const hasChanges = props.hasChanges ?? false;
  const isCanvasEmpty = props.isCanvasEmpty ?? false;
  const currentContent = props.currentContent ?? '';
  const confirmOverwriteId = props.confirmOverwriteId ?? null;
  const colorMode = props.colorMode;

  const isConfirming = confirmOverwriteId === project.id;

  const renderActions = () => {
    if (isConfirming) {
      return (
        <div className="flex items-center gap-2 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 shrink-0">
          <span className="text-[9px] font-black text-red-500 uppercase tracking-wider shrink-0">OVERWRITE?</span>
          <button type="button" onClick={() => props.onOverwrite?.(project.id)} className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 transition-colors shrink-0 cursor-pointer">YES</button>
          <button type="button" onClick={() => props.setConfirmOverwriteId?.(null)} className="text-[10px] font-black text-slate-500 hover:text-slate-400 transition-colors shrink-0 cursor-pointer">NO</button>
        </div>
      );
    }

    const deleteButton = props.onDelete ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          props.onDelete?.(project.id);
        }}
        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors shrink-0 cursor-pointer"
        title="Delete project"
      >
        <Trash2 size={13} />
      </button>
    ) : null;

    if (isActive) {
      return (
        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && props.onUpdate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onUpdate?.();
              }}
              className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors flex items-center gap-1 shadow shadow-emerald-950/20 shrink-0 cursor-pointer"
            >
              <Save size={12} /> Update
            </button>
          )}
          {deleteButton}
        </div>
      );
    }

    const showOverwrite = !isCanvasEmpty && project.content !== currentContent && props.setConfirmOverwriteId;

    return (
      <div className="flex items-center gap-2 shrink-0">
        {showOverwrite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.setConfirmOverwriteId?.(project.id);
            }}
            className="px-2.5 py-1 text-[10px] font-bold text-amber-500 hover:bg-amber-500/10 rounded transition-colors border border-amber-500/20 shrink-0 cursor-pointer"
          >
            Overwrite
          </button>
        )}
        {props.onLoad && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onLoad?.(project.id, project.name);
            }}
            className="px-2.5 py-1 text-[10px] font-bold text-blue-500 hover:bg-blue-500/10 rounded transition-colors border border-blue-500/20 shrink-0 cursor-pointer"
          >
            Open
          </button>
        )}
        {deleteButton}
      </div>
    );
  };

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-xs flex items-center gap-1.5 min-w-0">
          <span className="truncate flex-1" title={project.name}>{project.name}</span>
          {isActive && (
            <span className="text-[9px] bg-blue-500 text-white px-1 py-0.2 rounded uppercase tracking-wider font-bold shrink-0">Active</span>
          )}
        </div>
        <div className="text-[9px] text-slate-500 font-mono mt-0.5 shrink-0">
          {new Date(((project as any).updatedAt || (project as any).updated_at ? new Date((project as any).updated_at || (project as any).updatedAt * 1000).getTime() / 1000 : Date.now() / 1000) * 1000).toLocaleString()}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {renderActions()}
      </div>
    </>
  );

  const containerClass = cn(
    "flex items-center justify-between p-3 rounded-lg border transition-all duration-150 hover:shadow-md min-w-0 gap-3 select-none text-left w-full",
    props.onSelect && "cursor-pointer",
    colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/80 hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300",
    (isActive || isSelected) && (colorMode === 'dark' ? "border-blue-500 bg-blue-950/10" : "border-blue-300 bg-blue-50/20")
  );

  if (props.onSelect) {
    return (
      <button
        type="button"
        onClick={props.onSelect}
        className={containerClass}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={containerClass}>
      {content}
    </div>
  );
};
