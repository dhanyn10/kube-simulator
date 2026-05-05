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
import { HistoryPanel } from './components/HistoryPanel';
import { YamlModal } from './components/YamlModal';
import { PodNode } from './components/Nodes/Pod';
import { ServiceNode } from './components/Nodes/Service';
import { DeploymentNode } from './components/Nodes/Deployment';
import { InternetNode } from './components/Nodes/Internet';
import { NamespaceNode } from './components/Nodes/Namespace';
import { IngressNode } from './components/Nodes/Ingress';
import { HPANode } from './components/Nodes/HPA';
import CustomEdge from './components/Edges/CustomEdge';
import { generateYaml } from './lib/utils';
import { FileCode, Plus, Minus } from 'lucide-react';
import { useFlowStore } from './store';
import { cn } from './lib/utils';
import { useHistory } from './hooks/useHistory';
import { useDropHandler } from './hooks/useDropHandler';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const nodeTypes = {
  Pod: PodNode,
  Service: ServiceNode,
  Deployment: DeploymentNode,
  Internet: InternetNode,
  Namespace: NamespaceNode,
  Ingress: IngressNode,
  HPA: HPANode,
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

  const { zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();
  const { handleUndo, handleRedo } = useHistory();
  const { onDragOver, onDrop } = useDropHandler(screenToFlowPosition);

  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onCopy: copyNodes,
    onPaste: pasteNodes,
  });

  const handleExport = useCallback(() => {
    setYamlContent(generateYaml(nodes, edges));
    setIsYamlOpen(true);
  }, [nodes, edges]);

  const btnClass = cn(
    'p-2 rounded-md transition-colors shadow-xl',
    colorMode === 'dark'
      ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400'
      : 'bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-600'
  );

  return (
    <div className={cn(
      'flex h-screen w-screen overflow-hidden font-sans antialiased',
      colorMode === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800'
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
          deleteKeyCode={['Backspace', 'Delete']}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
          minZoom={0.5}
          maxZoom={2}
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
            <HistoryPanel colorMode={colorMode} />
          </Panel>

          {/* Right Info Panel */}
          <Panel position="top-right" className="p-4 flex flex-col gap-2 items-end">
            <div className="flex gap-2">
              <span className={cn('px-2.5 py-1 rounded text-[10px] font-mono shadow-xl', colorMode === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-slate-200 border border-slate-300 text-slate-700')}>
                objects: {nodes.length}
              </span>
              <span className={cn('px-2.5 py-1 rounded text-[10px] font-mono shadow-xl', colorMode === 'dark' ? 'bg-slate-800 border border-slate-700 text-emerald-400' : 'bg-slate-200 border border-slate-300 text-emerald-600')}>
                status: valid
              </span>
            </div>
            <button
              onClick={handleExport}
              className={cn('px-4 py-1.5 rounded text-[10px] uppercase font-bold flex items-center gap-2 transition-all shadow-2xl', colorMode === 'dark' ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700' : 'bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700')}
            >
              <FileCode size={12} className={colorMode === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
              Inspector
            </button>

            {activeDeploymentId && (
              <div className={cn('mt-2 px-3 py-1.5 border rounded-md flex items-center gap-2 animate-pulse', colorMode === 'dark' ? 'bg-violet-500/10 border-violet-500/50' : 'bg-violet-200/30 border-violet-400/50')}>
                <div className={cn('w-1.5 h-1.5 rounded-full', colorMode === 'dark' ? 'bg-violet-500' : 'bg-violet-600')} />
                <span className={cn('text-[9px] font-bold uppercase tracking-wider', colorMode === 'dark' ? 'text-violet-400' : 'text-violet-700')}>
                  Target: {nodes.find((n) => n.id === activeDeploymentId)?.data.label as string}
                </span>
              </div>
            )}
          </Panel>
        </ReactFlow>

        {isYamlOpen && (
          <YamlModal
            content={yamlContent}
            colorMode={colorMode}
            onClose={() => setIsYamlOpen(false)}
          />
        )}
      </main>

      <footer className={cn('fixed bottom-0 left-64 right-0 backdrop-blur-md h-8 border-t flex items-center px-4 justify-between text-[9px] uppercase tracking-widest font-medium z-20 pointer-events-none', colorMode === 'dark' ? 'bg-slate-900/80 border-slate-800 text-slate-500' : 'bg-white/80 border-slate-200 text-slate-600')}>
        <div>X: 0.0 Y: 0.0</div>
        <div className="flex gap-4">
          <span>Engine: xyflow v12</span>
          <span className={cn('font-bold', colorMode === 'dark' ? 'text-emerald-500/60' : 'text-emerald-700/60')}>● System Ready</span>
        </div>
      </footer>
    </div>
  );
}
