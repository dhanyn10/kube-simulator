import { describe, it, expect, vi } from 'vitest';
import { Node, Edge } from '@xyflow/react';
import {
  K8sClusterGraph,
  ClusterResourceNode,
  ClusterConnection,
  toClusterNode,
  toClusterConnection,
  toClusterGraph,
  syncNodesFromClusterGraph,
  runDomainSimulationStep,
  emitSimulationLog,
  SimulationContext,
} from '@/domain/k8s';

describe('Clean Architecture Domain Layer (K8s Cluster Graph & Simulation Engine)', () => {
  describe('K8sClusterGraph Domain Entity', () => {
    it('manages nodes, edges, child pods, and workload queries', () => {
      const graph = new K8sClusterGraph();

      const depNode: ClusterResourceNode = {
        id: 'dep-1',
        type: 'Deployment',
        data: { label: 'Web Deployment', replicas: 2 },
      };

      const pod1: ClusterResourceNode = {
        id: 'pod-1',
        type: 'Pod',
        data: { label: 'Web Pod 1', status: 'ready' },
        parentId: 'dep-1',
      };

      const pod2: ClusterResourceNode = {
        id: 'pod-2',
        type: 'Pod',
        data: { label: 'Web Pod 2', status: 'pending' },
        parentId: 'dep-1',
      };

      const internetNode: ClusterResourceNode = {
        id: 'net-1',
        type: 'Internet',
        data: { label: 'Internet Gateway', traffic: 100 },
      };

      graph.addNode(depNode).addNode(pod1).addNode(pod2).addNode(internetNode);

      expect(graph.hasNode('dep-1')).toBe(true);
      expect(graph.getNode('dep-1')?.data.label).toBe('Web Deployment');
      expect(graph.getAllNodes()).toHaveLength(4);

      const children = graph.getChildPods('dep-1');
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id)).toEqual(['pod-1', 'pod-2']);

      const workloads = graph.getWorkloadNodes();
      expect(workloads).toHaveLength(1);
      expect(workloads[0].id).toBe('dep-1');

      const internetNodes = graph.getInternetNodes();
      expect(internetNodes).toHaveLength(1);
      expect(internetNodes[0].id).toBe('net-1');

      const edge: ClusterConnection = {
        id: 'e-net-dep',
        source: 'net-1',
        target: 'dep-1',
      };
      graph.addEdge(edge);

      expect(graph.getEdge('e-net-dep')?.target).toBe('dep-1');
      expect(graph.getAllEdges()).toHaveLength(1);
      expect(graph.getOutgoingEdges('net-1')).toHaveLength(1);
      expect(graph.getIncomingEdges('dep-1')).toHaveLength(1);
      expect(graph.getIncomingEdges('net-1')).toHaveLength(0);

      const updated = graph.updateNodeData('dep-1', { replicas: 4 });
      expect(updated).toBe(true);
      expect(graph.getNode('dep-1')?.data.replicas).toBe(4);

      const missingUpdate = graph.updateNodeData('unknown-id', { replicas: 1 });
      expect(missingUpdate).toBe(false);

      const cloned = graph.clone();
      expect(cloned.getAllNodes()).toHaveLength(4);
      expect(cloned.getAllEdges()).toHaveLength(1);
    });
  });

  describe('Domain Mappers (mappers.ts)', () => {
    it('maps React Flow UI nodes to ClusterResourceNode stripping visual properties', () => {
      const rfNode: Node = {
        id: 'ui-node-1',
        type: 'Deployment',
        position: { x: 120, y: 340 },
        selected: true,
        dragging: false,
        width: 200,
        height: 100,
        data: { label: 'Deploy UI', status: 'ready' },
        parentId: 'parent-1',
      };

      const domainNode = toClusterNode(rfNode);
      expect(domainNode.id).toBe('ui-node-1');
      expect(domainNode.type).toBe('Deployment');
      expect(domainNode.parentId).toBe('parent-1');
      expect(domainNode.data.label).toBe('Deploy UI');
      expect((domainNode as any).position).toBeUndefined();
      expect((domainNode as any).selected).toBeUndefined();
    });

    it('maps React Flow UI edges to ClusterConnection', () => {
      const rfEdge: Edge = {
        id: 'ui-edge-1',
        source: 'src-1',
        target: 'tgt-1',
        sourceHandle: 'h-out',
        targetHandle: 'h-in',
        data: { trafficRate: 50 },
      };

      const domainConnection = toClusterConnection(rfEdge);
      expect(domainConnection.id).toBe('ui-edge-1');
      expect(domainConnection.source).toBe('src-1');
      expect(domainConnection.target).toBe('tgt-1');
      expect(domainConnection.sourceHandle).toBe('h-out');
      expect(domainConnection.targetHandle).toBe('h-in');
      expect(domainConnection.data?.trafficRate).toBe(50);
    });

    it('creates K8sClusterGraph and synchronizes back to React Flow nodes preserving positions', () => {
      const rfNodes: Node[] = [
        {
          id: 'node-1',
          type: 'Deployment',
          position: { x: 50, y: 80 },
          data: { label: 'Node 1', replicas: 1 },
        },
        {
          id: 'node-2',
          type: 'Service',
          position: { x: 250, y: 80 },
          data: { label: 'Node 2', port: 80 },
        },
      ];

      const rfEdges: Edge[] = [
        { id: 'e1-2', source: 'node-2', target: 'node-1' },
      ];

      const graph = toClusterGraph(rfNodes, rfEdges);
      expect(graph.getAllNodes()).toHaveLength(2);
      expect(graph.getAllEdges()).toHaveLength(1);

      // Mutate domain graph data
      graph.updateNodeData('node-1', { replicas: 5, status: 'ready' });

      // Synchronize back to visual nodes
      const synchronizedNodes = syncNodesFromClusterGraph(rfNodes, graph);
      expect(synchronizedNodes[0].data.replicas).toBe(5);
      expect(synchronizedNodes[0].data.status).toBe('ready');
      // Visual coordinates must remain completely unchanged
      expect(synchronizedNodes[0].position).toEqual({ x: 50, y: 80 });
      expect(synchronizedNodes[1].position).toEqual({ x: 250, y: 80 });
    });
  });

  describe('Pure Domain Simulation Engine (simulationEngine.ts)', () => {
    it('executes simulation ticks in a pure functional manner without UI store dependencies', () => {
      const graph = new K8sClusterGraph();

      graph.addNode({
        id: 'internet-1',
        type: 'Internet',
        data: { label: 'Internet', traffic: 500, currentTraffic: 500 },
      });

      graph.addNode({
        id: 'dep-app',
        type: 'Deployment',
        data: {
          label: 'Backend App',
          replicas: 1,
          status: 'ready',
          cpuLimit: '500m',
          memoryLimit: '512Mi',
        },
      });

      graph.addNode({
        id: 'pod-app-1',
        type: 'Pod',
        data: { label: 'Backend Pod 1', status: 'ready', image: 'nginx:alpine' },
        parentId: 'dep-app',
      });

      graph.addEdge({
        id: 'e-net-app',
        source: 'internet-1',
        target: 'dep-app',
      });

      const onLog = vi.fn();
      const result = runDomainSimulationStep(graph, {
        ticks: 1,
        activeSimulationEdges: ['e-net-app'],
        onLog,
      });

      expect(result).toBeDefined();
      expect(result.updatedNodes.length).toBeGreaterThan(0);
      expect(result.metrics['dep-app']).toBeDefined();
      expect(Array.isArray(result.logs)).toBe(true);
    });
  });

  describe('Decoupled Log Emitting (emitSimulationLog)', () => {
    it('collects logs in ctx.logs when array provided', () => {
      const logs: any[] = [];
      const ctx: Partial<SimulationContext> = { logs } as any;

      emitSimulationLog(ctx as SimulationContext, 'warning', 'Sample warning message', 'TestCategory');
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warning');
      expect(logs[0].message).toBe('Sample warning message');
      expect(logs[0].category).toBe('TestCategory');
    });

    it('invokes ctx.onLog callback when provided', () => {
      const onLog = vi.fn();
      const ctx: Partial<SimulationContext> = { onLog } as any;

      emitSimulationLog(ctx as SimulationContext, 'info', 'Callback test', 'Simulation');
      expect(onLog).toHaveBeenCalledWith('info', 'Callback test', 'Simulation');
    });

    it('falls back to ctx.get()?.addLog for backward compatibility', () => {
      const addLog = vi.fn();
      const ctx: Partial<SimulationContext> = {
        get: () => ({ addLog }),
      } as any;

      emitSimulationLog(ctx as SimulationContext, 'error', 'Legacy test', 'Simulation');
      expect(addLog).toHaveBeenCalledWith('error', 'Legacy test', 'Simulation');
    });
  });
});
