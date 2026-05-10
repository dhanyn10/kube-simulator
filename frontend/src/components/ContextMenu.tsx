import React from 'react';
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

  const selectedNodes = nodes.filter((n: any) => n.selected);
  const selectedIds = selectedNodes.map((n: any) => n.id);
  const hasSelection = selectedIds.length > 0;
  const canGroup = selectedIds.length > 1;
  const isGrouped = selectedNodes.some((n: any) => n.data?.groupId);

  return (
    <div
      className="fixed inset-0 z-[2000]"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className={cn(
          "absolute min-w-[180px] py-1.5 rounded-xl border shadow-2xl animate-in fade-in zoom-in duration-100",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Inspect */}
        <button
          onClick={() => { onInspect(); onClose(); }}
          className={cn(
            "w-full px-3 py-2 text-xs flex items-center gap-3 transition-colors",
            colorMode === 'dark' ? "hover:bg-blue-600 text-slate-300 hover:text-white" : "hover:bg-blue-50 text-slate-700 hover:text-blue-700"
          )}
        >
          <FileCode size={14} className="text-blue-500" />
          <span className="font-medium">Inspect YAML</span>
        </button>

        <div className={cn("h-px my-1", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100")} />

        {/* Copy / Paste */}
        <button
          onClick={() => { copyNodes(); onClose(); }}
          disabled={!hasSelection}
          className={cn(
            "w-full px-3 py-2 text-xs flex items-center gap-3 transition-colors disabled:opacity-30 disabled:pointer-events-none",
            colorMode === 'dark' ? "hover:bg-blue-600 text-slate-300 hover:text-white" : "hover:bg-blue-50 text-slate-700 hover:text-blue-700"
          )}
        >
          <Copy size={14} />
          <div className="flex-1 flex justify-between items-center">
            <span className="font-medium">Copy</span>
            <span className="text-[10px] opacity-50">Ctrl+C</span>
          </div>
        </button>

        <button
          onClick={() => { pasteNodes(); onClose(); }}
          className={cn(
            "w-full px-3 py-2 text-xs flex items-center gap-3 transition-colors",
            colorMode === 'dark' ? "hover:bg-blue-600 text-slate-300 hover:text-white" : "hover:bg-blue-50 text-slate-700 hover:text-blue-700"
          )}
        >
          <Clipboard size={14} />
          <div className="flex-1 flex justify-between items-center">
            <span className="font-medium">Paste</span>
            <span className="text-[10px] opacity-50">Ctrl+V</span>
          </div>
        </button>

        <div className={cn("h-px my-1", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100")} />

        {/* Group / Ungroup */}
        <button
          onClick={() => { groupNodes(selectedIds); onClose(); }}
          disabled={!canGroup}
          className={cn(
            "w-full px-3 py-2 text-xs flex items-center gap-3 transition-colors disabled:opacity-30 disabled:pointer-events-none",
            colorMode === 'dark' ? "hover:bg-blue-600 text-slate-300 hover:text-white" : "hover:bg-blue-50 text-slate-700 hover:text-blue-700"
          )}
        >
          <Boxes size={14} className={canGroup ? "text-emerald-500" : ""} />
          <div className="flex-1 flex justify-between items-center">
            <span className="font-medium">Group</span>
            <span className="text-[10px] opacity-50">Ctrl+G</span>
          </div>
        </button>

        <button
          onClick={() => { ungroupNodes(selectedIds); onClose(); }}
          disabled={!isGrouped}
          className={cn(
            "w-full px-3 py-2 text-xs flex items-center gap-3 transition-colors disabled:opacity-30 disabled:pointer-events-none",
            colorMode === 'dark' ? "hover:bg-blue-600 text-slate-300 hover:text-white" : "hover:bg-blue-50 text-slate-700 hover:text-blue-700"
          )}
        >
          <Box size={14} />
          <div className="flex-1 flex justify-between items-center">
            <span className="font-medium">Ungroup</span>
            <span className="text-[10px] opacity-50">Ctrl+U</span>
          </div>
        </button>

        <div className={cn("h-px my-1", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100")} />

        {/* Delete */}
        <button
          onClick={() => { onDelete(); onClose(); }}
          disabled={!hasSelection}
          className={cn(
            "w-full px-3 py-2 text-xs flex items-center gap-3 transition-colors text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          )}
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
