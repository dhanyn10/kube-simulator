
import { Settings, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';

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
        onClick={(e) => {
          e.stopPropagation();
          useFlowStore.getState().setConfiguringNodeId(id);
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
      onClick={(e) => {
        e.stopPropagation();
        onDelete?.();
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
  buttonClassName = ""
}: any) => {
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
        onBlur={handleRename}
        onKeyDown={onKeyDown}
        className={cn(
          "text-xs font-mono font-bold px-1 py-0.5 rounded border outline-none w-full",
          colorMode === 'dark' ? "bg-slate-900 text-slate-100 border-blue-500" : "bg-slate-50 text-slate-900 border-blue-400",
          inputClassName,
          className
        )}
      />
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
