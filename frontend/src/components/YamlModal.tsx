import React from 'react';
import { X, CheckCircle2, Copy, Terminal, Save, Cloud } from 'lucide-react';
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

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Main YAML Viewer */}
          <div className={cn('flex-1 p-6 font-mono text-[11px] leading-relaxed overflow-auto select-all', colorMode === 'dark' ? 'bg-slate-950 text-emerald-500/90' : 'bg-slate-50 text-emerald-700/90')}>
            <pre>{content || '# No resources generated yet.'}</pre>
          </div>

          {/* Guidance Section */}
          <div className={cn('w-full md:w-64 border-l p-4 flex flex-col gap-4 overflow-auto', colorMode === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-200')}>
            <h3 className={cn('text-[10px] font-bold uppercase tracking-wider flex items-center gap-2', colorMode === 'dark' ? 'text-slate-400' : 'text-slate-600')}>
              <CheckCircle2 size={12} className="text-emerald-500" />
              Deployment Guide
            </h3>

            <div className="flex flex-col gap-5">
              <div className="flex gap-3">
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold', colorMode === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600')}>1</div>
                <div className="flex flex-col gap-1.5">
                  <span className={cn('text-[10px] font-bold uppercase', colorMode === 'dark' ? 'text-slate-300' : 'text-slate-700')}>Copy Manifest</span>
                  <p className={cn('text-[10px] leading-relaxed', colorMode === 'dark' ? 'text-slate-500' : 'text-slate-500')}>Use the button below to copy the YAML content to your clipboard.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold', colorMode === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600')}>2</div>
                <div className="flex flex-col gap-1.5">
                  <span className={cn('text-[10px] font-bold uppercase', colorMode === 'dark' ? 'text-slate-300' : 'text-slate-700')}>Save to File</span>
                  <p className={cn('text-[10px] leading-relaxed', colorMode === 'dark' ? 'text-slate-500' : 'text-slate-500')}>Create a new file named <code className="bg-slate-800 px-1 rounded text-blue-400">infra.yaml</code> and paste the content.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold', colorMode === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600')}>3</div>
                <div className="flex flex-col gap-1.5">
                  <span className={cn('text-[10px] font-bold uppercase', colorMode === 'dark' ? 'text-slate-300' : 'text-slate-700')}>Apply to Cluster</span>
                  <div className={cn('p-2 rounded font-mono text-[9px] mt-1', colorMode === 'dark' ? 'bg-slate-950 text-slate-400' : 'bg-slate-200 text-slate-700')}>
                    kubectl apply -f infra.yaml
                  </div>
                </div>
              </div>
            </div>

            <div className={cn('mt-auto p-3 rounded border border-dashed flex flex-col gap-2', colorMode === 'dark' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200')}>
              <span className={cn('text-[9px] font-bold uppercase text-blue-500')}>Pro Tip</span>
              <p className={cn('text-[9px] leading-normal', colorMode === 'dark' ? 'text-slate-400' : 'text-slate-600')}>Ensure your <code className="bg-slate-800 px-1 rounded">kubeconfig</code> is pointed to the correct cluster before applying.</p>
            </div>
          </div>
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
