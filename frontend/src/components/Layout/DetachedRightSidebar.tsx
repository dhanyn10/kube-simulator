import React from 'react';
import { RightSidebar } from '@/components/Layout/RightSidebar';
import { useSidebarSync } from '@/activities/layout';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { ArrowDownLeft, X } from 'lucide-react';

/**
 * DetachedRightSidebar represents the Configuration & Inspector sidebar in an isolated Wails window.
 * It provides a window title bar with drag handle and "Attach back to Main Window" control.
 */
export const DetachedRightSidebar: React.FC = () => {
  const { broadcastAttachSidebar } = useSidebarSync();
  const colorMode = useFlowStore((state) => state.colorMode);
  const isDark = colorMode === 'dark';

  const handleAttachBack = () => {
    broadcastAttachSidebar('right');
  };

  return (
    <div
      className={cn(
        'flex flex-col h-screen w-screen overflow-hidden select-none font-sans',
        isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'
      )}
    >
      {/* Detached Window Title Bar */}
      <header
        style={{ '--wails-draggable': 'drag' } as React.CSSProperties}
        className={cn(
          'h-9 px-3 flex items-center justify-between border-b shrink-0 text-xs font-semibold select-none',
          isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
        )}
      >
        <span className="flex items-center gap-1.5 font-bold tracking-tight text-[11px] uppercase text-emerald-500">
          Configuration & Inspector
        </span>
        <div style={{ '--wails-draggable': 'none' } as React.CSSProperties} className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleAttachBack}
            data-testid="attach-right-sidebar-btn"
            title="Attach to Main Window"
            aria-label="Attach to Main Window"
            className={cn(
              'px-2 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition-colors',
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
            )}
          >
            <ArrowDownLeft size={13} />
            <span>Attach</span>
          </button>
          <button
            type="button"
            onClick={handleAttachBack}
            data-testid="close-right-sidebar-window-btn"
            title="Close / Re-attach"
            aria-label="Close / Re-attach"
            className={cn(
              'p-1 rounded transition-colors text-slate-400 hover:text-rose-500',
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
            )}
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Main RightSidebar View */}
      <main className="flex-1 overflow-hidden relative">
        <RightSidebar onExportYaml={() => {}} isDetached />
      </main>
    </div>
  );
};
