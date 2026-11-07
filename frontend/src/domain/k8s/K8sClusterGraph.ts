import { K8sNodeData } from '@/types';
import { ClusterResourceNode, ClusterConnection } from './types';

/**
 * Pure domain representation of the Kubernetes cluster topology.
 * Independent of visual canvas libraries (e.g. React Flow), rendering coordinates, or store singletons.
 */
export class K8sClusterGraph {
  private readonly nodes: Map<string, ClusterResourceNode> = new Map();
  private readonly edges: Map<string, ClusterConnection> = new Map();
  private readonly outgoingEdges: Map<string, ClusterConnection[]> = new Map();
  private readonly incomingEdges: Map<string, ClusterConnection[]> = new Map();
  private readonly childrenByParent: Map<string, ClusterResourceNode[]> = new Map();

  constructor(nodes: ClusterResourceNode[] = [], edges: ClusterConnection[] = []) {
    nodes.forEach(node => this.addNode(node));
    edges.forEach(edge => this.addEdge(edge));
  }

  public addNode(node: ClusterResourceNode): this {
    this.nodes.set(node.id, {
      ...node,
      data: { ...node.data },
    });

    if (node.parentId) {
      if (!this.childrenByParent.has(node.parentId)) {
        this.childrenByParent.set(node.parentId, []);
      }
      this.childrenByParent.get(node.parentId)!.push(node);
    }
    return this;
  }

  public getNode(id: string): ClusterResourceNode | undefined {
    return this.nodes.get(id);
  }

  public hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  public getAllNodes(): ClusterResourceNode[] {
    return Array.from(this.nodes.values());
  }

  public addEdge(edge: ClusterConnection): this {
    this.edges.set(edge.id, { ...edge });

    if (!this.outgoingEdges.has(edge.source)) {
      this.outgoingEdges.set(edge.source, []);
    }
    this.outgoingEdges.get(edge.source)!.push(edge);

    if (!this.incomingEdges.has(edge.target)) {
      this.incomingEdges.set(edge.target, []);
    }
    this.incomingEdges.get(edge.target)!.push(edge);

    return this;
  }

  public getEdge(id: string): ClusterConnection | undefined {
    return this.edges.get(id);
  }

  public getAllEdges(): ClusterConnection[] {
    return Array.from(this.edges.values());
  }

  public getOutgoingEdges(sourceId: string): ClusterConnection[] {
    return this.outgoingEdges.get(sourceId) || [];
  }

  public getIncomingEdges(targetId: string): ClusterConnection[] {
    return this.incomingEdges.get(targetId) || [];
  }

  public getChildPods(parentId: string): ClusterResourceNode[] {
    return this.childrenByParent.get(parentId) || [];
  }

  public getWorkloadNodes(): ClusterResourceNode[] {
    return this.getAllNodes().filter(
      node =>
        node.type === 'Deployment' ||
        node.type === 'StatefulSet' ||
        node.type === 'ReplicaSet' ||
        (node.type === 'Pod' && !node.parentId)
    );
  }

  public getInternetNodes(): ClusterResourceNode[] {
    return this.getAllNodes().filter(node => node.type === 'Internet');
  }

  public updateNodeData(id: string, partialData: Partial<K8sNodeData>): boolean {
    const existing = this.nodes.get(id);
    if (!existing) return false;

    this.nodes.set(id, {
      ...existing,
      data: {
        ...existing.data,
        ...partialData,
      },
    });
    return true;
  }

  public clone(): K8sClusterGraph {
    return new K8sClusterGraph(this.getAllNodes(), this.getAllEdges());
  }
}
