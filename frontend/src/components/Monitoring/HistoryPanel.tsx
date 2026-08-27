import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useHistory } from '../../hooks/useHistory';

interface HistoryPanelProps {
  colorMode: 'dark' | 'light';
}

export function HistoryPanel({ colorMode }: Readonly<HistoryPanelProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const { historyLogs, fetchHistoryLogs, handleJumpToHistory } = useHistory();

  useEffect(() => {
    fetchHistoryLogs();
  }, [fetchHistoryLogs]);

  return (
    <div className="w-full flex flex-col h-full">
      <div className="pb-3 mb-2 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Activity Timeline</h3>
        </div>
        <span className="text-[9px] font-mono opacity-40">{historyLogs.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
        {historyLogs.length === 0 ? (
          <div className="p-8 text-center text-[10px] opacity-50 italic">No activity recorded</div>
        ) : (
          historyLogs.map((log) => (
            <button
              type="button"
              key={`${log.timestamp}-${log.index}`}
              onClick={() => handleJumpToHistory(log.index)}
              className={cn(
                'w-full text-left px-4 py-2.5 text-[10px] flex flex-col gap-1 transition-all border-l-2 border-transparent hover:border-violet-500',
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
    </div>
  );
}
