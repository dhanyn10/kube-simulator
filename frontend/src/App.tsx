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
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EventsOn } from '../wailsjs/runtime';

import { Sidebar, RightSidebar, MenuBar, TerminalPanel } from './components/Layout';
import { ContextMenu, ResourceManager } from './components/UI';
import { HistoryPanel, MonitoringDashboard, DetachedMonitoring, LogToast } from './components/Monitoring';
import { YamlModal, ScenarioModal, LogModal, AboutDialog, SettingsModal } from './components/Modals';
import {
  PodNode,
  ServiceNode,
  DeploymentNode,
  ConfigMapNode,
  SecretNode,
  InternetNode,
  NamespaceNode,
  IngressNode,
  HPANode,
  PVCNode,
  ReplicaSetNode,
} from './components/Nodes';
import { CustomEdge } from './components/Edges';
import { generateYaml, cn, getAbsPos } from './lib/utils';
import { Plus, Minus, Maximize, Minimize } from 'lucide-react';
import { useFlowStore } from './store';
import { useHistory } from './hooks/useHistory';
import { useDropHandler } from './hooks/useDropHandler';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useFileSystem } from './hooks/useFileSystem';
import { useFitView } from './hooks/useFitView';
import { useThemeSync } from './hooks/useThemeSync';

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
  interactionWidth: 20,
  reconnectable: 'target' as const,
};

function useAppInit(isDetachedMode: boolean, loadSettingsJson: () => void, setGlobalEdgeColors: any, setSystemResources: any) {
  useEffect(() => {
    if (isDetachedMode) return;
    loadSettingsJson();

    if (globalThis.go?.main?.App?.GetSetting) {
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
      try {
        if (typeof globalThis.window !== 'undefined' && globalThis.window?.go?.main?.App?.GetSystemResources) {
          GetSystemResources().then((resources: any) => {
            if (resources) setSystemResources(resources);
          }).catch(err => {
            if (!String(err).includes('not registered')) {
              logger.error('[App] Failed to fetch system resources:', err);
            }
          });
        }
      } catch {
        // Silently ignore when running outside desktop Wails runtime or before callback registration
      }
    };

    fetchResources();
    const interval = setInterval(fetchResources, 5000);
    return () => clearInterval(interval);
  }, [isDetachedMode, loadSettingsJson, setGlobalEdgeColors, setSystemResources]);
}

function computeAutofocusZoom(node: Node) {
  let zoom = 1.5;
  const containerElement = document.querySelector('.react-flow__renderer');
  if (containerElement) {
    const rect = containerElement.getBoundingClientRect();
    const containerWidth = rect.width || 1024;
    const containerHeight = rect.height || 768;
    const padding = 0.08;
    const availableWidth = containerWidth * (1 - padding * 2);
    const availableHeight = containerHeight * (1 - padding * 2);

    const nodeW = node.measured?.width ?? node.width ?? 150;
    const nodeH = node.measured?.height ?? node.height ?? 100;

    const scaleX = availableWidth / nodeW;
    const scaleY = availableHeight / nodeH;

    zoom = Math.max(0.5, Math.min(1.5, Math.min(scaleX, scaleY)));
  }
  return zoom;
}

