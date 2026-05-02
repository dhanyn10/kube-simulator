import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Panel,
  BackgroundVariant,
  useReactFlow,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Sidebar } from './components/Sidebar';
import { ConfigPanel } from './components/ConfigPanel';
import { AlignmentGuides } from './components/AlignmentGuides';
import { PodNode, ServiceNode, DeploymentNode } from './components/Nodes/K8sNodes';
import { generateYaml } from './lib/utils';
import { FileCode, Plus, Minus, X, Undo2, Redo2 } from 'lucide-react';
import { useFlowStore, applyHistoryState } from './store';
import { POD_MIN_DIMENSIONS } from './store/helpers';
import { cn } from './lib/utils';
import { K8sResourceType } from './types';

const nodeTypes = {
  Pod: PodNode,
  Service: ServiceNode,
  Deployment: DeploymentNode,
};

export default function App() {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const onNodesChange = useFlowStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange);
  const onConnect = useFlowStore((state) => state.onConnect);
  const addNode = useFlowStore((state) => state.addNode);
  const deleteNodes = useFlowStore((state) => state.deleteNodes);
  const onNodeClick = useFlowStore((state) => state.onNodeClick);
  const onPaneClick = useFlowStore((state) => state.onPaneClick);
  const onNodeDragStart = useFlowStore((state) => state.onNodeDragStart);
  const onNodeDrag = useFlowStore((state) => state.onNodeDrag);
  const onNodeDragStop = useFlowStore((state) => state.onNodeDragStop);
  const activeDeploymentId = useFlowStore((state) => state.activeDeploymentId);
  const colorMode = useFlowStore((state) => state.colorMode);
  const copyNodes = useFlowStore((state) => state.copyNodes);
  const pasteNodes = useFlowStore((state) => state.pasteNodes);

  const [isYamlOpen, setIsYamlOpen] = useState(false);
  const [yamlContent, setYamlContent] = useState('');

  const setHoveredDeploymentId = useFlowStore((state) => state.setHoveredDeploymentId);
  const draggingSidebarItem = useFlowStore((state) => state.draggingSidebarItem);

  const { zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();

  const handleUndo = useCallback(async () => {
    // @ts-ignore
    if (window.go?.main?.App?.Undo) {
        // @ts-ignore
        const state = await window.go.main.App.Undo();
        if (state) applyHistoryState(state);
    }
  }, []);

  const handleRedo = useCallback(async () => {
    // @ts-ignore
    if (window.go?.main?.App?.Redo) {
        // @ts-ignore
        const state = await window.go.main.App.Redo();
        if (state) applyHistoryState(state);
    }
  }, []);

  const getTargetDeployment = useCallback((clientX: number, clientY: number) => {
    const position = screenToFlowPosition({ x: clientX, y: clientY });
    
    const deployment = nodes.find(n => {
      if (n.type !== 'Deployment') return false;
      const w = n.width || n.measured?.width || 320;
      const h = n.height || n.measured?.height || 160;
      return (
        position.x >= n.position.x &&
        position.x <= n.position.x + w &&
        position.y >= n.position.y &&
        position.y <= n.position.y + h
      );
    });
    return deployment;
  }, [nodes, screenToFlowPosition]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (draggingSidebarItem === 'Pod') {
        const target = getTargetDeployment(event.clientX, event.clientY);
        setHoveredDeploymentId(target?.id || null);
        
        if (target) {
            useFlowStore.setState((state) => ({
                nodes: state.nodes.map(n => n.id === target.id ? { ...n, data: { ...n.data, isHovered: true } } : { ...n, data: { ...n.data, isHovered: false } })
            }));
        } else {
            useFlowStore.setState((state) => ({
                nodes: state.nodes.map(n => ({ ...n, data: { ...n.data, isHovered: false } }))
            }));
        }
    }
  }, [getTargetDeployment, setHoveredDeploymentId, draggingSidebarItem]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as K8sResourceType;
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const centerOffsets = {
        Pod: { x: POD_MIN_DIMENSIONS.width / 2, y: POD_MIN_DIMENSIONS.height / 2 },
        Deployment: { x: 160, y: 80 },
        Service: { x: 90, y: 60 },
        Namespace: { x: 200, y: 150 },
      };

      const offset = centerOffsets[type as keyof typeof centerOffsets] || { x: 0, y: 0 };
      const centeredPosition = {
        x: position.x - offset.x,
        y: position.y - offset.y,
      };

      const targetDeployment = getTargetDeployment(event.clientX, event.clientY);
      setHoveredDeploymentId(null);
      useFlowStore.setState((state) => ({
        nodes: state.nodes.map(n => ({ ...n, data: { ...n.data, isHovered: false } }))
      }));

      addNode(type, centeredPosition, targetDeployment?.id);
    },
    [screenToFlowPosition, addNode, getTargetDeployment, setHoveredDeploymentId],
  );

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isControl = event.ctrlKey || event.metaKey;
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
      
      if (!isControl || isInputFocused) return;

      const key = event.key.toLowerCase();

      if (key === 'c') {
        copyNodes();
      } else if (key === 'v') {
        pasteNodes();
      } else if (key === 'z') {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) handleRedo();
        else handleUndo();
      } else if (key === 'y') {
        event.preventDefault();
        event.stopPropagation();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [copyNodes, pasteNodes, handleUndo, handleRedo]);

  const handleExport = useCallback(() => {
    const yaml = generateYaml(nodes, edges);
    setYamlContent(yaml);
    setIsYamlOpen(true);
  }, [nodes, edges]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(yamlContent).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }, [yamlContent]);

  return (
    <div className={cn(
      "flex h-screen w-screen overflow-hidden font-sans antialiased",
      colorMode === 'dark' ? "bg-slate-950 text-slate-200" : "bg-white text-slate-800"
    )}>
      <Sidebar onAddNode={addNode} onExport={handleExport} />
      <ConfigPanel />
      
      <main className="flex-1 relative canvas-grid">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodesDelete={deleteNodes}
          deleteKeyCode={["Backspace", "Delete"]}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
          minZoom={0.5}
          maxZoom={2}
          className="bg-transparent"
          colorMode={colorMode}
        >
          <Background 
            color={colorMode === 'dark' ? "#334155" : "#E2E8F0"}
            variant={BackgroundVariant.Dots} 
            gap={24} 
            size={1} 
          />
          
          <AlignmentGuides />
          
          <MiniMap 
            position="bottom-right"
            className={cn(
              "rounded-lg shadow-2xl !m-12",
              colorMode === 'dark' ? "!bg-slate-900 !border-slate-800" : "!bg-slate-100 !border-slate-300"
            )}
            nodeColor={(node) => {
              if (node.type === 'Deployment') return '#8b5cf6';
              if (node.type === 'Pod') return '#22d3ee';
              if (node.type === 'Service') return '#f59e0b';
              return colorMode === 'dark' ? '#475569' : '#94A3B8';
            }}
            maskColor={colorMode === 'dark' ? "rgba(15, 23, 42, 0.7)" : "rgba(241, 245, 249, 0.7)"}
            nodeStrokeWidth={3}
            zoomable
            pannable
          />

          <Panel position="top-left" className="m-4 flex flex-col gap-2">
            <button
              onClick={() => zoomIn()}
              className={cn(
                "p-2 rounded-md transition-colors shadow-xl",
                colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400" : "bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-600"
              )}
              title="Zoom In"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => zoomOut()}
              className={cn(
                "p-2 rounded-md transition-colors shadow-xl",
                colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400" : "bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-600"
              )}
              title="Zoom Out"
            >
              <Minus size={16} />
            </button>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={handleUndo}
                className={cn(
                  "p-2 rounded-md transition-colors shadow-xl",
                  colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400" : "bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-600"
                )}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={16} />
              </button>
              <button
                onClick={handleRedo}
                className={cn(
                  "p-2 rounded-md transition-colors shadow-xl",
                  colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400" : "bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-600"
                )}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={16} />
              </button>
            </div>
          </Panel>

          <Panel position="top-right" className="p-4 flex flex-col gap-2 items-end">
            <div className="flex gap-2">
              <span className={cn(
                "px-2.5 py-1 rounded text-[10px] font-mono shadow-xl",
                colorMode === 'dark' ? "bg-slate-800 border border-slate-700" : "bg-slate-200 border border-slate-300 text-slate-700"
              )}>
                objects: {nodes.length}
              </span>
              <span className={cn(
                "px-2.5 py-1 rounded text-[10px] font-mono shadow-xl",
                colorMode === 'dark' ? "bg-slate-800 border border-slate-700 text-emerald-400" : "bg-slate-200 border border-slate-300 text-emerald-600"
              )}>
                status: valid
              </span>
            </div>
            <button
              onClick={handleExport}
              className={cn(
                "px-4 py-1.5 rounded text-[10px] uppercase font-bold flex items-center gap-2 transition-all shadow-2xl",
                colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 border border-slate-700" : "bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700"
              )}
            >
              <FileCode size={12} className={colorMode === 'dark' ? "text-blue-400" : "text-blue-600"} />
              Inspector
            </button>
            
            {activeDeploymentId && (
              <div className={cn(
                "mt-2 px-3 py-1.5 border rounded-md flex items-center gap-2 animate-pulse",
                colorMode === 'dark' ? "bg-violet-500/10 border-violet-500/50" : "bg-violet-200/30 border-violet-400/50"
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", colorMode === 'dark' ? "bg-violet-500" : "bg-violet-600")}></div>
                <span className={cn("text-[9px] font-bold uppercase tracking-wider", colorMode === 'dark' ? "text-violet-400" : "text-violet-700")}>
                  Target: {nodes.find(n => n.id === activeDeploymentId)?.data.label}
                </span>
              </div>
            )}
          </Panel>
        </ReactFlow>

        {isYamlOpen && (
          <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm", colorMode === 'dark' ? "bg-slate-950/80" : "bg-white/80")}>
            <div className={cn("w-full max-w-2xl h-full max-h-[80vh] rounded shadow-2xl overflow-hidden flex flex-col", colorMode === 'dark' ? "bg-slate-900 border border-slate-700" : "bg-white border border-slate-300")}>
              <div className={cn("p-4 border-b flex items-center justify-between", colorMode === 'dark' ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50/50")}>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <h2 className={cn("text-[10px] font-bold tracking-[0.2em] uppercase", colorMode === 'dark' ? "text-slate-400" : "text-slate-600")}>Kubernetes Manifest Output</h2>
                </div>
                <button onClick={() => setIsYamlOpen(false)} className={cn("p-1.5 rounded transition-colors", colorMode === 'dark' ? "hover:bg-slate-800 text-slate-500" : "hover:bg-slate-200 text-slate-500")}>
                  <X size={16} />
                </button>
              </div>
              <div className={cn("flex-1 p-6 font-mono text-[11px] leading-relaxed overflow-auto select-all", colorMode === 'dark' ? "bg-slate-950 text-emerald-500/90" : "bg-slate-50 text-emerald-700/90")}>
                <pre>{yamlContent || "# No resources generated yet."}</pre>
              </div>
              <div className={cn("p-3 border-t flex justify-end gap-2", colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                <button onClick={() => setIsYamlOpen(false)} className={cn("px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors", colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-200 hover:bg-slate-300 text-slate-700")}>Close</button>
                <button onClick={handleCopy} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold uppercase shadow-lg shadow-blue-900/20">Copy Output</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className={cn("fixed bottom-0 left-64 right-0 backdrop-blur-md h-8 border-t flex items-center px-4 justify-between text-[9px] uppercase tracking-widest font-medium z-20 pointer-events-none", colorMode === 'dark' ? "bg-slate-900/80 border-slate-800 text-slate-500" : "bg-white/80 border-slate-200 text-slate-600")}>
        <div>X: 0.0 Y: 0.0</div>
        <div className="flex gap-4">
          <span>Engine: xyflow v12</span>
          <span className={cn("font-bold", colorMode === 'dark' ? "text-emerald-500/60" : "text-emerald-700/60")}>● System Ready</span>
        </div>
      </footer>
    </div>
  );
}
