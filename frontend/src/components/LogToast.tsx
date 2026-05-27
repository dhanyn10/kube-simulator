import React from 'react';
import { useFlowStore } from '../store';
import { AlertCircle, AlertTriangle, X, ExternalLink } from 'lucide-react';
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
        'fixed bottom-6 left-6 z-[9999] flex items-center gap-4 px-4 py-3 rounded-lg shadow-2xl border animate-in slide-in-from-left-4 duration-300',
        colorMode === 'dark'
          ? 'bg-slate-900 border-slate-700 text-slate-200'
          : 'bg-white border-slate-200 text-slate-800'
      )}
    >
      <div className="flex items-center gap-3 pr-2 border-r border-slate-700/50">
        {errorCount > 0 && (
          <div className="flex items-center gap-1.5 text-red-500 font-medium">
            <AlertCircle size={16} />
            <span>{errorCount}</span>
          </div>
        )}
        {warnCount > 0 && (
          <div className="flex items-center gap-1.5 text-amber-500 font-medium">
            <AlertTriangle size={16} />
            <span>{warnCount}</span>
          </div>
        )}
      </div>

      <button
        onClick={() => {
          setModalOpen(true);
          setVisible(false);
        }}
        className={cn(
          'flex items-center gap-2 text-sm font-medium hover:underline transition-colors',
          colorMode === 'dark' ? 'text-blue-400' : 'text-blue-600'
        )}
      >
        Open Logs
        <ExternalLink size={14} />
      </button>

      <button
        onClick={() => setVisible(false)}
        className="ml-2 p-1 rounded-full hover:bg-slate-500/20 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};
