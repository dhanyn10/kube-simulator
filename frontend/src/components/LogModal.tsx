import React from 'react';
import { useFlowStore } from '../store';
import { Modal } from './Modal';
import { Terminal, Trash2, AlertCircle, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

export const LogModal: React.FC = () => {
  const logs = useFlowStore((state) => state.logs);
  const isOpen = useFlowStore((state) => state.isLogModalOpen);
  const setOpen = useFlowStore((state) => state.setLogModalOpen);
  const clearLogs = useFlowStore((state) => state.clearLogs);
  const colorMode = useFlowStore((state) => state.colorMode);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      showBlur={false}
      showOverlay={false}
      title="Error Report"
      subtitle={`${logs.length} events captured`}
      icon={Terminal}
      iconColorClass="text-slate-500"
      widthClass="w-[800px]"
      footer={
        <div className="flex justify-between items-center w-full">
          <p className="text-xs text-slate-500">Logs are persisted in local storage.</p>
          <button
            onClick={clearLogs}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            Clear All
          </button>
        </div>
      }
    >
      <div className="space-y-2">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
            <Terminal size={48} strokeWidth={1} />
            <p>No logs recorded yet.</p>
          </div>
        ) : (
          [...logs].reverse().map((log) => (
            <div
              key={log.id}
              className={cn(
                'p-3 rounded-lg border flex flex-col gap-1',
                colorMode === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(log.level === 'error' || log.level === 'fatal') ? (
                    <AlertCircle size={14} className="text-red-500" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-500" />
                  )}
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                      (log.level === 'error' || log.level === 'fatal')
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-amber-500/10 text-amber-500'
                    )}
                  >
                    {log.level}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock size={12} />
                  <span className="text-[11px] tabular-nums font-medium">{formatTime(log.timestamp)}</span>
                </div>
              </div>
              <p className={cn(
                "text-sm font-mono break-all mt-1",
                colorMode === 'dark' ? "text-slate-300" : "text-slate-700"
              )}>
                {log.message}
              </p>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
