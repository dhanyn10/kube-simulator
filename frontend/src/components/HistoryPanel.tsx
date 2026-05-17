import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { useHistory } from '../hooks/useHistory';

interface HistoryPanelProps {
  colorMode: 'dark' | 'light';
}

export function HistoryPanel({ colorMode }: HistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { historyLogs, fetchHistoryLogs, handleJumpToHistory } = useHistory();

  let btnBgClass = 'bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-600';
  if (isOpen) {
    btnBgClass = 'bg-violet-600 text-white scale-110';
  } else if (colorMode === 'dark') {
    btnBgClass = 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400';
  }

  useEffect(() => {
    if (isOpen) fetchHistoryLogs();
  }, [isOpen, fetchHistoryLogs]);

  return (
    <div className="mt-4 flex flex-col gap-2 relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'p-2 rounded-md transition-all duration-300 shadow-xl z-30',
          btnBgClass
        )}
        title="Activity Log (BadgerDB)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {isOpen && (
        <div className={cn(
          'absolute left-12 top-0 w-72 max-h-[400px] overflow-hidden rounded-xl shadow-2xl z-40 border flex flex-col animate-in fade-in slide-in-from-left-4 duration-300',
          colorMode === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        )}>
          <div className={cn('p-4 border-b flex items-center justify-between', colorMode === 'dark' ? 'bg-slate-950/50' : 'bg-slate-50')}>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Activity Timeline</h3>
            </div>
            <span className="text-[9px] font-mono opacity-40">{historyLogs.length} events</span>
          </div>

          <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
            {historyLogs.length === 0 ? (
              <div className="p-8 text-center text-[10px] opacity-50 italic">No activity recorded in BadgerDB</div>
            ) : (
              historyLogs.map((log) => (
                <button
                  key={`${log.timestamp}-${log.index}`}
                  onClick={() => { handleJumpToHistory(log.index); setIsOpen(false); }}
                  className={cn(
                    'w-full text-left px-5 py-3 text-[10px] flex flex-col gap-1 transition-all border-l-2 border-transparent hover:border-violet-500',
                    colorMode === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-violet-50/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('font-bold tracking-tight', colorMode === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                      {log.actionName}
                    </span>
                    <span className="font-mono opacity-30 text-[8px]">IDX:{log.index.toString().padStart(3, '0')}</span>
                  </div>
                  <div className="flex items-center justify-between opacity-50">
                    <span className="text-[8px] uppercase tracking-wider">
                      {log.timestamp > 0 ? new Date(log.timestamp).toLocaleTimeString() : 'Recorded Snapshot'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className={cn('p-3 border-t text-[8px] uppercase tracking-[0.1em] text-center opacity-40 font-bold', colorMode === 'dark' ? 'bg-slate-950/30' : 'bg-slate-50')}>
            Source: User/Home/.kube-builder/history_db
          </div>
        </div>
      )}
    </div>
  );
}