export default function App() {
  useThemeSync();
  const [searchParams] = useState(() => new URLSearchParams(globalThis.location.search));
  const isDetachedMode = searchParams.get('mode') === 'monitoring';

  useEffect(() => {
    logger.info('[App] Render mode:', isDetachedMode ? 'monitoring' : 'canvas');
  }, [isDetachedMode]);

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
  const setGlobalEdgeColors = useFlowStore((state) => state.setGlobalEdgeColors);
  const copyNodes = useFlowStore((state) => state.copyNodes);
  const pasteNodes = useFlowStore((state) => state.pasteNodes);
  const groupNodes = useFlowStore((state) => state.groupNodes);
  const ungroupNodes = useFlowStore((state) => state.ungroupNodes);
  const setSystemResources = useFlowStore((state) => state.setSystemResources);
  const toggleAutofocus = useFlowStore((state) => state.toggleAutofocus);
  const setConfiguringEdgeId = useFlowStore((state) => state.setConfiguringEdgeId);

  const [isYamlOpen, setIsYamlOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isScenarioOpen, setIsScenarioOpen] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const canvasBgVariant = useFlowStore((state) => state.canvasBgVariant);
  const canvasBgColor = useFlowStore((state) => state.canvasBgColor);
  const canvasBgOpacity = useFlowStore((state) => state.canvasBgOpacity);
  const loadSettingsJson = useFlowStore((state) => state.loadSettingsJson);

  const defaultBgColor = colorMode === 'dark' ? '#334155' : '#E2E8F0';
  const finalCanvasBgColor = canvasBgColor === 'default' ? defaultBgColor : canvasBgColor;

  useAppInit(isDetachedMode, loadSettingsJson, setGlobalEdgeColors, setSystemResources);

  useEffect(() => {
    const unsubscribe = EventsOn('openAboutDialog', () => {
      setIsAboutDialogOpen(true);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const { zoomIn, zoomOut, screenToFlowPosition, setCenter, fitBounds } = useReactFlow();
  const fitView = useFitView();
  const { handleUndo, handleRedo } = useHistory();
  const { handleExportFile, handleImportFile } = useFileSystem(nodes, edges);
  const { onDragOver, onDrop } = useDropHandler(screenToFlowPosition);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (!node.selected) {
        useFlowStore.setState({
          nodes: nodes.map(n => ({ ...n, selected: n.id === node.id }))
        });
      }
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [nodes]
  );

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodeClickStore(event, node);
      if (isAutofocusEnabled) {
        const absPos = getAbsPos(node.id, nodes);
        const nodeW = node.measured?.width ?? node.width ?? 150;
        const nodeH = node.measured?.height ?? node.height ?? 100;
        const centerX = absPos.x + nodeW / 2;
        const centerY = absPos.y + nodeH / 2;
        const zoom = computeAutofocusZoom(node);

        setCenter(centerX, centerY, { zoom, duration: 800 });
      }
    },
    [onNodeClickStore, isAutofocusEnabled, setCenter, nodes]
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (!isRightSidebarVisible) {
        useFlowStore.getState().setRightSidebarVisible(true);
      }
      setConfiguringEdgeId(edge.id);
      if (isAutofocusEnabled) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (sourceNode && targetNode) {
          const sourceAbsPos = getAbsPos(sourceNode.id, nodes);
          const targetAbsPos = getAbsPos(targetNode.id, nodes);

          const sourceW = sourceNode.measured?.width ?? sourceNode.width ?? 150;
          const sourceH = sourceNode.measured?.height ?? sourceNode.height ?? 100;
          const targetW = targetNode.measured?.width ?? targetNode.width ?? 150;
          const targetH = targetNode.measured?.height ?? targetNode.height ?? 100;

          const minX = Math.min(sourceAbsPos.x, targetAbsPos.x);
          const minY = Math.min(sourceAbsPos.y, targetAbsPos.y);
          const maxX = Math.max(sourceAbsPos.x + sourceW, targetAbsPos.x + targetW);
          const maxY = Math.max(sourceAbsPos.y + sourceH, targetAbsPos.y + targetH);

          fitBounds({
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          }, { padding: 0.2, duration: 800 });
        }
      }
    },
    [setConfiguringEdgeId, isAutofocusEnabled, nodes, fitBounds, isRightSidebarVisible]
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
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {isSidebarVisible && (
          <Sidebar
            onAddNode={addNode}
            isProjectOpen={isProjectOpen}
            setIsProjectOpen={setIsProjectOpen}
          />
        )}

        <main id="canvas-main" className="flex-1 relative">
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
          onEdgeClick={onEdgeClick}
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
          maxZoom={1.6}
          className="bg-transparent"
          colorMode={colorMode}
        >
          <Background
            color={finalCanvasBgColor}
            variant={canvasBgVariant === 'lines' ? BackgroundVariant.Lines : BackgroundVariant.Dots}
            gap={24}
            size={canvasBgVariant === 'lines' ? 1.5 : 2}
            style={{ opacity: canvasBgOpacity }}
          />

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
                isAutofocusEnabled && (colorMode === 'dark' ? 'bg-blue-600/30 text-blue-400 border-blue-500/50' : 'bg-blue-100 text-blue-600 border-blue-300')
              )}
              title={isAutofocusEnabled ? "Disable Autofocus" : "Enable Autofocus"}
            >
              <Minimize size={16} />
            </button>
            <HistoryPanel colorMode={colorMode} />
          </Panel>

          {/* Right Info Panel */}
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

          <AboutDialog isOpen={isAboutDialogOpen} onClose={() => setIsAboutDialogOpen(false)} />

          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

          <ResourceManager isOpen={isProjectOpen} onClose={() => setIsProjectOpen(false)} />

          <LogToast />
          <LogModal />
          <TerminalPanel />
        </main>

        {isRightSidebarVisible && (
          <RightSidebar onExportYaml={handleExport} />
        )}
      </div>
    </div>
  );
}
