import React from 'react';
import { X as CloseIcon, Activity, Info, FileCode, Play, Monitor } from 'lucide-react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';

export const CanvasConfigModal = () => {
  const isOpen = useFlowStore((state) => state.isCanvasConfigOpen);
  const setOpen = useFlowStore((state) => state.setCanvasConfigOpen);
  const visibleWidgets = useFlowStore((state) => state.visibleWidgets);
  const toggleWidget = useFlowStore((state) => state.toggleWidget);
  const colorMode = useFlowStore((state) => state.colorMode);

  if (!isOpen) return null;

  const widgets = [
    { id: 'hardware-budget', label: 'Hardware Budget', description: 'Monitor local CPU and RAM capacity', icon: Activity },
    { id: 'object-stats', label: 'Object Statistics', description: 'Total objects and validation status', icon: Info },
    { id: 'inspector-btn', label: 'YAML Inspector', description: 'Quick access to live YAML export', icon: FileCode },
    { id: 'target-indicator', label: 'Target Indicator', description: 'Highlights the active deployment context', icon: Play },
  ];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={cn(
          "w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden transform transition-all animate-in zoom-in-95 duration-200",
          colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}
      >
        {/* Header */}
        <div className={cn(
          "px-6 py-4 border-b flex items-center justify-between",
          colorMode === 'dark' ? "border-slate-800 bg-slate-900/50" : "border-slate-100 bg-slate-50"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <Monitor size={20} />
            </div>
            <div>
              <h2 className={cn("text-sm font-bold", colorMode === 'dark' ? "text-white" : "text-slate-900")}>Canvas Settings</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Configure visible overlay widgets</p>
            </div>
          </div>
          <button 
            onClick={() => setOpen(false)}
            className={cn(
              "p-2 rounded-full transition-colors",
              colorMode === 'dark' ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
            )}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {widgets.map((widget) => {
            const isVisible = visibleWidgets.includes(widget.id);
            const isDark = colorMode === 'dark';

            let btnClass = "";
            if (isVisible) {
              btnClass = isDark ? "bg-blue-500/10 border-blue-500/50" : "bg-blue-50 border-blue-200";
            } else {
              btnClass = isDark ? "bg-slate-800/20 border-slate-800 hover:border-slate-700" : "bg-slate-50 border-slate-100 hover:border-slate-200";
            }

            let iconWrapperClass = "";
            if (isVisible) {
              iconWrapperClass = "bg-blue-500 text-white shadow-lg shadow-blue-500/20";
            } else {
              iconWrapperClass = isDark ? "bg-slate-800 text-slate-500" : "bg-slate-200 text-slate-500";
            }

            return (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                className={cn(
                  "w-full p-3 rounded-xl border flex items-start gap-4 transition-all text-left group",
                  btnClass
                )}
              >
                <div className={cn(
                  "p-2.5 rounded-lg transition-colors",
                  iconWrapperClass
                )}>
                  <widget.icon size={18} />
                </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn("text-xs font-bold", colorMode === 'dark' ? "text-slate-200" : "text-slate-800")}>
                    {widget.label}
                  </span>
                  <div className={cn(
                    "w-8 h-4 rounded-full relative transition-colors",
                    visibleWidgets.includes(widget.id) ? "bg-blue-500" : "bg-slate-500/30"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm",
                      visibleWidgets.includes(widget.id) ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {widget.description}
                </p>
              </div>
            </button>
          );
        })}
        </div>

        {/* Footer */}
        <div className={cn(
          "px-6 py-4 border-t text-center",
          colorMode === 'dark' ? "border-slate-800 bg-slate-900/50" : "border-slate-100 bg-slate-50"
        )}>
          <button
            onClick={() => setOpen(false)}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
