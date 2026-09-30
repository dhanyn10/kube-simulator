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
  MousePointer2,
  History
} from 'lucide-react';
import { HistoryPanel } from '@/components/Monitoring/HistoryPanel';
import { cn } from '@/lib/utils';
import { NodeConfig, EdgeConfig } from '@/components/Config';
import { ResourceBudget } from '@/components/Monitoring';
import { SidebarContextMenu } from '@/components/UI/SidebarContextMenu';
import {
  TabType,
  getRightSidebarTabClass,
  getRightSidebarDropdownToggleClass,
  useRightSidebar,
} from '@/activities/layout';

interface CanvasWidgetsPanelProps {
  nodes: any[];
  colorMode: 'dark' | 'light';
  visibleWidgets: string[];
}

export const CanvasWidgetsPanel = ({ nodes, colorMode, visibleWidgets }: CanvasWidgetsPanelProps) => {
  return (
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
            "right-sidebar-card",
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
            "right-sidebar-stat-card",
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
  );
};

interface SettingsPanelProps {
  selectedNode: any;
  selectedEdge: any;
  isElementSelected: boolean;
  colorMode: 'dark' | 'light';
}

export const SettingsPanel = ({ selectedNode, selectedEdge, isElementSelected, colorMode }: SettingsPanelProps) => {
  return (
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
            "right-sidebar-card min-h-[300px] overflow-visible",
            colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/50" : "bg-slate-50/50 border-slate-100"
          )}>
            {selectedEdge ? (
              <EdgeConfig selectedEdge={selectedEdge} />
            ) : (
              <NodeConfig selectedNode={selectedNode} />
            )}
          </div>

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
  );
};

interface SidebarTabBarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isCanvasDropdownOpen: boolean;
  setIsCanvasDropdownOpen: (open: boolean) => void;
  canvasDropdownRef: React.RefObject<HTMLDivElement | null>;
  canvasWidgets: any[];
  visibleWidgets: string[];
  toggleWidget: (id: string) => void;
  onExportYaml: () => void;
  colorMode: 'dark' | 'light';
}

export const SidebarTabBar = ({
  activeTab,
  setActiveTab,
  isCanvasDropdownOpen,
  setIsCanvasDropdownOpen,
  canvasDropdownRef,
  canvasWidgets,
  visibleWidgets,
  toggleWidget,
  onExportYaml,
  colorMode
}: SidebarTabBarProps) => {
  return (
    <div className={cn(
      "right-sidebar-tab-bar flex items-center",
      colorMode === 'dark' ? "bg-slate-950/50 border-slate-800" : "bg-slate-50/50 border-slate-200"
    )}>
      <div className="flex-1 flex h-8 mx-0.5 relative" ref={canvasDropdownRef}>
        <button
          type="button"
          onClick={() => setActiveTab('canvas')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 rounded-l-md text-[10px] font-bold uppercase tracking-wider transition-all px-1",
            getRightSidebarTabClass('canvas', activeTab, colorMode)
          )}
        >
          <Layers size={13} />
          <span className="truncate">Canvas</span>
        </button>
        <button
          type="button"
          data-testid="canvas-dropdown-toggle"
          onClick={() => {
            setIsCanvasDropdownOpen(!isCanvasDropdownOpen);
            setActiveTab('canvas');
          }}
          className={cn(
            "px-1 flex items-center justify-center border-l rounded-r-md transition-all",
            getRightSidebarDropdownToggleClass(activeTab, colorMode)
          )}
        >
          <ChevronDown size={11} className={cn("transition-transform", isCanvasDropdownOpen && "rotate-180")} />
        </button>

        {isCanvasDropdownOpen && (
          <div className={cn(
            "right-sidebar-dropdown-menu",
            colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          )}>
            {canvasWidgets.map((w) => (
              <button
                type="button"
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
              type="button"
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
        type="button"
        onClick={() => setActiveTab('settings')}
        className={cn(
          "flex-1 flex items-center justify-center gap-1 h-8 mx-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all px-1",
          getRightSidebarTabClass('settings', activeTab, colorMode)
        )}
      >
        <Layout size={13} />
        <span className="truncate">Settings</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('history')}
        className={cn(
          "flex-1 flex items-center justify-center gap-1 h-8 mx-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all px-1",
          getRightSidebarTabClass('history', activeTab, colorMode)
        )}
      >
        <History size={13} />
        <span className="truncate">History</span>
      </button>

    </div>
  );
};

export const RightSidebar = ({ onExportYaml }: { onExportYaml: () => void }) => {
  const {
    colorMode,
    toggleColorMode,
    isTerminalOpen,
    nodes,
    selectedNode,
    selectedEdge,
    isElementSelected,
    activeTab,
    handleTabChange,
    isCanvasDropdownOpen,
    setIsCanvasDropdownOpen,
    canvasDropdownRef,
    visibleWidgets,
    toggleWidget,
    canvasWidgets,
    contextMenu,
    handleContextMenu,
    closeContextMenu,
    handleCloseSidebar,
  } = useRightSidebar();

  return (
    <div
      id="right-sidebar"
      onContextMenu={handleContextMenu}
      className={cn(
        "right-sidebar-container w-72 border-l relative transition-all duration-300",
        colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
        isTerminalOpen ? "h-[calc(100vh-2.5rem-16rem)]" : "h-[calc(100vh-2.5rem)]"
      )}
    >
      {contextMenu && (
        <SidebarContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          colorMode={colorMode}
          toggleColorMode={toggleColorMode}
          onCloseSidebar={handleCloseSidebar}
          onCloseContextMenu={closeContextMenu}
          testId="right-sidebar-context-menu"
          changeThemeTestId="context-menu-change-theme"
          closeTestId="context-menu-close-sidebar"
        />
      )}
      <SidebarTabBar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isCanvasDropdownOpen={isCanvasDropdownOpen}
        setIsCanvasDropdownOpen={setIsCanvasDropdownOpen}
        canvasDropdownRef={canvasDropdownRef}
        canvasWidgets={canvasWidgets}
        visibleWidgets={visibleWidgets}
        toggleWidget={toggleWidget}
        onExportYaml={onExportYaml}
        colorMode={colorMode}
      />

      {/* Content Area */}
      <div className="right-sidebar-content-area custom-scrollbar">
        {activeTab === 'history' && (
          <div className="p-0 h-full flex flex-col">
            <HistoryPanel colorMode={colorMode} />
          </div>
        )}
        {activeTab === 'canvas' && (
          <CanvasWidgetsPanel
            nodes={nodes}
            colorMode={colorMode}
            visibleWidgets={visibleWidgets}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            isElementSelected={isElementSelected}
            colorMode={colorMode}
          />
        )}
      </div>
    </div>
  );
};
