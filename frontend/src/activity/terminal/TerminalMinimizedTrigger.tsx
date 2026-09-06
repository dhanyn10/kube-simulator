import { Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface TerminalMinimizedTriggerProps {
  setTerminalOpen: (open: boolean) => void;
  isSimulating: boolean;
  colorMode: 'dark' | 'light';
}

export const TerminalMinimizedTrigger = ({
  setTerminalOpen,
  isSimulating,
  colorMode,
}: TerminalMinimizedTriggerProps) => {
  const isDark = colorMode === 'dark';
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[50]">
      <button
        type="button"
        onClick={() => setTerminalOpen(true)}
        className={cn(
          "terminal-trigger-btn",
          isDark
            ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-700"
        )}
      >
        <Terminal size={14} className="text-blue-500 animate-pulse" />
        Kube Terminal {isSimulating && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping" />}
      </button>
    </div>
  );
};
