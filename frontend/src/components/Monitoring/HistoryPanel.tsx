import { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useHistory } from '../../hooks/useHistory';
import { useFlowStore } from '../../store';

interface HistoryPanelProps {
  colorMode: 'dark' | 'light';
}

export function HistoryPanel({ colorMode }: Readonly<HistoryPanelProps>) {
  const { historyLogs, currentHistoryIndex, isLoading, fetchHistoryLogs, handleJumpToHistory } = useHistory();
  const lastActionId = useFlowStore((state) => state.lastActionId);

  useEffect(() => {
    fetchHistoryLogs();
  }, [fetchHistoryLogs, lastActionId]);

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
        {isLoading && historyLogs.length === 0 ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'h-12 rounded animate-pulse',
                  colorMode === 'dark' ? 'bg-slate-800/60' : 'bg-slate-200/60'
                )}
              />
            ))}
          </div>
        ) : historyLogs.length === 0 ? (
          <div className="p-8 text-center text-[10px] opacity-50 italic">No activity recorded</div>
        ) : (
          historyLogs.map((log, index) => {
            const isCurrentStep = currentHistoryIndex !== null
              ? log.index === currentHistoryIndex
              : (index === 0);
            return (
              <button
                type="button"
                key={`${log.timestamp}-${log.index}`}
                onClick={() => handleJumpToHistory(log.index)}
                className={cn(
                  'w-full text-left py-2.5 px-2 text-[10px] flex flex-col gap-1 transition-all border-l-2 hover:border-violet-500 rounded-sm my-0.5',
                  isCurrentStep
                    ? (colorMode === 'dark' ? 'bg-violet-950/40 border-violet-500 text-violet-300' : 'bg-violet-50 border-violet-500 text-violet-900')
                    : 'border-transparent ' + (colorMode === 'dark' ? 'hover:bg-slate-800/50 text-slate-300' : 'hover:bg-violet-50/50 text-slate-700')
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold tracking-tight flex items-center gap-1.5">
                    {log.actionName}
                    {isCurrentStep && (
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-violet-500/20 text-violet-400 font-bold uppercase tracking-wider">
                        Current
                      </span>
                    )}
                  </span>
                  <span className="font-mono opacity-40 text-[8px]">IDX:{log.index.toString().padStart(3, '0')}</span>
                </div>
                <div className="flex items-center justify-between opacity-50">
                  <span className="text-[8px] uppercase tracking-wider">
                    {log.timestamp > 0 ? new Date(log.timestamp).toLocaleTimeString() : 'Recorded Snapshot'}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
