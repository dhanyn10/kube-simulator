import { logger } from './lib/logger';
import React, { useCallback, useState, useEffect } from 'react';
import { GetSystemResources } from '@wailsjs/go/main/App.js';
import {
  ReactFlow,
  Background,
  Panel,
  BackgroundVariant,
  useReactFlow,
  MiniMap,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EventsOn } from '../wailsjs/runtime'; // Corrected import path

import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import { MenuBar } from './components/MenuBar';
import { AlignmentGuides } from './components/AlignmentGuides';
import { HistoryPanel } from './components/HistoryPanel';
import { YamlModal } from './components/YamlModal';
import { PodNode } from './components/Nodes/Pod';
import { ServiceNode } from './components/Nodes/Service';
import { DeploymentNode } from './components/Nodes/Deployment';
import { ConfigMapNode } from './components/Nodes/ConfigMap';
import { SecretNode } from './components/Nodes/Secret';
import { ScenarioModal } from './components/ScenarioModal';
import { InternetNode } from './components/Nodes/Internet';
import { NamespaceNode } from './components/Nodes/Namespace';
import { IngressNode } from './components/Nodes/Ingress';
import { HPANode } from './components/Nodes/HPA';
import { PVCNode } from './components/Nodes/PVC';
import { ReplicaSetNode } from './components/Nodes/ReplicaSet';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { DetachedMonitoring } from './components/DetachedMonitoring';
import { ContextMenu } from './components/ContextMenu';
import { LogToast } from './components/LogToast';
import { LogModal } from './components/LogModal';
import CustomEdge from './components/Edges/CustomEdge';
import { generateYaml, cn, getAbsPos } from './lib/utils';
import { Plus, Minus, Maximize, Minimize } from 'lucide-react';
import { useFlowStore } from './store';
import { useHistory } from './hooks/useHistory';
import { useDropHandler } from './hooks/useDropHandler';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useFileSystem } from './hooks/useFileSystem';
import { useFitView } from './hooks/useFitView';
import AboutDialog from './components/AboutDialog'; // Import AboutDialog

