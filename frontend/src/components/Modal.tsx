import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';

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
  maxHeightClass = "max-h-[85vh]"
}: ModalProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={cn(
          "rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200",
          widthClass,
          maxHeightClass,
          colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-opacity-10", iconColorClass.replace('text-', 'bg-'))}>
              <Icon className={iconColorClass} size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-500/10 rounded-full transition-colors outline-none focus:ring-2 focus:ring-blue-500/50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t bg-slate-500/5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
