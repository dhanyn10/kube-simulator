import React, { useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Panel,
  BackgroundVariant,
  useReactFlow,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { logger } from './lib/logger';
import { Sidebar, RightSidebar, MenuBar } from './components/Layout';
import { TerminalPanel } from './activity/terminal';
import { CanvasControlsPanel } from './components/Layout/CanvasControlsPanel';
import { ContextMenu, ResourceManager, SidebarContextMenu } from './components/UI';
import { MonitoringDashboard, DetachedMonitoring, LogToast } from './components/Monitoring';
import {
  YamlModal,
  ScenarioModal,
  LogModal,
  AboutDialog,
  SettingsModal,
  RoleModal,
  ConfigMapModal,
  SecretModal,
  HPAModal,
  KubeIAMModal,
} from './components/Modals';
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
  RoleNode,
} from './components/Nodes';
import { CustomEdge } from './components/Edges';
import { cn } from './lib/utils';
import { useFlowStore } from './store';
import { useHistory } from './hooks/useHistory';
import { useDropHandler } from './hooks/useDropHandler';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useFileSystem } from './hooks/useFileSystem';
import { useThemeSync } from './hooks/useThemeSync';
import { useCanvasHandlers } from './hooks/useCanvasHandlers';
import { useAppInit, useAttachmentHandlers } from './hooks/useAppHelpers';

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
  Role: RoleNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const defaultEdgeOptions = {
  type: 'custom',
  interactionWidth: 20,
  reconnectable: 'target' as const,
};

