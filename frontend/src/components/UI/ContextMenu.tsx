import { Boxes, Box, FileCode, Trash2, Copy, Clipboard, Terminal, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContextMenuHandler } from '@/activities/ui';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onInspect: () => void;
  onDelete: () => void;
}

export const ContextMenu = ({ x, y, onClose, onInspect, onDelete }: ContextMenuProps) => {
  const {
    colorMode,
    toggleColorMode,
    nodes,
    menuRef,
    singleNode,
    canViewLogs,
    hasSelection,
    canGroup,
    isGrouped,
    canPaste,
    selectedIds,
    groupNodes,
    ungroupNodes,
    copyNodes,
    pasteNodes,
    setTerminalOpen,
    setTerminalActiveTab,
    setTerminalSelectedResourceId,
    handleMenuKeyDown,
  } = useContextMenuHandler({ onClose });

  const itemClass = cn(
    "w-full px-3 py-2 text-xs flex items-center gap-3 transition-colors",
    colorMode === 'dark'
      ? "hover:bg-blue-600 text-slate-300 hover:text-white focus:bg-blue-600 focus:text-white focus:outline-none"
      : "hover:bg-blue-50 text-slate-700 hover:text-blue-700 focus:bg-blue-50 focus:text-blue-700 focus:outline-none"
  );

  const dividerClass = cn("h-px my-1", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100");

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[2000] cursor-default bg-transparent"
        aria-label="Close context menu"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        onTouchStart={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        ref={menuRef}
        role="menu"
        tabIndex={-1}
        aria-label="Canvas context menu"
        className={cn(
          "fixed min-w-[180px] py-1.5 rounded-xl border shadow-2xl animate-in fade-in zoom-in duration-100 z-[2001] outline-none",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}
        style={{ left: x, top: y }}
        onKeyDown={handleMenuKeyDown}
      >
        {/* Inspect */}
        <button
          type="button"
          role="menuitem"
          onClick={() => { onInspect(); onClose(); }}
          disabled={nodes.length === 0}
          className={cn(itemClass, "disabled:opacity-30 disabled:pointer-events-none")}
        >
          <FileCode size={14} className="text-blue-500" />
          <span className="font-medium">Inspect YAML</span>
        </button>

        {canViewLogs && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setTerminalSelectedResourceId(singleNode.id);
              setTerminalActiveTab('logs');
              setTerminalOpen(true);
              onClose();
            }}
            className={itemClass}
          >
            <Terminal size={14} className="text-emerald-500" />
            <span className="font-medium">View logs (kubectl logs)</span>
          </button>
        )}

        {/* Change Theme */}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            toggleColorMode();
            onClose();
          }}
          className={itemClass}
        >
          {colorMode === 'dark' ? (
            <Sun size={14} className="text-yellow-400" />
          ) : (
            <Moon size={14} className="text-blue-600" />
          )}
          <span className="font-medium">Change Theme</span>
        </button>

        <div className={dividerClass} />

        {/* Copy / Paste */}
        <button
          type="button"
          role="menuitem"
          onClick={() => { copyNodes(); onClose(); }}
          disabled={!hasSelection}
          className={cn(itemClass, "disabled:opacity-30 disabled:pointer-events-none")}
        >
          <Copy size={14} />
          <div className="flex-1 flex justify-between items-center">
            <span className="font-medium">Copy</span>
            <span className="text-[10px] opacity-50">Ctrl+C</span>
          </div>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => { pasteNodes(); onClose(); }}
          disabled={!canPaste}
          className={cn(itemClass, "disabled:opacity-30 disabled:pointer-events-none")}
        >
          <Clipboard size={14} />
          <div className="flex-1 flex justify-between items-center">
            <span className="font-medium">Paste</span>
            <span className="text-[10px] opacity-50">Ctrl+V</span>
          </div>
        </button>

        <div className={dividerClass} />

        {/* Group / Ungroup */}
        <button
          type="button"
          role="menuitem"
          onClick={() => { groupNodes(selectedIds); onClose(); }}
          disabled={!canGroup}
          className={cn(itemClass, "disabled:opacity-30 disabled:pointer-events-none")}
        >
          <Boxes size={14} className={canGroup ? "text-emerald-500" : ""} />
          <div className="flex-1 flex justify-between items-center">
            <span className="font-medium">Group</span>
            <span className="text-[10px] opacity-50">Ctrl+G</span>
          </div>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => { ungroupNodes(selectedIds); onClose(); }}
          disabled={!isGrouped}
          className={cn(itemClass, "disabled:opacity-30 disabled:pointer-events-none")}
        >
          <Box size={14} />
          <div className="flex-1 flex justify-between items-center">
            <span className="font-medium">Ungroup</span>
            <span className="text-[10px] opacity-50">Ctrl+U</span>
          </div>
        </button>

        <div className={dividerClass} />

        {/* Delete */}
        <button
          type="button"
          role="menuitem"
          onClick={() => { onDelete(); onClose(); }}
          disabled={!hasSelection}
          className="w-full px-3 py-2 text-xs flex items-center gap-3 transition-colors text-red-500 hover:bg-red-500 hover:text-white focus:bg-red-500 focus:text-white focus:outline-none disabled:opacity-30 disabled:pointer-events-none"
        >
          <Trash2 size={14} />
          <div className="flex-1 flex justify-between items-center">
            <span className="font-medium">Delete</span>
            <span className="text-[10px] opacity-50 uppercase">Del</span>
          </div>
        </button>
      </div>
    </>
  );
};
