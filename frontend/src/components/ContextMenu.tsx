
import { useEffect, useRef } from 'react';
import { Boxes, Box, FileCode, Trash2, Copy, Clipboard } from 'lucide-react';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onInspect: () => void;
  onDelete: () => void;
}

export const ContextMenu = ({ x, y, onClose, onInspect, onDelete }: ContextMenuProps) => {
  const colorMode = useFlowStore((state: any) => state.colorMode);
  const nodes = useFlowStore((state: any) => state.nodes);
  const groupNodes = useFlowStore((state: any) => state.groupNodes);
  const ungroupNodes = useFlowStore((state: any) => state.ungroupNodes);
  const copyNodes = useFlowStore((state: any) => state.copyNodes);
  const pasteNodes = useFlowStore((state: any) => state.pasteNodes);

  const menuRef = useRef<HTMLDivElement>(null);

  const selectedNodes = nodes.filter((n: any) => n.selected);
  const selectedIds = selectedNodes.map((n: any) => n.id);
  const hasSelection = selectedIds.length > 0;
  const canGroup = selectedIds.length > 1;
  const isGrouped = selectedNodes.some((n: any) => n.data?.groupId);

  // Focus first menu item on open
  useEffect(() => {
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    firstItem?.focus();
  }, []);

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []
    );
    const current = document.activeElement as HTMLElement;
    const idx = items.indexOf(current);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      onClose();
    }
  };

  const itemClass = cn(
    "w-full px-3 py-2 text-xs flex items-center gap-3 transition-colors",
    colorMode === 'dark'
      ? "hover:bg-blue-600 text-slate-300 hover:text-white focus:bg-blue-600 focus:text-white focus:outline-none"
      : "hover:bg-blue-50 text-slate-700 hover:text-blue-700 focus:bg-blue-50 focus:text-blue-700 focus:outline-none"
  );

  const dividerClass = cn("h-px my-1", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100");

  return (
    <div
      className="fixed inset-0 z-[2000]"
      role="button"
      tabIndex={-1}
      aria-label="Close context menu"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      onTouchStart={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label="Canvas context menu"
        className={cn(
          "absolute min-w-[180px] py-1.5 rounded-xl border shadow-2xl animate-in fade-in zoom-in duration-100",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => { e.stopPropagation(); handleMenuKeyDown(e); }}
      >
        {/* Inspect */}
        <button
          role="menuitem"
          onClick={() => { onInspect(); onClose(); }}
          className={itemClass}
        >
          <FileCode size={14} className="text-blue-500" />
          <span className="font-medium">Inspect YAML</span>
        </button>

        <div className={dividerClass} />

        {/* Copy / Paste */}
        <button
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
          role="menuitem"
          onClick={() => { pasteNodes(); onClose(); }}
          className={itemClass}
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

        {/* Arrange Layout */}
        <button
          role="menuitem"
          onClick={() => { useFlowStore.getState().autoLayout('LR'); onClose(); }}
          className={itemClass}
        >
          <Boxes size={14} className="rotate-90 text-blue-400" />
          <span className="font-medium">Arrange (L → R)</span>
        </button>

        <button
          role="menuitem"
          onClick={() => { useFlowStore.getState().autoLayout('TB'); onClose(); }}
          className={itemClass}
        >
          <Boxes size={14} className="text-blue-400" />
          <span className="font-medium">Arrange (T → B)</span>
        </button>

        <div className={dividerClass} />

        {/* Delete */}
        <button
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
    </div>
  );
};
