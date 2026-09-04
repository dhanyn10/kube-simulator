import React from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import { Plus, Minus, Maximize, Minimize } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { useFitView } from '../../hooks/useFitView';

export const CanvasControlsPanel: React.FC = () => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const isAutofocusEnabled = useFlowStore((state) => state.isAutofocusEnabled);
  const toggleAutofocus = useFlowStore((state) => state.toggleAutofocus);

  const { zoomIn, zoomOut } = useReactFlow();
  const fitView = useFitView();

  const btnClass = cn(
    'p-2 rounded-md transition-colors shadow-xl cursor-pointer',
    colorMode === 'dark'
      ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400'
      : 'bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-600'
  );

  return (
    <Panel position="top-left" className="m-4 flex flex-col gap-2">
      <button type="button" onClick={() => zoomIn()} className={btnClass} title="Zoom In">
        <Plus size={16} />
      </button>
      <button type="button" onClick={() => zoomOut()} className={btnClass} title="Zoom Out">
        <Minus size={16} />
      </button>
      <button type="button" onClick={() => fitView({ padding: 0.1, duration: 800 })} className={btnClass} title="Fit View">
        <Maximize size={16} />
      </button>
      <button
        type="button"
        onClick={() => toggleAutofocus()}
        className={cn(
          btnClass,
          isAutofocusEnabled &&
            (colorMode === 'dark' ? 'bg-blue-600/30 text-blue-400 border-blue-500/50' : 'bg-blue-100 text-blue-600 border-blue-300')
        )}
        title={isAutofocusEnabled ? 'Disable Autofocus' : 'Enable Autofocus'}
      >
        <Minimize size={16} />
      </button>
    </Panel>
  );
};
