import React, { useState, useMemo } from 'react';
import { useFlowStore } from '../store';
import { Modal } from './Modal';
import { Bell, Trash2, AlertCircle, AlertTriangle, Clock, Info, Search } from 'lucide-react';
import { cn } from '../lib/utils';

type FilterType = 'all' | 'error' | 'warn' | 'info';

interface TabProps {
  type: FilterType;
  label: string;
  count: number;
  activeFilter: FilterType;
  setActiveFilter: (type: FilterType) => void;
  colorMode: 'dark' | 'light';
}

const Tab = ({ type, label, count, activeFilter, setActiveFilter, colorMode }: TabProps) => (
  <button
    onClick={() => setActiveFilter(type)}
    className={cn(
      "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2",
      activeFilter === type
        ? (colorMode === 'dark' ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-900")
        : "text-slate-500 hover:bg-slate-500/10"
    )}
  >
    {label}
    <span className={cn(
      "px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
      activeFilter === type
          ? (colorMode === 'dark' ? "bg-slate-600" : "bg-slate-300")
          : (colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100")
    )}>
      {count}
    </span>
  </button>
);

export const LogModal: React.FC = () => {
  const logs = useFlowStore((state) => state.logs);
  const isOpen = useFlowStore((state) => state.isLogModalOpen);
  const setOpen = useFlowStore((state) => state.setLogModalOpen);
  const clearLogs = useFlowStore((state) => state.clearLogs);
  const colorMode = useFlowStore((state) => state.colorMode);

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (activeFilter !== 'all') {
      result = result.filter(l => {
        if (activeFilter === 'error') return l.level === 'error' || l.level === 'fatal';
        return l.level === activeFilter;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => l.message.toLowerCase().includes(q));
    }
    return [...result].reverse();
  }, [logs, activeFilter, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: logs.length,
      error: logs.filter(l => l.level === 'error' || l.level === 'fatal').length,
      warn: logs.filter(l => l.level === 'warn').length,
      info: logs.filter(l => l.level === 'info').length,
    };
  }, [logs]);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      showBlur={false}
      showOverlay={false}
      alignClass="items-start pt-20"
      title="Console Logs"
      subtitle="History of application events"
      icon={Bell}
      iconColorClass="text-slate-500"
      widthClass="w-[900px]"
      footer={
        <div className="flex justify-between items-center w-full">
          <p className="text-xs text-slate-500">Logs are persisted in local storage (last 500 entries).</p>
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
      <div className="flex flex-col gap-4 h-full">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-slate-500/5 p-1 rounded-lg">
            <Tab type="all" label="All" count={counts.all} activeFilter={activeFilter} setActiveFilter={setActiveFilter} colorMode={colorMode} />
            <Tab type="error" label="Errors" count={counts.error} activeFilter={activeFilter} setActiveFilter={setActiveFilter} colorMode={colorMode} />
            <Tab type="warn" label="Warnings" count={counts.warn} activeFilter={activeFilter} setActiveFilter={setActiveFilter} colorMode={colorMode} />
            <Tab type="info" label="Info" count={counts.info} activeFilter={activeFilter} setActiveFilter={setActiveFilter} colorMode={colorMode} />
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-9 pr-4 py-2 text-xs rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
              )}
            />
          </div>
        </div>

        <div className="space-y-2 flex-1">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <Bell size={48} strokeWidth={1} />
              <p>{searchQuery ? "No logs matching your search." : "No logs recorded in this category."}</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
                let badgeClass = 'bg-blue-400/10 text-blue-400';
                if (log.level === 'error' || log.level === 'fatal') {
                    badgeClass = 'bg-red-500/10 text-red-500';
                } else if (log.level === 'warn') {
                    badgeClass = 'bg-amber-500/10 text-amber-500';
                }

                return (
                    <div
                        key={log.id}
                        className={cn(
                        'p-3 rounded-lg border flex flex-col gap-1',
                        colorMode === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50/50 border-slate-200/50'
                        )}
                    >
                        <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {(log.level === 'error' || log.level === 'fatal') && (
                            <AlertCircle size={14} className="text-red-500" />
                            )}
                            {log.level === 'warn' && (
                            <AlertTriangle size={14} className="text-amber-500" />
                            )}
                            {log.level === 'info' && (
                            <Info size={14} className="text-blue-400" />
                            )}
                            <span
                            className={cn(
                                'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                                badgeClass
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
                        <pre className={cn(
                        "text-xs font-mono whitespace-pre-wrap break-all mt-1 leading-relaxed",
                        colorMode === 'dark' ? "text-slate-300" : "text-slate-700"
                        )}>
                        {log.message}
                        </pre>
                    </div>
                );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
