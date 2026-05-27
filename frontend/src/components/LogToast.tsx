import React from 'react';
import { useFlowStore } from '../store';
import { AlertCircle, AlertTriangle, X, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

export const LogToast: React.FC = () => {
  const logs = useFlowStore((state) => state.logs);
  const isVisible = useFlowStore((state) => state.isLogToastVisible);
  const setVisible = useFlowStore((state) => state.setLogToastVisible);
  const setModalOpen = useFlowStore((state) => state.setLogModalOpen);
  const colorMode = useFlowStore((state) => state.colorMode);

  if (!isVisible || logs.length === 0) return null;

  const errorCount = logs.filter((l) => l.level === 'error' || l.level === 'fatal').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-6 z-[9999] flex items-center gap-4 pl-4 pr-2 py-2 rounded-lg shadow-2xl border animate-in slide-in-from-left-4 duration-300',
        colorMode === 'dark'
          ? 'bg-slate-900/90 backdrop-blur-md border-slate-700 text-slate-200'
          : 'bg-white/90 backdrop-blur-md border-slate-200 text-slate-800'
      )}
    >
      <div className="flex items-center gap-3 pr-3 border-r border-slate-700/30">
        <div className="flex items-center gap-2">
            <Terminal size={14} className="text-slate-500" />
            <span className="text-xs font-bold uppercase tracking-tight opacity-50">Logs</span>
        </div>
        <div className="flex items-center gap-3">
            {errorCount > 0 && (
            <div className="flex items-center gap-1.5 text-red-500 font-semibold tabular-nums">
                <AlertCircle size={14} />
                <span className="text-sm">{errorCount}</span>
            </div>
            )}
            {warnCount > 0 && (
            <div className="flex items-center gap-1.5 text-amber-500 font-semibold tabular-nums">
                <AlertTriangle size={14} />
                <span className="text-sm">{warnCount}</span>
            </div>
            )}
        </div>
      </div>

      <button
        onClick={() => setModalOpen(true)}
        className={cn(
          'px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 active:scale-95',
          colorMode === 'dark'
            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'
        )}
      >
        Open
      </button>

      <button
        onClick={() => setVisible(false)}
        className="p-1.5 rounded-md hover:bg-slate-500/20 transition-colors opacity-50 hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
};
