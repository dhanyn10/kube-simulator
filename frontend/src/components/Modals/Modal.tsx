import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';
import { useOutsideContextMenu } from '@/hooks/useOutsideContextMenu';
import { useContextMenuPosition } from '@/lib/contextMenuUtils';

type ColorMode = 'dark' | 'light';

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
  headerExtra?: React.ReactNode;
  closeLabel?: string;
  disablePadding?: boolean;
}

const getContainerClass = (
  colorMode: ColorMode,
  widthClass: string,
  maxHeightClass: string
): string =>
  cn(
    "modal-container animate-in fade-in zoom-in duration-200",
    widthClass,
    maxHeightClass,
    colorMode === 'dark'
      ? "bg-slate-900 border-slate-800 text-slate-100"
      : "bg-white border-slate-200 text-slate-800"
  );

const getHeaderClass = (compactHeader: boolean): string =>
  cn("border-b flex items-center justify-between shrink-0", compactHeader ? "p-3 px-4" : "p-6");

const getTitleClass = (compactHeader: boolean): string =>
  cn("font-bold leading-tight", compactHeader ? "text-base" : "text-xl");

const getSubtitleClass = (compactHeader: boolean): string =>
  cn("text-slate-500 font-medium", compactHeader ? "text-[10px] leading-tight" : "text-xs");

const getContentPaddingClass = (disablePadding: boolean, compactHeader: boolean): string => {
  if (disablePadding) return "flex flex-col";
  return compactHeader ? "p-4" : "p-6";
};

const getContentClass = (
  disablePadding: boolean,
  compactHeader: boolean,
  disableScroll: boolean
): string =>
  cn(
    "flex-1 min-h-0",
    getContentPaddingClass(disablePadding, compactHeader),
    !disableScroll && "overflow-y-auto custom-scrollbar"
  );

const getIconSize = (compactHeader: boolean): number => (compactHeader ? 18 : 24);
const getCloseIconSize = (compactHeader: boolean): number => (compactHeader ? 16 : 20);

interface ModalContextMenuProps {
  readonly colorMode: ColorMode;
  readonly position: { readonly top: number; readonly left: number };
  readonly menuRef: React.RefObject<HTMLDivElement | null>;
  readonly onToggleTheme: () => void;
  readonly onCloseMenu: () => void;
}

/**
 * Theme/close context menu shown on right click inside a modal.
 */
const ModalContextMenu = ({
  colorMode,
  position,
  menuRef,
  onToggleTheme,
  onCloseMenu,
}: Readonly<ModalContextMenuProps>) => {
  const isDark = colorMode === 'dark';

  return (
    <div
      ref={menuRef}
      style={{ top: position.top, left: position.left }}
      className={cn(
        "modal-context-menu",
        isDark
          ? "bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-black/50"
          : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50"
      )}
    >
      <button
        type="button"
        onClick={onToggleTheme}
        className={cn(
          "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors",
          isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
        )}
      >
        {isDark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-slate-600" />}
        <span>Change Theme</span>
      </button>

      <div className={cn("my-1 border-t", isDark ? "border-slate-800" : "border-slate-100")} />

      <button
        type="button"
        onClick={onCloseMenu}
        className={cn(
          "w-full px-3 py-2 text-left flex items-center gap-2 font-medium transition-colors text-rose-400 hover:text-rose-300",
          isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
        )}
      >
        <X size={14} />
        <span>Close</span>
      </button>
    </div>
  );
};

/**
 * Presentational Modal dialog wrapper: renders header (title, subtitle, icon) + children + footer
 * (and is hidden when `isOpen` is false).
 *
 * @param props - `ModalProps` (isOpen, onClose, title, subtitle, icon, footer, size/alignment variants...).
 * @returns Modal JSX or null.
 */
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
  maxHeightClass = "h-[80vh]",
  alignClass = "items-center",
  disableScroll = false,
  compactHeader = true,
  headerExtra,
  closeLabel = "Close",
  disablePadding = false,
}: ModalProps) => {
  const colorMode = useFlowStore((state) => state.colorMode) as ColorMode;
  const toggleColorMode = useFlowStore((state) => state.toggleColorMode);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const position = useContextMenuPosition(contextMenu?.x ?? 0, contextMenu?.y ?? 0, contextMenuRef);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      globalThis.addEventListener('keydown', handleEsc);
    }
    return () => globalThis.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useOutsideContextMenu(contextMenuRef, Boolean(contextMenu), closeContextMenu);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleToggleTheme = () => {
    toggleColorMode();
    closeContextMenu();
  };

  const handleCloseFromMenu = () => {
    closeContextMenu();
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <dialog
      open
      onContextMenu={handleContextMenu}
      className={cn("modal-overlay bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200", alignClass)}
    >
      {/* Backdrop button for accessibility to handle clicks outside */}
      <button
        type="button"
        className="fixed inset-0 w-full h-full cursor-default outline-none bg-transparent"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className={getContainerClass(colorMode, widthClass, maxHeightClass)}>
        {/* Header */}
        <div className={getHeaderClass(compactHeader)}>
          <div className="flex items-center gap-3">
            <Icon className={iconColorClass} size={getIconSize(compactHeader)} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className={getTitleClass(compactHeader)}>{title}</h2>
                {headerExtra}
              </div>
              {subtitle && <p className={getSubtitleClass(compactHeader)}>{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-500/10 rounded-full transition-colors outline-none focus:ring-2 focus:ring-blue-500/50"
            aria-label={closeLabel}
            title={closeLabel}
          >
            <X size={getCloseIconSize(compactHeader)} />
          </button>
        </div>

        {/* Content */}
        <div className={getContentClass(disablePadding, compactHeader, disableScroll)}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-3 px-4 border-t bg-slate-500/5 shrink-0">
            {footer}
          </div>
        )}
      </div>

      {/* Unified Context Menu */}
      {contextMenu && (
        <ModalContextMenu
          colorMode={colorMode}
          position={position}
          menuRef={contextMenuRef}
          onToggleTheme={handleToggleTheme}
          onCloseMenu={handleCloseFromMenu}
        />
      )}
    </dialog>,
    document.body
  );
};