export default function App() {
  useThemeSync();
  const [searchParams] = useState(() => new URLSearchParams(globalThis.location.search));
  const isDetachedMode = searchParams.get('mode') === 'monitoring';

  useEffect(() => {
    logger.info('[App] Render mode:', isDetachedMode ? 'monitoring' : 'canvas');
  }, [isDetachedMode]);

  // @ts-ignore
  if (globalThis !== undefined) globalThis.useFlowStore = useFlowStore;

  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const onNodesChange = useFlowStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange);
  const onConnect = useFlowStore((state) => state.onConnect);
  const onReconnect = useFlowStore((state) => state.onReconnect);
  const addNode = useFlowStore((state) => state.addNode);
  const deleteNodes = useFlowStore((state) => state.deleteNodes);
  const onPaneClick = useFlowStore((state) => state.onPaneClick);
  const onNodeDragStart = useFlowStore((state) => state.onNodeDragStart);
  const onNodeDrag = useFlowStore((state) => state.onNodeDrag);
  const onNodeDragStop = useFlowStore((state) => state.onNodeDragStop);
  const colorMode = useFlowStore((state) => state.colorMode);
  const isSidebarVisible = useFlowStore((state) => state.isSidebarVisible);
  const isRightSidebarVisible = useFlowStore((state) => state.isRightSidebarVisible);
  const setGlobalEdgeColors = useFlowStore((state) => state.setGlobalEdgeColors);
  const copyNodes = useFlowStore((state) => state.copyNodes);
  const pasteNodes = useFlowStore((state) => state.pasteNodes);
  const groupNodes = useFlowStore((state) => state.groupNodes);
  const ungroupNodes = useFlowStore((state) => state.ungroupNodes);
  const setSystemResources = useFlowStore((state) => state.setSystemResources);
  const canvasBgVariant = useFlowStore((state) => state.canvasBgVariant);
  const canvasBgColor = useFlowStore((state) => state.canvasBgColor);
  const canvasBgOpacity = useFlowStore((state) => state.canvasBgOpacity);
  const loadSettingsJson = useFlowStore((state) => state.loadSettingsJson);
  const isIamModalOpen = useFlowStore((state) => state.isIamModalOpen);
  const setIamModalOpen = useFlowStore((state) => state.setIamModalOpen);

  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isScenarioOpen, setIsScenarioOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const defaultBgColor = colorMode === 'dark' ? '#334155' : '#94A3B8';
  const finalCanvasBgColor = canvasBgColor === 'default' ? defaultBgColor : canvasBgColor;

  const [defaultContextMenu, setDefaultContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('#canvas-main')) {
        return;
      }
      e.preventDefault();
      setDefaultContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleClose = () => setDefaultContextMenu(null);

    window.addEventListener('contextmenu', handleGlobalContextMenu);
    window.addEventListener('click', handleClose);
    return () => {
      window.removeEventListener('contextmenu', handleGlobalContextMenu);
      window.removeEventListener('click', handleClose);
    };
  }, []);

  useAppInit(isDetachedMode, loadSettingsJson, setGlobalEdgeColors, setSystemResources, setIsAboutDialogOpen);

  const { screenToFlowPosition } = useReactFlow();
  const { handleUndo, handleRedo } = useHistory();
  const { handleExportFile, handleImportFile } = useFileSystem(nodes, edges);
  const { onDragOver, onDragLeave, onDrop } = useDropHandler(screenToFlowPosition);

  const {
    contextMenu,
    setContextMenu,
    isYamlOpen,
    setIsYamlOpen,
    yamlContent,
    onNodeContextMenu,
    onPaneContextMenu,
    onNodeClick,
    onEdgeClick,
    handleExport,
  } = useCanvasHandlers();

  const {
    roleModalTargetNode,
    setRoleModalTargetNode,
    configMapModalTargetNode,
    setConfigMapModalTargetNode,
    secretModalTargetNode,
    setSecretModalTargetNode,
    hpaModalTargetNode,
    setHpaModalTargetNode,
    handleRoleSave,
    handleConfigMapSave,
    handleSecretSave,
    handleHpaSave,
  } = useAttachmentHandlers();

  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onCopy: copyNodes,
    onPaste: pasteNodes,
    onGroup: () => {
      const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
      if (selectedIds.length > 1) groupNodes(selectedIds);
    },
    onUngroup: () => {
      const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
      if (selectedIds.length > 0) ungroupNodes(selectedIds);
    },
  });

  if (isDetachedMode) {
    return <DetachedMonitoring />;
  }

  return (
    <div
      className={cn(
        'flex flex-col h-screen w-screen overflow-hidden font-sans antialiased',
        colorMode === 'dark' ? 'bg-slate-950 text-slate-200 dark' : 'bg-white text-slate-800 light'
      )}
    >
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
            onDragLeave={onDragLeave}
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
              className={cn(
                'rounded-lg shadow-2xl !m-12',
                colorMode === 'dark' ? '!bg-slate-900 !border-slate-800' : '!bg-slate-100 !border-slate-300'
              )}
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

            <CanvasControlsPanel />

            <Panel position="top-right" className="p-4 flex flex-col gap-3 items-end" />
          </ReactFlow>

          {isYamlOpen && (
            <YamlModal
              content={yamlContent}
              colorMode={colorMode}
              onClose={() => setIsYamlOpen(false)}
            />
          )}

          <ScenarioModal isOpen={isScenarioOpen} onClose={() => setIsScenarioOpen(false)} />

          <MonitoringDashboard />

          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onInspect={handleExport}
              onDelete={() => deleteNodes(nodes.filter((n) => n.selected))}
            />
          )}

          <AboutDialog isOpen={isAboutDialogOpen} onClose={() => setIsAboutDialogOpen(false)} />

          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

          <RoleModal
            isOpen={roleModalTargetNode !== null}
            onClose={() => setRoleModalTargetNode(null)}
            targetNodeId={roleModalTargetNode?.id || null}
            targetNodeLabel={roleModalTargetNode?.label}
            onSave={handleRoleSave}
          />

          <ConfigMapModal
            isOpen={configMapModalTargetNode !== null}
            onClose={() => setConfigMapModalTargetNode(null)}
            targetNodeId={configMapModalTargetNode?.id || null}
            targetNodeLabel={configMapModalTargetNode?.label}
            onSave={handleConfigMapSave}
          />

          <SecretModal
            isOpen={secretModalTargetNode !== null}
            onClose={() => setSecretModalTargetNode(null)}
            targetNodeId={secretModalTargetNode?.id || null}
            targetNodeLabel={secretModalTargetNode?.label}
            onSave={handleSecretSave}
          />

          <HPAModal
            isOpen={hpaModalTargetNode !== null}
            onClose={() => setHpaModalTargetNode(null)}
            targetNodeId={hpaModalTargetNode?.id || null}
            targetNodeLabel={hpaModalTargetNode?.label}
            onSave={handleHpaSave}
          />

          <KubeIAMModal
            isOpen={isIamModalOpen}
            onClose={() => setIamModalOpen(false)}
          />

          <ResourceManager isOpen={isProjectOpen} onClose={() => setIsProjectOpen(false)} />

          <LogToast />
          <LogModal />
          <TerminalPanel />
        </main>

        {isRightSidebarVisible && <RightSidebar onExportYaml={handleExport} />}
      </div>

      {defaultContextMenu && (
        <SidebarContextMenu
          x={defaultContextMenu.x}
          y={defaultContextMenu.y}
          colorMode={colorMode}
          toggleColorMode={useFlowStore.getState().toggleColorMode}
          onCloseContextMenu={() => setDefaultContextMenu(null)}
          testId="global-default-context-menu"
          changeThemeTestId="global-change-theme"
          closeTestId="global-close"
        />
      )}
    </div>
  );
}