const nodeTypes = {
  Pod: PodNode,
  Service: ServiceNode,
  Deployment: DeploymentNode,
  Internet: InternetNode,
  Namespace: NamespaceNode,
  Ingress: IngressNode,
  HPA: HPANode,
  PVC: PVCNode,
  ConfigMap: ConfigMapNode,
  Secret: SecretNode,
  ReplicaSet: ReplicaSetNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const defaultEdgeOptions = {
  type: 'custom',
};

export default function App() {
  const [searchParams] = useState(() => new URLSearchParams(globalThis.location.search));
  const isDetachedMode = searchParams.get('mode') === 'monitoring';

  logger.info('[App] Render mode:', isDetachedMode ? 'monitoring' : 'canvas');

  // Expose store for e2e testing
  // @ts-ignore
  if (typeof globalThis !== 'undefined') globalThis.useFlowStore = useFlowStore;

  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const onNodesChange = useFlowStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange);
  const onConnect = useFlowStore((state) => state.onConnect);
  const onReconnect = useFlowStore((state) => state.onReconnect);
  const addNode = useFlowStore((state) => state.addNode);
  const deleteNodes = useFlowStore((state) => state.deleteNodes);
  const onNodeClickStore = useFlowStore((state) => state.onNodeClick);
  const onPaneClick = useFlowStore((state) => state.onPaneClick);
  const onNodeDragStart = useFlowStore((state) => state.onNodeDragStart);
  const onNodeDrag = useFlowStore((state) => state.onNodeDrag);
  const onNodeDragStop = useFlowStore((state) => state.onNodeDragStop);
  const colorMode = useFlowStore((state) => state.colorMode);
  const isSidebarVisible = useFlowStore((state) => state.isSidebarVisible);
  const isRightSidebarVisible = useFlowStore((state) => state.isRightSidebarVisible);
  const isAutofocusEnabled = useFlowStore((state) => state.isAutofocusEnabled);
  const setSidebarVisible = useFlowStore((state) => state.setSidebarVisible);
  const setRightSidebarVisible = useFlowStore((state) => state.setRightSidebarVisible);
  const setGlobalEdgeColors = useFlowStore((state) => state.setGlobalEdgeColors);
  const copyNodes = useFlowStore((state) => state.copyNodes);
  const pasteNodes = useFlowStore((state) => state.pasteNodes);
  const groupNodes = useFlowStore((state) => state.groupNodes);
  const ungroupNodes = useFlowStore((state) => state.ungroupNodes);
  const setSystemResources = useFlowStore((state) => state.setSystemResources);
  const toggleAutofocus = useFlowStore((state) => state.toggleAutofocus);

  const [isYamlOpen, setIsYamlOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isScenarioOpen, setIsScenarioOpen] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false); // State for About dialog

  useEffect(() => {
    if (!isDetachedMode) {
      // Load sidebar settings
      if (globalThis.go?.main?.App?.GetSetting) {
        globalThis.go.main.App.GetSetting('isSidebarVisible').then((val: string) => {
          if (val !== "") setSidebarVisible(val === 'true');
        });
        globalThis.go.main.App.GetSetting('isRightSidebarVisible').then((val: string) => {
          if (val !== "") setRightSidebarVisible(val === 'true');
        });

        // Load global edge colors
        Promise.all([
          globalThis.go.main.App.GetSetting('globalEdgeColor'),
          globalThis.go.main.App.GetSetting('globalEdgeErrorColor')
        ]).then(([color, errorColor]: [string, string]) => {
          if (color !== "" || errorColor !== "") {
            setGlobalEdgeColors(
              color || 'var(--color-mat-indigo)',
              errorColor || 'var(--color-mat-red)'
            );
          }
        });
      }

      const fetchResources = () => {
        // Safety check for Wails binding
        if (typeof GetSystemResources === 'function') {
          GetSystemResources().then((resources: any) => {
            setSystemResources(resources);
          }).catch(err => {
            logger.error('[App] Failed to fetch system resources:', err);
          });
        }
      };

      fetchResources();
      const interval = setInterval(fetchResources, 5000);
      return () => clearInterval(interval);
    }
  }, [isDetachedMode, setSystemResources]);

  // Effect to listen for the 'openAboutDialog' event
  useEffect(() => {
    const unsubscribe = EventsOn('openAboutDialog', () => {
      setIsAboutDialogOpen(true);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const { zoomIn, zoomOut, screenToFlowPosition, setCenter } = useReactFlow();
  const fitView = useFitView();
  const { handleUndo, handleRedo } = useHistory();
  const { handleExportFile, handleImportFile } = useFileSystem(nodes, edges);
  const { onDragOver, onDrop } = useDropHandler(screenToFlowPosition);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      // If node not selected, select only this node
      if (!node.selected) {
        useFlowStore.setState({
          nodes: nodes.map(n => ({ ...n, selected: n.id === node.id }))
        });
      }
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [nodes, setContextMenu]
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [setContextMenu]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodeClickStore(event, node);
      if (isAutofocusEnabled) {
        const absPos = getAbsPos(node.id, nodes);
        const centerX = absPos.x + (node.measured?.width ?? node.width ?? 0) / 2;
        const centerY = absPos.y + (node.measured?.height ?? node.height ?? 0) / 2;
        setCenter(centerX, centerY, { zoom: 1.8, duration: 800 });
      }
    },
    [onNodeClickStore, isAutofocusEnabled, setCenter, nodes]
  );

  const handleExport = useCallback(async () => {
    const content = await generateYaml(nodes, edges);
    setYamlContent(content);
    setIsYamlOpen(true);
  }, [nodes, edges]);

  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onCopy: copyNodes,
    onPaste: pasteNodes,
    onGroup: () => {
      const selectedIds = nodes.filter(n => n.selected).map(n => n.id);
      if (selectedIds.length > 1) groupNodes(selectedIds);
    },
    onUngroup: () => {
      const selectedIds = nodes.filter(n => n.selected).map(n => n.id);
      if (selectedIds.length > 0) ungroupNodes(selectedIds);
    }
  });

  if (isDetachedMode) {
    return <DetachedMonitoring />;
  }

  const btnClass = cn(
    'p-2 rounded-md transition-colors shadow-xl',
    colorMode === 'dark'
      ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400'
      : 'bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-600'
  );

  return (
    <div className={cn(
      'flex flex-col h-screen w-screen overflow-hidden font-sans antialiased',
      colorMode === 'dark' ? 'bg-slate-950 text-slate-200 dark' : 'bg-white text-slate-800 light'
    )}>
      <MenuBar
        onExportYaml={handleExport}
        onImportFile={handleImportFile}
        onSaveFile={handleExportFile}
        onOpenProjects={() => setIsProjectOpen(true)}
        onOpenScenarios={() => setIsScenarioOpen(true)}
        onOpenAbout={() => setIsAboutDialogOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {isSidebarVisible && (
          <Sidebar
            onAddNode={addNode}
            isProjectOpen={isProjectOpen}
            setIsProjectOpen={setIsProjectOpen}
          />
        )}

        <main className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodesDelete={deleteNodes}
          deleteKeyCode={['Backspace', 'Delete']}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
          minZoom={0.5}
          maxZoom={1.8}
          className="bg-transparent"
          colorMode={colorMode}
        >
          <Background
            color={colorMode === 'dark' ? '#334155' : '#E2E8F0'}
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
          />

          <AlignmentGuides />

          <MiniMap
            position="bottom-right"
            className={cn('rounded-lg shadow-2xl !m-12', colorMode === 'dark' ? '!bg-slate-900 !border-slate-800' : '!bg-slate-100 !border-slate-300')}
            nodeColor={(node) => {
              if (node.type === 'Deployment') return '#8b5cf6';
              if (node.type === 'Pod') return '#22d3ee';
              if (node.type === 'Service') return '#f59e0b';
              return colorMode === 'dark' ? '#475569' : '#94A3B8';
            }}
            maskColor={colorMode === 'dark' ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.7)'}
            nodeStrokeWidth={3}
            zoomable
            pannable
          />

          {/* Left Controls Panel */}
          <Panel position="top-left" className="m-4 flex flex-col gap-2">
            <button onClick={() => zoomIn()} className={btnClass} title="Zoom In">
              <Plus size={16} />
            </button>
            <button onClick={() => zoomOut()} className={btnClass} title="Zoom Out">
              <Minus size={16} />
            </button>
            <button onClick={() => fitView({ padding: 0.1, duration: 800 })} className={btnClass} title="Fit View">
              <Maximize size={16} />
            </button>
            <button
              onClick={() => toggleAutofocus()}
              className={cn(
                btnClass,
                isAutofocusEnabled && (colorMode === 'dark' ? 'bg-blue-600/30 text-blue-400 border-blue-500/50' : 'bg-blue-100 text-blue-600 border-blue-300')
              )}
              title={isAutofocusEnabled ? "Disable Autofocus" : "Enable Autofocus"}
            >
              <Minimize size={16} />
            </button>
            <HistoryPanel colorMode={colorMode} />
          </Panel>

          {/* Right Info Panel (Floating widgets moved to RightSidebar) */}
          <Panel position="top-right" className="p-4 flex flex-col gap-3 items-end" />
        </ReactFlow>

          {isYamlOpen && (
            <YamlModal
              content={yamlContent}
              colorMode={colorMode}
              onClose={() => setIsYamlOpen(false)}
            />
          )}

          <ScenarioModal
            isOpen={isScenarioOpen}
            onClose={() => setIsScenarioOpen(false)}
          />

          <MonitoringDashboard />

          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onInspect={handleExport}
              onDelete={() => deleteNodes(nodes.filter(n => n.selected))}
            />
          )}

          {/* Render the AboutDialog */}
          <AboutDialog isOpen={isAboutDialogOpen} onClose={() => setIsAboutDialogOpen(false)} />

          <LogToast />
          <LogModal />
        </main>

        {isRightSidebarVisible && (
          <RightSidebar onExportYaml={handleExport} />
        )}
      </div>
    </div>
  );
}
