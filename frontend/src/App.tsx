import React, { useCallback, useState, useEffect } from 'react';
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
import { PodNode, ServiceNode, DeploymentNode, InternetNode, NamespaceNode } from './components/Nodes/K8sNodes';
import CustomEdge from './components/Edges/CustomEdge';
import { generateYaml } from './lib/utils';
import { FileCode, Plus, Minus, X, Undo2 } from 'lucide-react';
import { useFlowStore, applyHistoryState } from './store';
import { POD_MIN_DIMENSIONS } from './store/helpers';
import { cn } from './lib/utils';
import { K8sResourceType } from './types';

const nodeTypes = {
  Pod: PodNode,
  Service: ServiceNode,
  Deployment: DeploymentNode,
  Internet: InternetNode,
  Namespace: NamespaceNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const defaultEdgeOptions = {
  type: 'custom',
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

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

  const fetchHistoryLogs = useCallback(async () => {
    // @ts-ignore
    if (window.go?.main?.App?.GetHistoryLogs) {
        // @ts-ignore
        const logs = await window.go.main.App.GetHistoryLogs();
        setHistoryLogs([...logs].reverse()); // Newest first
    }
  }, []);

  const handleJumpToHistory = useCallback(async (index: number) => {
    // @ts-ignore
    if (window.go?.main?.App?.JumpToHistory) {
        // @ts-ignore
        const state = await window.go.main.App.JumpToHistory(index);
        if (state) applyHistoryState(state);
        setIsHistoryOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isHistoryOpen) {
        fetchHistoryLogs();
    }
  }, [isHistoryOpen, fetchHistoryLogs]);

  const getTargetContainer = useCallback((clientX: number, clientY: number, childType: K8sResourceType) => {
    const position = screenToFlowPosition({ x: clientX, y: clientY });
    
    // Check Deployment first (smaller), then Namespace (larger)
    const candidates = nodes.filter(n => {
      if (childType === 'Pod') return n.type === 'Deployment' || n.type === 'Namespace';
      if (childType === 'Deployment' || childType === 'Service' || childType === 'Internet') return n.type === 'Namespace';
      return false;
    });

    // Sort candidates by area (smallest first) to get the most specific container
    const sortedCandidates = [...candidates].sort((a, b) => {
      const areaA = (a.width || 0) * (a.height || 0);
      const areaB = (b.width || 0) * (b.height || 0);
      return areaA - areaB;
    });

    return sortedCandidates.find(n => {
      const w = n.width || n.measured?.width || (n.type === 'Deployment' ? 320 : 600);
      const h = n.height || n.measured?.height || (n.type === 'Deployment' ? 160 : 400);
      
      // Use absolute coordinates for check
      let absX = n.position.x;
      let absY = n.position.y;
      if (n.parentId) {
        const parent = nodes.find(p => p.id === n.parentId);
        if (parent) {
          absX += parent.position.x;
          absY += parent.position.y;
        }
      }

      return (
        position.x >= absX &&
        position.x <= absX + w &&
        position.y >= absY &&
        position.y <= absY + h
      );
    });
  }, [nodes, screenToFlowPosition]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (draggingSidebarItem) {
        const target = getTargetContainer(event.clientX, event.clientY, draggingSidebarItem);
        setHoveredDeploymentId(target?.id || null);
        
        if (target) {
            useFlowStore.setState((state: any) => ({
                nodes: state.nodes.map((n: any) => n.id === target.id ? { ...n, data: { ...n.data, isHovered: true } } : { ...n, data: { ...n.data, isHovered: false } })
            }));
        } else {
            useFlowStore.setState((state: any) => ({
                nodes: state.nodes.map((n: any) => ({ ...n, data: { ...n.data, isHovered: false } }))
            }));
        }
    }
  }, [getTargetContainer, setHoveredDeploymentId, draggingSidebarItem]);

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
        Namespace: { x: 300, y: 200 },
        Internet: { x: 90, y: 60 },
      };

      const offset = centerOffsets[type as keyof typeof centerOffsets] || { x: 0, y: 0 };
      const centeredPosition = {
        x: position.x - offset.x,
        y: position.y - offset.y,
      };

      const targetContainer = getTargetContainer(event.clientX, event.clientY, type);
      
      // If we drop into a container, we need to adjust the position to be relative to the container
      let finalPosition = centeredPosition;
      if (targetContainer) {
          let absX = targetContainer.position.x;
          let absY = targetContainer.position.y;
          if (targetContainer.parentId) {
              const p = nodes.find(n => n.id === targetContainer.parentId);
              if (p) {
                  absX += p.position.x;
                  absY += p.position.y;
              }
          }
          finalPosition = {
              x: centeredPosition.x - absX,
              y: centeredPosition.y - absY
          };
      }

      setHoveredDeploymentId(null);
      useFlowStore.setState((state: any) => ({
        nodes: state.nodes.map((n: any) => ({ ...n, data: { ...n.data, isHovered: false } }))
      }));

      addNode(type, finalPosition, targetContainer?.id);
    },
    [screenToFlowPosition, addNode, getTargetContainer, setHoveredDeploymentId, nodes],
  );

  // Handle keyboard shortcuts
  useEffect(() => {
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
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
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

            <div className="mt-4 flex flex-col gap-2 relative">
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className={cn(
                  "p-2 rounded-md transition-all duration-300 shadow-xl z-30",
                  isHistoryOpen 
                    ? "bg-violet-600 text-white scale-110" 
                    : (colorMode === 'dark' ? "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400" : "bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-600")
                )}
                title="Activity Log (BadgerDB)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </button>

              {isHistoryOpen && (
                <div className={cn(
                  "absolute left-12 top-0 w-72 max-h-[400px] overflow-hidden rounded-xl shadow-2xl z-40 border flex flex-col animate-in fade-in slide-in-from-left-4 duration-300",
                  colorMode === 'dark' ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                )}>
                  <div className={cn(
                    "p-4 border-b flex items-center justify-between",
                    colorMode === 'dark' ? "bg-slate-950/50" : "bg-slate-50"
                  )}>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></div>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Activity Timeline</h3>
                    </div>
                    <span className="text-[9px] font-mono opacity-40">{historyLogs.length} events</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                    {historyLogs.length === 0 ? (
                      <div className="p-8 text-center text-[10px] opacity-50 italic">No activity recorded in BadgerDB</div>
                    ) : (
                      historyLogs.map((log) => (
                        <button
                          key={log.index}
                          onClick={() => handleJumpToHistory(log.index)}
                          className={cn(
                            "w-full text-left px-5 py-3 text-[10px] flex flex-col gap-1 transition-all border-l-2 border-transparent hover:border-violet-500",
                            colorMode === 'dark' ? "hover:bg-slate-800/50" : "hover:bg-violet-50/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn(
                                "font-bold tracking-tight",
                                colorMode === 'dark' ? "text-slate-200" : "text-slate-700"
                            )}>{log.actionName}</span>
                            <span className="font-mono opacity-30 text-[8px]">IDX:{log.index.toString().padStart(3, '0')}</span>
                          </div>
                          <div className="flex items-center justify-between opacity-50">
                            <span className="text-[8px] uppercase tracking-wider">
                                {log.timestamp > 0 ? new Date(log.timestamp).toLocaleTimeString() : 'Recorded Snapshot'}
                            </span>
                            <span className="text-[7px] font-mono">ID:{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className={cn(
                    "p-3 border-t text-[8px] uppercase tracking-[0.1em] text-center opacity-40 font-bold",
                    colorMode === 'dark' ? "bg-slate-950/30" : "bg-slate-50"
                  )}>
                    Source: User/Home/.kube-builder/history_db
                  </div>
                </div>
              )}
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
