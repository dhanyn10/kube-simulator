import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContextMenuPosition } from '@/lib/contextMenuUtils';
import { useOutsideContextMenu } from '@/hooks/useOutsideContextMenu';

export interface TerminalContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  colorMode: 'dark' | 'light';
  showAuth: boolean;
  onToggleAuth: () => void;
  showFilterLogs: boolean;
  onToggleFilterLogs: () => void;
  showExportLogs: boolean;
  onToggleExportLogs: () => void;
}

export const TerminalContextMenu = ({
  x,
  y,
  onClose,
  colorMode,
  showAuth,
  onToggleAuth,
  showFilterLogs,
  onToggleFilterLogs,
  showExportLogs,
  onToggleExportLogs,
}: TerminalContextMenuProps) => {
  const isDark = colorMode === 'dark';
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useContextMenuPosition(x, y, menuRef);

  useOutsideContextMenu(menuRef, true, onClose);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const items = [
    { id: 'auth', label: 'Auth', checked: showAuth, onToggle: onToggleAuth },
    { id: 'filter-logs', label: 'Filter logs', checked: showFilterLogs, onToggle: onToggleFilterLogs },
    { id: 'export-log-file', label: 'Export log file', checked: showExportLogs, onToggle: onToggleExportLogs },
  ];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Terminal context menu"
      data-testid="terminal-context-menu"
      style={{ top: position.top, left: position.left }}
      className={cn(
        "fixed z-[700] min-w-[170px] p-1 rounded-md border shadow-2xl outline-none select-none text-[12px] font-sans",
        isDark
          ? "bg-[#1f242c] border-slate-700/80 text-slate-200"
          : "bg-white border-slate-200 text-slate-800"
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitemcheckbox"
          aria-checked={item.checked}
          data-testid={`terminal-context-${item.id}`}
          onClick={(e) => {
            e.stopPropagation();
            item.onToggle();
          }}
          className={cn(
            "w-full px-2 py-1.5 rounded-[3px] text-xs flex items-center gap-2 transition-colors text-left cursor-pointer outline-none",
            isDark
              ? "hover:bg-blue-600 text-slate-200 hover:text-white"
              : "hover:bg-blue-600 text-slate-700 hover:text-white"
          )}
        >
          <span
            data-testid={`terminal-check-slot-${item.id}`}
            className="w-4 h-4 flex items-center justify-center shrink-0"
          >
            {item.checked && <Check size={14} className="stroke-[2.5]" />}
          </span>
          <span className="flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
};
