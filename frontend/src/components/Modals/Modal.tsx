import React from 'react';
import { X } from 'lucide-react';
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
  widthClass = "w-[600px]",
  maxHeightClass = "max-h-[85vh]",
  alignClass = "items-center",
  disableScroll = false,
  compactHeader = false
}: ModalProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      globalThis.addEventListener('keydown', handleEsc);
    }
    return () => globalThis.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      open
      className={cn(
        "fixed inset-0 z-[110] flex justify-center p-4 w-full h-full bg-transparent border-none overflow-hidden",
        alignClass
      )}
    >
      {/* Backdrop button for accessibility to handle clicks outside */}
      <button
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
            <div className={cn(
              "rounded-lg bg-opacity-10",
              compactHeader ? "p-1.5" : "p-2",
              iconColorClass.replace('text-', 'bg-')
            )}>
              <Icon className={iconColorClass} size={compactHeader ? 18 : 24} />
            </div>
            <div>
              <h2 className={cn("font-bold leading-tight", compactHeader ? "text-base" : "text-xl")}>{title}</h2>
              {subtitle && <p className={cn("text-slate-500 font-medium", compactHeader ? "text-[10px] leading-tight" : "text-xs")}>{subtitle}</p>}
            </div>
          </div>
          <button
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
    </dialog>
  );
};
