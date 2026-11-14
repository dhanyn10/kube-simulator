import { Settings, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';

export const NodeActionButtons = ({ 
  id, 
  onDelete, 
  colorMode, 
  hideSettings,
  className = ""
}: { 
  id: string; 
  onDelete?: () => void; 
  colorMode: string; 
  hideSettings?: boolean;
  className?: string;
}) => (
  <div className={cn("opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all", className)}>
    {!hideSettings && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          useFlowStore.getState().toggleNodeSettings(id);
        }}
        className={cn(
          "p-1 rounded transition-all",
          colorMode === 'dark' ? "hover:bg-slate-700 text-slate-500 hover:text-blue-400" : "hover:bg-slate-100 text-slate-400 hover:text-blue-500"
        )}
      >
        <Settings size={12} />
      </button>
    )}
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onDelete) {
          onDelete();
        } else {
          const store = useFlowStore.getState();
          const node = store.nodes.find((n) => n.id === id);
          if (node) {
            store.deleteNodes([node]);
          }
        }
      }}
      className={cn(
        "p-1 rounded transition-all",
        colorMode === 'dark' ? "hover:bg-slate-700 text-slate-500 hover:text-red-400" : "hover:bg-slate-100 text-slate-400 hover:text-red-500"
      )}
    >
      <Trash2 size={12} />
    </button>
  </div>
);

export interface NodeRenameInputProps {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  editValue: string;
  setEditValue: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  handleRename: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  colorMode: string;
  label: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  errorMessage?: string;
}

export const NodeRenameInput = ({
  isEditing,
  setIsEditing,
  editValue,
  setEditValue,
  inputRef,
  handleRename,
  onKeyDown,
  colorMode,
  label,
  className = "",
  inputClassName = "",
  buttonClassName = "",
  errorMessage = ""
}: NodeRenameInputProps) => {
  if (isEditing) {
    return (
      <div className="relative flex flex-col min-w-0">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            e.stopPropagation();
            onKeyDown(e);
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "nodrag nopan nowheel text-xs font-mono font-bold px-1 py-0.5 rounded border outline-none w-full relative z-50",
            colorMode === 'dark' ? "bg-slate-900 text-slate-100 border-blue-500" : "bg-slate-50 text-slate-900 border-blue-400",
            errorMessage && "!border-rose-500 !text-rose-500 dark:!text-rose-400 focus:!border-rose-500 ring-1 ring-rose-500/30",
            inputClassName,
            className
          )}
        />
        {errorMessage && (
          <div
            data-testid="canvas-duplicate-name-error"
            className="absolute top-full left-0 mt-1 z-[100] px-1.5 py-0.5 rounded shadow-lg bg-rose-600 text-white dark:bg-rose-950 dark:border dark:border-rose-800 text-[10px] font-sans font-medium whitespace-nowrap flex items-center gap-1 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
          >
            <AlertCircle size={10} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "text-xs font-mono font-bold truncate cursor-text text-left border-none bg-transparent p-0 outline-none focus:ring-1 focus:ring-blue-500/50 rounded w-full",
        colorMode === 'dark' ? "text-slate-100" : "text-slate-900",
        buttonClassName,
        className
      )}
      onDoubleClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
      title={`Double click to rename: ${label}`}
      aria-label={`Rename ${label}`}
    >
      {label}
    </button>
  );
};
