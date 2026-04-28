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
import { PodNode, ServiceNode, DeploymentNode } from './components/Nodes/K8sNodes';
import { generateYaml } from './lib/utils';
import { FileCode, Plus, Minus, X } from 'lucide-react';
import { useFlowStore } from './store';

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
  const onNodeDrag = useFlowStore((state) => state.onNodeDrag);
  const onNodeDragStop = useFlowStore((state) => state.onNodeDragStop);
  const activeDeploymentId = useFlowStore((state) => state.activeDeploymentId);

  const [isYamlOpen, setIsYamlOpen] = useState(false);
  const [yamlContent, setYamlContent] = useState('');

  const { zoomIn, zoomOut } = useReactFlow();

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
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden font-sans antialiased text-slate-200">
      <Sidebar onAddNode={addNode} onExport={handleExport} />
      
      <main className="flex-1 relative canvas-grid">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodesDelete={deleteNodes}
          deleteKeyCode={["Backspace", "Delete"]}
          nodeTypes={nodeTypes}
          fitView
          className="bg-transparent"
          colorMode="dark"
        >
          <Background color="#334155" variant={BackgroundVariant.Dots} gap={24} size={1} />
          
          <MiniMap 
            position="bottom-right"
            className="!bg-slate-900 !border-slate-800 rounded-lg shadow-2xl !m-12" // Increased margin to !m-12
            nodeColor={(node) => {
              if (node.type === 'Deployment') return '#8b5cf6'; // violet-500
              if (node.type === 'Pod') return '#22d3ee'; // cyan-400
              if (node.type === 'Service') return '#f59e0b'; // amber-500
              return '#475569';
            }}
            maskColor="rgba(15, 23, 42, 0.7)"
            nodeStrokeWidth={3}
            zoomable
            pannable
          />

          <Panel position="top-left" className="m-4 flex flex-col gap-2">
            <button
              onClick={() => zoomIn()}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-slate-400 transition-colors shadow-xl"
              title="Zoom In"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => zoomOut()}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-slate-400 transition-colors shadow-xl"
              title="Zoom Out"
            >
              <Minus size={16} />
            </button>
          </Panel>

          <Panel position="top-right" className="p-4 flex flex-col gap-2 items-end">
            <div className="flex gap-2">
              <span className="px-2.5 py-1 bg-slate-800 rounded text-[10px] font-mono border border-slate-700 shadow-xl">
                objects: {nodes.length}
              </span>
              <span className="px-2.5 py-1 bg-slate-800 rounded text-[10px] font-mono border border-slate-700 text-emerald-400 shadow-xl">
                status: valid
              </span>
            </div>
             <button
              onClick={handleExport}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] uppercase font-bold flex items-center gap-2 transition-all shadow-2xl"
            >
              <FileCode size={12} className="text-blue-400" />
              Inspector
            </button>
            
            {activeDeploymentId && (
              <div className="mt-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/50 rounded-md flex items-center gap-2 animate-pulse">
                <div className="w-1.5 h-1.5 bg-violet-500 rounded-full"></div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400">
                  Target: {nodes.find(n => n.id === activeDeploymentId)?.data.label}
                </span>
              </div>
            )}
          </Panel>
        </ReactFlow>

        {isYamlOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl h-full max-h-[80vh] rounded shadow-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400">Kubernetes Manifest Output</h2>
                </div>
                <button 
                  onClick={() => setIsYamlOpen(false)}
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 bg-slate-950 p-6 font-mono text-[11px] leading-relaxed text-emerald-500/90 overflow-auto select-all">
                <pre>{yamlContent || "# No resources generated yet."}</pre>
              </div>
              <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-end gap-2">
                <button 
                  onClick={() => setIsYamlOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={handleCopy}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold uppercase shadow-lg shadow-blue-900/20"
                >
                  Copy Output
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-64 right-0 bg-slate-900/80 backdrop-blur-md h-8 border-t border-slate-800 flex items-center px-4 justify-between text-[9px] text-slate-500 uppercase tracking-widest font-medium z-20 pointer-events-none">
        <div>X: 0.0 Y: 0.0</div>
        <div className="flex gap-4">
          <span>Engine: xyflow v12</span>
          <span className="text-emerald-500/60 font-bold">● System Ready</span>
        </div>
      </footer>
    </div>
  );
}
