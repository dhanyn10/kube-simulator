import { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Activity,
  Info,
  Layout,
  Layers,
  FileCode,
  Monitor,
  Check,
  ChevronDown,
  MousePointer2
} from 'lucide-react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { NodeConfig } from './NodeConfig';
import { EdgeConfig } from './EdgeConfig';
import { ResourceBudget } from './ResourceBudget';
import { ConfigSection } from './ConfigUI';

type TabType = 'canvas' | 'settings';

export const RightSidebar = ({ onExportYaml }: { onExportYaml: () => void }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const configuringNodeId = useFlowStore((state) => state.configuringNodeId);
  const configuringEdgeId = useFlowStore((state) => state.configuringEdgeId);

  const visibleWidgets = useFlowStore((state) => state.visibleWidgets);
  const toggleWidget = useFlowStore((state) => state.toggleWidget);

  const selectedNode = nodes.find(n => n.id === configuringNodeId);
  const selectedEdge = edges.find(e => e.id === configuringEdgeId);
  const isElementSelected = !!selectedNode || !!selectedEdge;

  const [activeTab, setActiveTab] = useState<TabType>('canvas');
  const [isCanvasDropdownOpen, setIsCanvasDropdownOpen] = useState(false);
  const canvasDropdownRef = useRef<HTMLDivElement>(null);

  // Switch to settings tab when a new element is selected
  useEffect(() => {
    if (isElementSelected) {
      setActiveTab('settings');
    }
  }, [isElementSelected, configuringNodeId, configuringEdgeId]);

  // Handle click outside for canvas dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (canvasDropdownRef.current && !canvasDropdownRef.current.contains(event.target as Node)) {
        setIsCanvasDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canvasWidgets = [
    { id: 'hardware-budget', label: 'Hardware Budget', icon: Activity },
    { id: 'object-stats', label: 'Object Statistics', icon: Info },
  ];

  const getDisplaySettings = () => {
    if (!selectedNode) return null;

    const data = selectedNode.data as any;
    const displaySettings = data.displaySettings || {};

    if (selectedNode.type !== 'Pod' && selectedNode.type !== 'Deployment') {
      return null;
    }

    const toggle = (field: string) => {
      const current = displaySettings[field] !== false;
      const updateNodeData = useFlowStore.getState().updateNodeData;
      updateNodeData(selectedNode.id, {
        displaySettings: { ...displaySettings, [field]: !current }
      });
    };

    const options = [
      { key: 'resources', label: 'Show Resources' },
      { key: 'image', label: 'Show Image' },
      { key: 'webserver', label: 'Show Web Server' },
      { key: 'runtime', label: 'Show Runtime' },
    ];

    return (
      <ConfigSection
        title="Display Settings"
        icon={Monitor}
      >
        <div className="space-y-2 mt-2">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggle(opt.key)}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center justify-between transition-all",
                displaySettings[opt.key] !== false
                  ? (colorMode === 'dark' ? "bg-blue-500/10 border-blue-500/50 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600")
                  : (colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300")
              )}
            >
              {opt.label}
              <div className={cn(
                "w-2 h-2 rounded-full transition-colors",
                displaySettings[opt.key] !== false ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-slate-700"
              )} />
            </button>
          ))}
        </div>
      </ConfigSection>
    );
  };

  return (
    <div className={cn(
      "w-72 border-l flex flex-col h-full shrink-0 z-10 transition-colors overflow-hidden",
      colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    )}>
      {/* Tab Bar */}
      <div className={cn(
        "h-10 border-b flex items-center px-1 shrink-0",
        colorMode === 'dark' ? "bg-slate-950/50 border-slate-800" : "bg-slate-50/50 border-slate-200"
      )}>
        <div className="flex-1 flex h-8 mx-1 relative" ref={canvasDropdownRef}>
          <button
            onClick={() => setActiveTab('canvas')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 rounded-l-md text-[10px] font-bold uppercase tracking-wider transition-all",
              activeTab === 'canvas'
                ? (colorMode === 'dark' ? "bg-slate-800 text-white" : "bg-white shadow-sm text-slate-900")
                : (colorMode === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")
            )}
          >
            <Layers size={14} />
            Canvas
          </button>
          <button
            data-testid="canvas-dropdown-toggle"
            onClick={() => setIsCanvasDropdownOpen(!isCanvasDropdownOpen)}
            className={cn(
              "px-1.5 flex items-center justify-center border-l rounded-r-md transition-all",
              activeTab === 'canvas'
                ? (colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-100 shadow-sm text-slate-900")
                : (colorMode === 'dark' ? "text-slate-500 hover:text-slate-300 border-transparent" : "text-slate-400 hover:text-slate-600 border-transparent")
            )}
          >
            <ChevronDown size={12} className={cn("transition-transform", isCanvasDropdownOpen && "rotate-180")} />
          </button>

          {isCanvasDropdownOpen && (
            <div className={cn(
              "absolute top-full left-0 mt-1 w-56 rounded-lg shadow-xl border py-1 z-[100] animate-in fade-in zoom-in-95 duration-100",
              colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}>
              {canvasWidgets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => toggleWidget(w.id)}
                  className={cn(
                    "w-full px-3 py-1.5 text-[10px] flex items-center justify-between transition-colors text-left",
                    colorMode === 'dark'
                      ? "hover:bg-slate-800 text-slate-300 hover:text-white"
                      : "hover:bg-slate-50 text-slate-700 hover:text-blue-700"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <w.icon size={12} className="opacity-70" />
                    <span className="font-medium uppercase tracking-wider">{w.label}</span>
                  </div>
                  {visibleWidgets.includes(w.id) && <Check size={12} className="text-blue-500" />}
                </button>
              ))}
              <div className={cn("h-px my-1", colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100")} />
              <button
                data-testid="open-yaml-inspector"
                onClick={() => {
                  onExportYaml();
                  setIsCanvasDropdownOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-1.5 text-[10px] flex items-center gap-2 transition-colors text-left",
                  colorMode === 'dark'
                    ? "hover:bg-slate-800 text-slate-300 hover:text-white"
                    : "hover:bg-slate-50 text-slate-700 hover:text-blue-700"
                )}
              >
                <FileCode size={12} className="opacity-70" />
                <span className="font-medium uppercase tracking-wider">Open YAML Inspector</span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-8 mx-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
            activeTab === 'settings'
              ? (colorMode === 'dark' ? "bg-slate-800 text-white" : "bg-white shadow-sm text-slate-900")
              : (colorMode === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")
          )}
        >
          <Layout size={14} />
          Settings
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8 overscroll-contain custom-scrollbar">
        {activeTab === 'canvas' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Hardware Budget Widget */}
            {visibleWidgets.includes('hardware-budget') && (
              <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-800/50">
                  <div className={cn(
                    "p-2 rounded-lg",
                    colorMode === 'dark' ? "bg-slate-800 text-emerald-400" : "bg-slate-100 text-emerald-600"
                  )}>
                    <Activity size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">Hardware Budget</h3>
                    <p className="text-[9px] text-slate-500 font-medium">Host resource tracking</p>
                  </div>
                </div>
                <div className={cn(
                  "p-4 rounded-xl border",
                  colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/50" : "bg-slate-50/50 border-slate-100"
                )}>
                  <ResourceBudget />
                </div>
              </div>
            )}

            {/* Statistics Widget */}
            {visibleWidgets.includes('object-stats') && (
              <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-800/50">
                  <div className={cn(
                    "p-2 rounded-lg",
                    colorMode === 'dark' ? "bg-slate-800 text-violet-400" : "bg-slate-100 text-violet-600"
                  )}>
                    <Info size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">Object Statistics</h3>
                    <p className="text-[9px] text-slate-500 font-medium">Visual status tracking</p>
                  </div>
                </div>

                <div className={cn(
                  "p-3 rounded-xl border flex items-center justify-between",
                  colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/50" : "bg-slate-50/50 border-slate-100"
                )}>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Active Objects</span>
                  <div className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-mono font-bold",
                    colorMode === 'dark' ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"
                  )}>
                    {nodes.length}
                  </div>
                </div>
              </div>
            )}

            {!visibleWidgets.length && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 pt-12 opacity-50">
                <Monitor size={48} className="text-slate-500" />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Canvas Info</p>
                  <p className="text-[9px] text-slate-500 max-w-[180px]">Enable widgets from the dropdown menu to see hardware and status info.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {isElementSelected ? (
              <>
                {/* Element Header */}
                <div className="flex items-center gap-3 pb-2 border-b border-slate-800/50">
                  <div className={cn(
                    "p-2 rounded-lg",
                    colorMode === 'dark' ? "bg-slate-800 text-blue-400" : "bg-slate-100 text-blue-600"
                  )}>
                    <Settings size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {selectedEdge ? 'Edge' : selectedNode?.type} Config
                    </h3>
                    <p className="text-[9px] text-slate-500 font-medium">Modify element properties</p>
                  </div>
                </div>

                {/* Main Config Panel */}
                <div className={cn(
                  "p-4 rounded-xl border min-h-[300px] overflow-visible",
                  colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/50" : "bg-slate-50/50 border-slate-100"
                )}>
                  {selectedEdge ? (
                    <EdgeConfig selectedEdge={selectedEdge} />
                  ) : (
                    <NodeConfig selectedNode={selectedNode} />
                  )}
                </div>

                {/* Display Settings */}
                {getDisplaySettings()}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 pt-12 opacity-50">
                <MousePointer2 size={48} className="text-slate-500" />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Settings</p>
                  <p className="text-[9px] text-slate-500 max-w-[180px]">Select an element on the canvas to view and modify its properties.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
