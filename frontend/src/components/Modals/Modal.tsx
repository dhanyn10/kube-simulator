import React, { useState, useEffect, useRef } from 'react';
import { X, Sun, Moon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  iconColorClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
  maxHeightClass?: string;
  alignClass?: string;
  disableScroll?: boolean;
  compactHeader?: boolean;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconColorClass = "text-blue-500",
  children,
  footer,
  widthClass = "w-full max-w-3xl",
  maxHeightClass = "max-h-[85vh] h-[70vh]",
  alignClass = "items-center",
  disableScroll = false,
  compactHeader = true
}: ModalProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const toggleColorMode = useFlowStore((state) => state.toggleColorMode);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      globalThis.addEventListener('keydown', handleEsc);
    }
    return () => globalThis.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      globalThis.addEventListener('click', handleClickOutside);
      globalThis.addEventListener('contextmenu', handleClickOutside);
    }
    return () => {
      globalThis.removeEventListener('click', handleClickOutside);
      globalThis.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  if (!isOpen) return null;

  return (
    <dialog
      open
      onContextMenu={handleContextMenu}
      className={cn(
        "fixed inset-0 z-[110] flex justify-center p-4 w-full h-full bg-transparent border-none overflow-hidden outline-none focus:outline-none",
        alignClass
      )}
    >
      {/* Backdrop button for accessibility to handle clicks outside */}
      <button
        type="button"
        className="fixed inset-0 w-full h-full cursor-default outline-none bg-transparent"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        className={cn(
          "relative rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 pointer-events-auto",
          widthClass,
          maxHeightClass,
          colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        )}
      >
        {/* Header */}
        <div className={cn(
          "border-b flex items-center justify-between shrink-0",
          compactHeader ? "p-3 px-4" : "p-6"
        )}>
          <div className="flex items-center gap-3">
            <Icon className={iconColorClass} size={compactHeader ? 18 : 24} />
            <div>
              <h2 className={cn("font-bold leading-tight", compactHeader ? "text-base" : "text-xl")}>{title}</h2>
              {subtitle && <p className={cn("text-slate-500 font-medium", compactHeader ? "text-[10px] leading-tight" : "text-xs")}>{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-500/10 rounded-full transition-colors outline-none focus:ring-2 focus:ring-blue-500/50"
            aria-label="Close"
          >
            <X size={compactHeader ? 16 : 20} />
          </button>
        </div>

        {/* Content */}
        <div className={cn(
          "flex-1 min-h-0",
          compactHeader ? "p-4" : "p-6",
          !disableScroll && "overflow-y-auto custom-scrollbar"
        )}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t bg-slate-500/5 shrink-0">
            {footer}
          </div>
        )}
      </div>

      {/* Unified Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className={cn(
            "fixed z-[200] min-w-[160px] py-1 rounded-lg border shadow-xl text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100",
            colorMode === 'dark'
              ? "bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/50"
              : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50"
          )}
        >
          <button
            type="button"
            onClick={() => {
              toggleColorMode();
              setContextMenu(null);
            }}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors",
              colorMode === 'dark'
                ? "hover:bg-slate-800 text-slate-200"
                : "hover:bg-slate-100 text-slate-700"
            )}
          >
            {colorMode === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-slate-600" />}
            <span>Change Theme</span>
          </button>

          <div className={cn("my-1 border-t", colorMode === 'dark' ? "border-slate-800" : "border-slate-100")} />

          <button
            type="button"
            onClick={() => {
              setContextMenu(null);
              onClose();
            }}
            className={cn(
              "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-rose-400 hover:text-rose-300",
              colorMode === 'dark'
                ? "hover:bg-slate-800"
                : "hover:bg-slate-100"
            )}
          >
            <X size={14} />
            <span>Close</span>
          </button>
        </div>
      )}
    </dialog>
  );
};
