import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
  BackgroundVariant,
  applyNodeChanges,
  NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Sidebar } from './components/Sidebar';
import { PodNode, ServiceNode, DeploymentNode } from './components/Nodes/K8sNodes';
import { K8sResourceType, K8sNodeData } from './types';
import { generateYaml } from './lib/utils';
import { FileCode, Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const nodeTypes = {
  Pod: PodNode,
  Service: ServiceNode,
  Deployment: DeploymentNode,
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isYamlOpen, setIsYamlOpen] = useState(false);
  const [yamlContent, setYamlContent] = useState('');

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const addNode = useCallback((type: K8sResourceType) => {
    const id = `${type.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Find last node of this type to offset for "side-by-side" feel
    const lastNodeOfType = [...nodes].reverse().find(n => n.type === type);
    const position = lastNodeOfType 
      ? { x: lastNodeOfType.position.x + 40, y: lastNodeOfType.position.y + 40 }
      : { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 };

    const newNode: Node = {
      id,
      type,
      position,
      data: {
        label: `${type} ${nodes.length + 1}`,
        type,
        onDelete: () => {
          setNodes((nds) => nds.filter((n) => n.id !== id));
          setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        },
      },
    };

    setNodes((nds) => nds.concat(newNode));
  }, [nodes, setNodes, setEdges]);

  // Snap-and-Contain Logic
  const onNodeDragStop = useCallback((event: any, node: Node) => {
    // Only Pods can be contained for now
    if (node.type !== 'Pod' && node.type !== 'Deployment') return;

    if (node.type === 'Pod') {
       const intersectingNode = nodes.find(
        (n) =>
          n.type === 'Deployment' &&
          n.id !== node.id &&
          node.position.x >= n.position.x &&
          node.position.x <= n.position.x + (n.measured?.width || 300) &&
          node.position.y >= n.position.y &&
          node.position.y <= n.position.y + (n.measured?.height || 150)
      );

      if (intersectingNode && node.parentId !== intersectingNode.id) {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                parentId: intersectingNode.id,
                extent: 'parent',
                position: {
                  x: node.position.x - intersectingNode.position.x,
                  y: node.position.y - intersectingNode.position.y,
                },
              };
            }
            return n;
          })
        );
      }
    }

    // If a Deployment is dropped onto Pods
    if (node.type === 'Deployment') {
      const childPods = nodes.filter(
        (p) => 
          p.type === 'Pod' && 
          !p.parentId &&
          p.position.x >= node.position.x &&
          p.position.x <= node.position.x + (node.measured?.width || 300) &&
          p.position.y >= node.position.y &&
          p.position.y <= node.position.y + (node.measured?.height || 150)
      );

      if (childPods.length > 0) {
        setNodes((nds) =>
          nds.map((n) => {
            const isChild = childPods.some(cp => cp.id === n.id);
            if (isChild) {
              return {
                ...n,
                parentId: node.id,
                extent: 'parent',
                position: {
                  x: n.position.x - node.position.x,
                  y: n.position.y - node.position.y,
                },
              };
            }
            return n;
          })
        );
      }
    }
  }, [nodes, setNodes]);

  const handleExport = useCallback(() => {
    const yaml = generateYaml(nodes, edges);
    setYamlContent(yaml);
    setIsYamlOpen(true);
  }, [nodes, edges]);

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
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          className="bg-transparent"
          colorMode="dark"
        >
          <Background color="#334155" variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls className="!bg-slate-800 !border-slate-700 !fill-slate-400 [&_button]:!bg-slate-800 [&_button]:!border-slate-700 hover:[&_button]:!bg-slate-700" />
          
          <Panel position="top-right" className="p-4 flex gap-2">
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
          </Panel>

          <Panel position="bottom-left" className="m-4">
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-3 rounded-lg shadow-2xl min-w-[200px]">
              <div className="text-[10px] font-bold text-blue-400 uppercase mb-1 tracking-wider">Session Info</div>
              <div className="space-y-1">
                <p className="text-[9px] text-slate-400 font-mono flex justify-between">
                  <span>Instance:</span> <span className="text-slate-200">ais-prod-cluster</span>
                </p>
                <p className="text-[9px] text-slate-400 font-mono flex justify-between">
                  <span>Zoom:</span> <span className="text-slate-200">100%</span>
                </p>
              </div>
            </div>
          </Panel>
        </ReactFlow>

        {/* YAML Modal */}
        <AnimatePresence>
          {isYamlOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-slate-900 border border-slate-700 w-full max-w-2xl h-full max-h-[80vh] rounded shadow-2xl overflow-hidden flex flex-col"
              >
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
                  <pre>{yamlContent || "# No resources generated yet.\n# Add components to the canvas to view manifests."}</pre>
                </div>
                <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-end gap-2">
                  <button 
                    onClick={() => setIsYamlOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                  >
                    Close
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(yamlContent);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-blue-900/20"
                  >
                    Copy Output
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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
