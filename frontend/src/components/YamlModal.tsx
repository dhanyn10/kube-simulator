import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface YamlModalProps {
  content: string;
  colorMode: 'dark' | 'light';
  onClose: () => void;
}

export function YamlModal({ content, colorMode, onClose }: YamlModalProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content).catch((err) => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm', colorMode === 'dark' ? 'bg-slate-950/80' : 'bg-white/80')}>
      <div className={cn('w-full max-w-2xl h-full max-h-[80vh] rounded shadow-2xl overflow-hidden flex flex-col', colorMode === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-300')}>
        <div className={cn('p-4 border-b flex items-center justify-between', colorMode === 'dark' ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50/50')}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <h2 className={cn('text-[10px] font-bold tracking-[0.2em] uppercase', colorMode === 'dark' ? 'text-slate-400' : 'text-slate-600')}>
              Kubernetes Manifest Output
            </h2>
          </div>
          <button onClick={onClose} className={cn('p-1.5 rounded transition-colors', colorMode === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-200 text-slate-500')}>
            <X size={16} />
          </button>
        </div>

        <div className={cn('flex-1 p-6 font-mono text-[11px] leading-relaxed overflow-auto select-all', colorMode === 'dark' ? 'bg-slate-950 text-emerald-500/90' : 'bg-slate-50 text-emerald-700/90')}>
          <pre>{content || '# No resources generated yet.'}</pre>
        </div>

        <div className={cn('p-3 border-t flex justify-end gap-2', colorMode === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')}>
          <button
            onClick={onClose}
            className={cn('px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors', colorMode === 'dark' ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
          >
            Close
          </button>
          <button onClick={handleCopy} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold uppercase shadow-lg shadow-blue-900/20 text-white">
            Copy Output
          </button>
        </div>
      </div>
    </div>
  );
}
