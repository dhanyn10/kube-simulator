import { StateCreator } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import { FlowState } from '../types';
import { K8sResourceType } from '../../types';
import { sortNodes, layoutPodsInDeployment, syncPodsInDeployment } from '../helpers';

export interface NodeSlice {
  addNode: (type: K8sResourceType) => void;
  deleteNodes: (nodesToDelete: Node[]) => void;
  updateNodeData: (nodeId: string, newData: any) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onNodeDragStart: (event: any, node: Node) => void;
  onNodeDrag: (event: any, node: Node) => void;
  onNodeDragStop: (event: any, node: Node) => void;
  onNodeResize: (event: any, node: Node) => void; 
  copyNodes: () => void;
  pasteNodes: () => void;
}

export const createNodeSlice: StateCreator<FlowState, [], [], NodeSlice> = (set, get) => {
  const setupPodHandlers = (podId: string) => ({
    onDelete: () => {
      const nodeToDelete = get().nodes.find(n => n.id === podId);
      if (nodeToDelete) get().deleteNodes([nodeToDelete]);
    },
    onRename: (newName: string) => {
      const cleanName = newName.toLowerCase().replace(/\s+/g, '-');
      get().updateNodeData(podId, { label: cleanName, isAutoNamed: false });
    },
  });

  return {
  clipboard: null,

  copyNodes: () => {
    const { nodes, edges } = get();
    const selectedNodes = nodes.filter(n => n.selected);
    
    if (selectedNodes.length === 0) return;

    // Inclusion logic: If a Deployment is copied, include all its child Pods
    const nodeIdsToCopy = new Set(selectedNodes.map(n => n.id));
    selectedNodes.forEach(node => {
      if (node.type === 'Deployment') {
        nodes.filter(n => n.parentId === node.id).forEach(child => nodeIdsToCopy.add(child.id));
      }
    });

    const nodesToCopy = nodes.filter(n => nodeIdsToCopy.has(n.id));
    const edgesToCopy = edges.filter(e => nodeIdsToCopy.has(e.source) && nodeIdsToCopy.has(e.target));

    set({ clipboard: { nodes: JSON.parse(JSON.stringify(nodesToCopy)), edges: JSON.parse(JSON.stringify(edgesToCopy)) } });
  },

  pasteNodes: () => {
    const { clipboard, nodes, edges, setNodes, setEdges } = get();
    if (!clipboard) return;

    // Check if we are pasting a single Pod and it should be merged
    if (clipboard.nodes.length === 1 && clipboard.nodes[0].type === 'Pod') {
      const pastedPod = clipboard.nodes[0];
      const targetPod = nodes.find(n =>
        n.type === 'Pod' &&
        n.parentId === pastedPod.parentId &&
        (pastedPod.parentId ? true : (Math.abs(n.position.x - pastedPod.position.x) < 50 && Math.abs(n.position.y - pastedPod.position.y) < 50))
      );

      if (targetPod) {
        const delta = pastedPod.data.replicas || 1;
        if (targetPod.parentId) {
          const parent = nodes.find(n => n.id === targetPod.parentId);
          if (parent) {
            get().updateNodeData(parent.id, { replicas: (parent.data.replicas || 0) + delta });
            return;
          }
        } else {
          get().updateNodeData(targetPod.id, { replicas: (targetPod.data.replicas || 1) + delta });
          return;
        }
      }
    }

    const idMap: Record<string, string> = {};
    const offset = 40;
    const clipboardSourceIds = new Set(clipboard.nodes.map(n => n.id));

    // 1. Update ORIGINAL nodes (don't suffix anymore as per user request to keep same names)
    const updatedExistingNodes = [...nodes];

    // 2. Generate NEW nodes from clipboard
    const newNodes: Node[] = clipboard.nodes.map(node => {
      const newId = `${node.type.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap[node.id] = newId;

      return {
        ...node,
        id: newId,
        selected: true,
        position: {
          x: node.position.x + (node.parentId ? 0 : offset),
          y: node.position.y + (node.parentId ? 0 : offset),
        },
        data: {
          ...node.data,
          isAutoNamed: false, // Lock the name on paste so it doesn't change
          ...setupPodHandlers(newId),
        }
      };
    });

    // 3. Fix parent-child relationships
    let finalNewNodes = newNodes.map(node => {
      if (node.parentId && idMap[node.parentId]) {
        return { ...node, parentId: idMap[node.parentId] };
      }
      return node;
    });

    // 4. Combine and sync affected deployments
    const affectedDeploymentIds = new Set<string>();
    finalNewNodes.forEach(n => {
      if (n.type === 'Deployment') affectedDeploymentIds.add(n.id);
      else if (n.type === 'Pod' && n.parentId) affectedDeploymentIds.add(n.parentId);
    });

    let nextNodes = [...updatedExistingNodes.map(n => ({ ...n, selected: false })), ...finalNewNodes];

    affectedDeploymentIds.forEach(depId => {
      const deployment = nextNodes.find(n => n.id === depId);
      if (deployment) {
        // Recalculate replicas from child pods if needed, or just sync
        const childPods = nextNodes.filter(n => n.parentId === depId && n.type === 'Pod');
        const totalReplicas = childPods.reduce((acc, p) => acc + (p.data.replicas || 1), 0);

        const updatedDeployment = { ...deployment, data: { ...deployment.data, replicas: totalReplicas } };
        const syncedPods = syncPodsInDeployment(updatedDeployment, childPods);
        const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
        const laidOutPods = layoutPodsInDeployment(updatedDeployment, syncedWithHandlers);

        nextNodes = nextNodes.filter(n => n.parentId !== depId || n.type !== 'Pod');
        nextNodes = nextNodes.map(n => n.id === depId ? updatedDeployment : n);
        nextNodes = [...nextNodes, ...laidOutPods];

        // Resize
        const maxPodX = Math.max(0, ...laidOutPods.map(p => (p.position.x || 0) + (p.width || 160)));
        const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || 80)));
        nextNodes = nextNodes.map(n => n.id === depId ? {
            ...n,
            width: Math.max(n.width || 0, maxPodX + 20),
            height: Math.max(n.height || 0, maxPodY + 40)
        } : n);
      }
    });

    // 5. Clone edges
    const newEdges: Edge[] = clipboard.edges.map(edge => ({
      ...edge,
      id: `edge-${Math.random().toString(36).substr(2, 9)}`,
      source: idMap[edge.source],
      target: idMap[edge.target],
    }));

    setNodes(sortNodes(nextNodes));
    setEdges([...edges, ...newEdges]);
  },
  updateNodeData: (nodeId: string, newData: any) => {
    set((state) => {
      let nextNodes = state.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n);
      const updatedNode = nextNodes.find(n => n.id === nodeId);
      if (!updatedNode) return state;

      if (updatedNode.type === 'Deployment') {
        const parentId = updatedNode.id;
        const currentPods = nextNodes.filter(n => n.parentId === parentId && n.type === 'Pod');
        const syncedPods = syncPodsInDeployment(updatedNode, currentPods);
        const syncedWithHandlers = syncedPods.map(p => ({
          ...p,
          data: { ...p.data, ...setupPodHandlers(p.id) }
        }));
        const laidOutPods = layoutPodsInDeployment(updatedNode, syncedWithHandlers);

        nextNodes = nextNodes.filter(n => n.parentId !== parentId || n.type !== 'Pod');
        nextNodes = [...nextNodes, ...laidOutPods];

        // Ensure deployment is large enough
        const maxPodX = Math.max(0, ...laidOutPods.map(p => (p.position.x || 0) + (p.width || 160)));
        const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || 80)));
        nextNodes = nextNodes.map(n => n.id === parentId ? {
          ...n,
          width: Math.max(n.width || 0, maxPodX + 20),
          height: Math.max(n.height || 0, maxPodY + 40)
        } : n);
      } else if (updatedNode.type === 'Pod' && updatedNode.parentId) {
        const parentId = updatedNode.parentId;
        const parent = nextNodes.find(n => n.id === parentId);
        if (parent) {
          const currentPods = nextNodes.filter(n => n.parentId === parentId && n.type === 'Pod');
          // Use the specifically updated node as the data template if it was a data change
          const syncedPods = syncPodsInDeployment(parent, currentPods, updatedNode);
          const syncedWithHandlers = syncedPods.map(p => ({
            ...p,
            data: { ...p.data, ...setupPodHandlers(p.id) }
          }));
          const laidOutPods = layoutPodsInDeployment(parent, syncedWithHandlers);

          nextNodes = nextNodes.filter(n => n.parentId !== parentId || n.type !== 'Pod');
          nextNodes = [...nextNodes, ...laidOutPods];
        }
      }

      return { nodes: sortNodes(nextNodes) };
    });
  },

  addNode: (type: K8sResourceType, customPosition?: { x: number, y: number }, customParentId?: string) => {
    const { nodes, activeDeploymentId, deleteNodes } = get();
    const id = type.toLowerCase() + '-' + Math.random().toString(36).substr(2, 9);
    let position = customPosition || { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 };
    let parentId: string | undefined = customParentId;
    let width = undefined;
    let height = undefined;

    if (type === 'Pod') {
      width = 160;
      height = 80;
    } else if (type === 'Deployment') {
      width = 320;
      height = 160;
    } else if (type === 'Service') {
        width = 180;
        height = 120;
    }

    if (type === 'Pod' && !customParentId) {
        if (activeDeploymentId && !customPosition) {
            const activeDeployment = nodes.find(n => n.id === activeDeploymentId && n.type === 'Deployment');
            if (activeDeployment) {
                parentId = activeDeployment.id;
                position = { x: 0, y: 0 }; 
            }
        }
    }


    if (!customPosition && !parentId) {
      const lastNodeOfType = [...nodes].reverse().find(n => n.type === type);
      position = lastNodeOfType
        ? { x: lastNodeOfType.position.x + 40, y: lastNodeOfType.position.y + 40 }
        : { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 };
    }

    const newNode: Node = {
      id,
      type,
      position,
      parentId,
      width, 
      height, 
      data: {
        label: type.toLowerCase() + '-' + (nodes.length + 1),
        type,
        replicas: type === 'Pod' ? 1 : (type === 'Deployment' ? 0 : undefined),
        status: type === 'Pod' ? 'pending' : undefined,
        webserver: type === 'Pod' ? 'none' : undefined,
        runtime: type === 'Pod' ? 'none' : undefined,
        isAutoNamed: type === 'Pod',
        ...setupPodHandlers(id),
      },
    };

    set((state) => {
      let nextNodes = [...state.nodes];
      if (parentId) {
        // Find deployment and update its replica count
        const parentDeployment = nextNodes.find(n => n.id === parentId && n.type === 'Deployment');
        if (parentDeployment) {
          const updatedParent = {
            ...parentDeployment,
            data: {
              ...parentDeployment.data,
              replicas: (parentDeployment.data.replicas || 0) + 1
            }
          };

          // Sync pods in deployment
          const currentPods = nextNodes.filter(n => n.parentId === parentId && n.type === 'Pod');
          const syncedPods = syncPodsInDeployment(updatedParent, currentPods);

          // Re-attach handlers to synced pods
          const syncedPodsWithHandlers = syncedPods.map(pod => ({
            ...pod,
            data: {
              ...pod.data,
              ...setupPodHandlers(pod.id)
            }
          }));

          // Layout pods
          const laidOutPods = layoutPodsInDeployment(updatedParent, syncedPodsWithHandlers);

          // Update nextNodes
          nextNodes = nextNodes.filter(n => n.parentId !== parentId || n.type !== 'Pod');
          nextNodes = nextNodes.map(n => n.id === parentId ? updatedParent : n);
          nextNodes = [...nextNodes, ...laidOutPods];

          // Resize deployment
          const maxPodX = Math.max(0, ...laidOutPods.map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
          const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
          const minWidthNeeded = maxPodX + 20;
          const minHeightNeeded = maxPodY + 40;
          nextNodes = nextNodes.map(n => {
            if (n.id === parentId) {
              return {
                ...n,
                width: Math.max(n.width || 0, minWidthNeeded),
                height: Math.max(n.height || 0, minHeightNeeded)
              };
            }
            return n;
          });
        }
      } else {
        nextNodes = [...nextNodes, newNode];
      }
      return { nodes: sortNodes(nextNodes) };
    });
  },

  deleteNodes: (nodesToDelete: Node[]) => {
    set((state) => {
      let nextNodes = state.nodes;
      const nodeIdsToDelete = new Set(nodesToDelete.map(n => n.id));
      const podDeletions = nodesToDelete.filter(n => n.type === 'Pod');
      const otherDeletions = nodesToDelete.filter(n => n.type !== 'Pod');

      // Handle non-pod deletions normally
      if (otherDeletions.length > 0) {
        const otherIds = otherDeletions.map(n => n.id);
        nextNodes = nextNodes.filter(n => !otherIds.includes(n.id));
      }

      // Track which parents we've already synced to avoid redundant work and bugs
      const syncedParents = new Set<string>();

      // Handle pod deletions: decrement replicas from deployment and re-sync
      podDeletions.forEach(pod => {
        if (pod.parentId) {
          const parentId = pod.parentId;
          if (syncedParents.has(parentId)) return;

          const parentDeployment = nextNodes.find(n => n.id === parentId && n.type === 'Deployment');
          if (parentDeployment) {
            const replicasToDelete = podDeletions
                .filter(p => p.parentId === parentId)
                .reduce((acc, p) => acc + (p.data.replicas || 1), 0);

            const updatedParent = {
              ...parentDeployment,
              data: {
                ...parentDeployment.data,
                replicas: Math.max(0, (parentDeployment.data.replicas || 0) - replicasToDelete)
              }
            };

            // CRITICAL: Filter out the pods being deleted before syncing
            const remainingPods = nextNodes.filter(n =>
                n.parentId === parentId &&
                n.type === 'Pod' &&
                !nodeIdsToDelete.has(n.id)
            );

            const syncedPods = syncPodsInDeployment(updatedParent, remainingPods);
            const syncedWithHandlers = syncedPods.map(p => ({
              ...p,
              data: {
                ...p.data,
                ...setupPodHandlers(p.id)
              }
            }));
            const laidOutPods = layoutPodsInDeployment(updatedParent, syncedWithHandlers);

            nextNodes = nextNodes.filter(n => n.parentId !== parentId || n.type !== 'Pod');
            nextNodes = nextNodes.map(n => n.id === parentId ? updatedParent : n);
            nextNodes = [...nextNodes, ...laidOutPods];
            syncedParents.add(parentId);

            // Resize deployment if needed
            const maxPodX = Math.max(0, ...laidOutPods.map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
            const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
            nextNodes = nextNodes.map(n => n.id === parentId ? {
                ...n,
                width: Math.max(n.width || 0, maxPodX + 20),
                height: Math.max(n.height || 0, maxPodY + 40)
            } : n);
          }
        } else {
          // Pod without parent, delete normally
          nextNodes = nextNodes.filter(n => n.id !== pod.id);
        }
      });

      const finalIdsToDelete = new Set(nodesToDelete.map(n => n.id));
      // Additionally remove edges
      return { 
        nodes: sortNodes(nextNodes),
        edges: state.edges.filter(e => !finalIdsToDelete.has(e.source) && !finalIdsToDelete.has(e.target))
      };
    });
  },

  onNodeClick: (event: React.MouseEvent, node: Node) => {
    if (node.type === 'Deployment') {
      get().setActiveDeploymentId(node.id);
    } else {
      get().setActiveDeploymentId(null);
    }
  },

  onPaneClick: () => {
    get().setActiveDeploymentId(null);
  },

  onNodeDragStart: (event: any, node: Node) => {
    get().setDraggedNodeId(node.id);
    if (node.type === 'Deployment') {
      get().setActiveDeploymentId(node.id);
    }
  },

  onNodeDrag: (event: any, node: Node) => {
    const { nodes, setDraggedNodeId } = get();
    
    setDraggedNodeId(node.id);
    
    // Calculate dimensions and positions
    const nodeWidth = node.width || node.measured?.width || 160;
    const nodeHeight = node.height || node.measured?.height || 80;
    
    let nodeAbsX = node.position.x;
    let nodeAbsY = node.position.y;
    if (node.parentId) {
        const parent = nodes.find(n => n.id === node.parentId);
        if (parent) {
            nodeAbsX += parent.position.x;
            nodeAbsY += parent.position.y;
        }
    }

    // Calculate alignment guides for any node type
    const SNAP_THRESHOLD = 8;
    const SNAP_TOLERANCE = 4; // Threshold for snap guides to be active
    const verticalGuides = new Set<number>();
    const horizontalGuides = new Set<number>();
    const verticalSnapGuides = new Map<number, boolean>();
    const horizontalSnapGuides = new Map<number, boolean>();

    // Detect vertical alignment (left, center, right)
    const nodeLeftX = nodeAbsX;
    const nodeCenterX = nodeAbsX + nodeWidth / 2;
    const nodeRightX = nodeAbsX + nodeWidth;
    
    // Detect horizontal alignment (top, center, bottom)
    const nodeTopY = nodeAbsY;
    const nodeCenterY = nodeAbsY + nodeHeight / 2;
    const nodeBottomY = nodeAbsY + nodeHeight;

    // Check alignment with other nodes (all types)
    for (const otherNode of nodes.filter(n => n.id !== node.id)) {
        let otherAbsX = otherNode.position.x;
        let otherAbsY = otherNode.position.y;
        if (otherNode.parentId && !node.parentId) {
            const parent = nodes.find(n => n.id === otherNode.parentId);
            if (parent) {
                otherAbsX += parent.position.x;
                otherAbsY += parent.position.y;
            }
        } else if (!otherNode.parentId && !node.parentId) {
            // Both are top-level nodes, compare absolute positions
        } else if (otherNode.parentId && node.parentId && otherNode.parentId === node.parentId) {
            // Both are in same parent, compare relative positions
        } else {
            // Different parent contexts, skip
            continue;
        }

        const otherWidth = otherNode.width || otherNode.measured?.width || 160;
        const otherHeight = otherNode.height || otherNode.measured?.height || 80;

        // Detect vertical alignment
        const otherLeftX = otherAbsX;
        const otherCenterX = otherAbsX + otherWidth / 2;
        const otherRightX = otherAbsX + otherWidth;

        if (Math.abs(nodeLeftX - otherLeftX) < SNAP_THRESHOLD) {
            verticalGuides.add(otherLeftX);
            verticalSnapGuides.set(otherLeftX, Math.abs(nodeLeftX - otherLeftX) < SNAP_TOLERANCE);
        }
        if (Math.abs(nodeCenterX - otherCenterX) < SNAP_THRESHOLD) {
            verticalGuides.add(otherCenterX);
            verticalSnapGuides.set(otherCenterX, Math.abs(nodeCenterX - otherCenterX) < SNAP_TOLERANCE);
        }
        if (Math.abs(nodeRightX - otherRightX) < SNAP_THRESHOLD) {
            verticalGuides.add(otherRightX);
            verticalSnapGuides.set(otherRightX, Math.abs(nodeRightX - otherRightX) < SNAP_TOLERANCE);
        }

        // Detect horizontal alignment
        const otherTopY = otherAbsY;
        const otherCenterY = otherAbsY + otherHeight / 2;
        const otherBottomY = otherAbsY + otherHeight;

        if (Math.abs(nodeTopY - otherTopY) < SNAP_THRESHOLD) {
            horizontalGuides.add(otherTopY);
            horizontalSnapGuides.set(otherTopY, Math.abs(nodeTopY - otherTopY) < SNAP_TOLERANCE);
        }
        if (Math.abs(nodeCenterY - otherCenterY) < SNAP_THRESHOLD) {
            horizontalGuides.add(otherCenterY);
            horizontalSnapGuides.set(otherCenterY, Math.abs(nodeCenterY - otherCenterY) < SNAP_TOLERANCE);
        }
        if (Math.abs(nodeBottomY - otherBottomY) < SNAP_THRESHOLD) {
            horizontalGuides.add(otherBottomY);
            horizontalSnapGuides.set(otherBottomY, Math.abs(nodeBottomY - otherBottomY) < SNAP_TOLERANCE);
        }
    }

    // Pod-specific logic for hover and detach
    if (node.type === 'Pod') {
        let newHoveredDeploymentId: string | null = null;
        let newDetachingDeploymentId: string | null = null;

        const podArea = nodeWidth * nodeHeight;

        let nextNodes = nodes.map(n => {
          if (n.type === 'Deployment') {
            return { ...n, data: { ...n.data, isHovered: false, isDetaching: false } };
          }
          return n;
        });

        for (const deployment of nodes.filter(n => n.type === 'Deployment')) {
            const depAbsX = deployment.position.x;
            const depAbsY = deployment.position.y;
            const depWidth = deployment.width || deployment.measured?.width || 320;
            const depHeight = deployment.height || deployment.measured?.height || 160;

            const intersects = 
                nodeAbsX < depAbsX + depWidth &&
                nodeAbsX + nodeWidth > depAbsX &&
                nodeAbsY < depAbsY + depHeight &&
                nodeAbsY + nodeHeight > depAbsY;

            if (node.parentId === deployment.id) {
                const overlapX = Math.max(0, Math.min(nodeAbsX + nodeWidth, depAbsX + depWidth) - Math.max(nodeAbsX, depAbsX));
                const overlapY = Math.max(0, Math.min(nodeAbsY + nodeHeight, depAbsY + depHeight) - Math.max(nodeAbsY, depAbsY));
                const overlapArea = overlapX * overlapY;
                const overlapPercentage = (overlapArea / podArea) * 100;

                if (overlapPercentage < 50) {
                    newDetachingDeploymentId = deployment.id;
                    nextNodes = nextNodes.map(n => n.id === deployment.id ? { ...n, data: { ...n.data, isDetaching: true } } : n);
                } else {
                    newHoveredDeploymentId = deployment.id;
                    nextNodes = nextNodes.map(n => n.id === deployment.id ? { ...n, data: { ...n.data, isHovered: true } } : n);
                }
            } else if (intersects) {
                newHoveredDeploymentId = deployment.id;
                nextNodes = nextNodes.map(n => n.id === deployment.id ? { ...n, data: { ...n.data, isHovered: true } } : n);
            }
        }

        set({ 
            hoveredDeploymentId: newHoveredDeploymentId, 
            detachingDeploymentId: newDetachingDeploymentId,
            nodes: nextNodes,
            alignmentGuides: {
                vertical: Array.from(verticalGuides).map(pos => ({ position: pos })),
                horizontal: Array.from(horizontalGuides).map(pos => ({ position: pos })),
            },
            snapGuides: {
                vertical: Array.from(verticalSnapGuides).map(([pos, isActive]) => ({ position: pos, isActive })),
                horizontal: Array.from(horizontalSnapGuides).map(([pos, isActive]) => ({ position: pos, isActive })),
            }
        });
    } else {
        // For other node types (Deployment, Service), just show alignment guides
        set({
            alignmentGuides: {
                vertical: Array.from(verticalGuides).map(pos => ({ position: pos })),
                horizontal: Array.from(horizontalGuides).map(pos => ({ position: pos })),
            },
            snapGuides: {
                vertical: Array.from(verticalSnapGuides).map(([pos, isActive]) => ({ position: pos, isActive })),
                horizontal: Array.from(horizontalSnapGuides).map(([pos, isActive]) => ({ position: pos, isActive })),
            }
        });
    }
  },

  onNodeDragStop: (event: any, node: Node) => {
    const { nodes, snapGuides } = get();
    const finalDetachingDeploymentId = get().detachingDeploymentId;
    const finalHoveredDeploymentId = get().hoveredDeploymentId;
    const activeDeploymentId = get().activeDeploymentId;

    // Check if we should snap the node based on active snap guides
    let newNodes = nodes;
    const nodeWidth = node.width || node.measured?.width || 160;
    const nodeHeight = node.height || node.measured?.height || 80;

    // Check if any snap guides are active
    const activeVerticalSnaps = snapGuides.vertical.filter(g => g.isActive).map(g => g.position);
    const activeHorizontalSnaps = snapGuides.horizontal.filter(g => g.isActive).map(g => g.position);

    if (activeVerticalSnaps.length > 0 || activeHorizontalSnaps.length > 0) {
        // Apply snap
        const updatedNode = { ...node };

        // Snap to vertical guide (center point)
        if (activeVerticalSnaps.length > 0) {
            const snapX = activeVerticalSnaps[0];
            updatedNode.position.x = snapX - nodeWidth / 2;
        }

        // Snap to horizontal guide (center point)
        if (activeHorizontalSnaps.length > 0) {
            const snapY = activeHorizontalSnaps[0];
            updatedNode.position.y = snapY - nodeHeight / 2;
        }

        newNodes = nodes.map(n => n.id === node.id ? updatedNode : n);
    }

    set((state) => ({
      hoveredDeploymentId: null,
      detachingDeploymentId: null,
      draggedNodeId: null,
      alignmentGuides: { vertical: [], horizontal: [] },
      snapGuides: { vertical: [], horizontal: [] },
      nodes: newNodes.map(n => ({ ...n, data: { ...n.data, isHovered: false, isDetaching: false } }))
    }));

    if (node.type !== 'Pod') return;

    if (activeDeploymentId) {
        const activeDeployment = nodes.find(n => n.id === activeDeploymentId && n.type === 'Deployment');
        if (activeDeployment && node.parentId !== activeDeployment.id) {
            set((state) => {
                let currentNodes = state.nodes;
                const oldParentId = node.parentId;
                const targetParentId = activeDeployment.id;
                const movingReplicas = node.data.replicas || 1;

                // 1. Update replica counts for parents
                currentNodes = currentNodes.map(n => {
                    if (n.id === targetParentId) {
                        return { ...n, data: { ...n.data, replicas: (n.data.replicas || 0) + movingReplicas } };
                    }
                    if (oldParentId && n.id === oldParentId) {
                        return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - movingReplicas) } };
                    }
                    return n;
                });

                // 2. Sync and layout for target parent
                const targetDeployment = currentNodes.find(n => n.id === targetParentId);
                if (targetDeployment) {
                    const podsInTarget = currentNodes.filter(n => n.parentId === targetParentId && n.type === 'Pod' && n.id !== node.id);
                    const syncedPods = syncPodsInDeployment(targetDeployment, [node, ...podsInTarget]);
                    const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
                    const laidOutPods = layoutPodsInDeployment(targetDeployment, syncedWithHandlers);

                    currentNodes = currentNodes.filter(n => n.parentId !== targetParentId || n.type !== 'Pod');
                    currentNodes = [...currentNodes, ...laidOutPods];

                    // Resize target
                    const maxPodX = Math.max(0, ...laidOutPods.map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
                    const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
                    currentNodes = currentNodes.map(n => n.id === targetParentId ? {
                        ...n,
                        width: Math.max(n.width || 0, maxPodX + 20),
                        height: Math.max(n.height || 0, maxPodY + 40)
                    } : n);
                }

                // 3. Sync and layout for old parent
                if (oldParentId) {
                    const oldParent = currentNodes.find(n => n.id === oldParentId);
                    if (oldParent) {
                        const podsInOld = currentNodes.filter(n => n.parentId === oldParentId && n.type === 'Pod' && n.id !== node.id);
                        const syncedPods = syncPodsInDeployment(oldParent, podsInOld);
                        const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
                        const laidOutPods = layoutPodsInDeployment(oldParent, syncedWithHandlers);

                        currentNodes = currentNodes.filter(n => (n.parentId !== oldParentId || n.type !== 'Pod') && n.id !== node.id);
                        currentNodes = [...currentNodes, ...laidOutPods];
                    }
                } else {
                    currentNodes = currentNodes.filter(n => n.id !== node.id);
                }

                return { nodes: sortNodes(currentNodes) };
            });
            return;
        }
    }

    if (node.parentId && finalDetachingDeploymentId === node.parentId) {
      set((state) => {
        const parent = state.nodes.find(n => n.id === node.parentId);
        if (!parent) return state;

        const movingReplicas = node.data.replicas || 1;
        const podWidth = node.width || node.measured?.width || 160;
        const podHeight = node.height || node.measured?.height || 80;
        const parentWidth = parent.width || parent.measured?.width || 320;
        const parentHeight = parent.height || parent.measured?.height || 160;
        const snapOffset = 50;

        let finalSnapX: number;
        let finalSnapY: number;

        const podCenterRelX = node.position.x + podWidth / 2;
        const podCenterRelY = node.position.y + podHeight / 2;
        const parentCenterRelX = parentWidth / 2;
        const parentCenterRelY = parentHeight / 2;

        const deltaX = podCenterRelX - parentCenterRelX;
        const deltaY = podCenterRelY - parentCenterRelY;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX < 0) {
                finalSnapX = parent.position.x - podWidth - snapOffset;
            } else {
                finalSnapX = parent.position.x + parentWidth + snapOffset;
            }
            finalSnapY = parent.position.y + (parentHeight / 2) - (podHeight / 2);
        } else {
            if (deltaY < 0) {
                finalSnapY = parent.position.y - podHeight - snapOffset;
            } else {
                finalSnapY = parent.position.y + parentHeight + snapOffset;
            }
            finalSnapX = parent.position.x + (parentWidth / 2) - (podWidth / 2);
        }

        const updatedParent = {
            ...parent,
            data: { ...parent.data, replicas: Math.max(0, (parent.data.replicas || 0) - movingReplicas) }
        };

        const podsInOld = state.nodes.filter(n => n.parentId === parent.id && n.type === 'Pod' && n.id !== node.id);
        const syncedPods = syncPodsInDeployment(updatedParent, podsInOld);
        const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
        const laidOutPods = layoutPodsInDeployment(updatedParent, syncedWithHandlers);

        const detachingPod = {
            ...node,
            parentId: undefined,
            position: { x: finalSnapX, y: finalSnapY },
            data: { ...node.data, ...setupPodHandlers(node.id) }
        };

        let nextNodes = state.nodes.filter(n => (n.parentId !== parent.id || n.type !== 'Pod') && n.id !== node.id);
        nextNodes = [...nextNodes.map(n => n.id === parent.id ? updatedParent : n), ...laidOutPods, detachingPod];

        return { nodes: sortNodes(nextNodes) };
      });
      return;
    } 
    
    if (finalHoveredDeploymentId) {
      set((state) => {
        let currentNodes = state.nodes;
        const oldParentId = node.parentId;
        const targetParentId = finalHoveredDeploymentId;
        const movingReplicas = node.data.replicas || 1;

        if (oldParentId === targetParentId) return state;

        // 1. Update replica counts for parents
        currentNodes = currentNodes.map(n => {
            if (n.id === targetParentId) {
                return { ...n, data: { ...n.data, replicas: (n.data.replicas || 0) + movingReplicas } };
            }
            if (oldParentId && n.id === oldParentId) {
                return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - movingReplicas) } };
            }
            return n;
        });

        // 2. Sync and layout for target parent
        const targetDeployment = currentNodes.find(n => n.id === targetParentId);
        if (targetDeployment) {
            const podsInTarget = currentNodes.filter(n => n.parentId === targetParentId && n.type === 'Pod' && n.id !== node.id);
            const syncedPods = syncPodsInDeployment(targetDeployment, [node, ...podsInTarget]);
            const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
            const laidOutPods = layoutPodsInDeployment(targetDeployment, syncedWithHandlers);

            currentNodes = currentNodes.filter(n => n.parentId !== targetParentId || n.type !== 'Pod');
            currentNodes = [...currentNodes, ...laidOutPods];

            // Resize target
            const maxPodX = Math.max(0, ...laidOutPods.map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
            const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
            currentNodes = currentNodes.map(n => n.id === targetParentId ? {
                ...n, 
                width: Math.max(n.width || 0, maxPodX + 20),
                height: Math.max(n.height || 0, maxPodY + 40)
            } : n);
        }

        // 3. Sync and layout for old parent
        if (oldParentId) {
            const oldParent = currentNodes.find(n => n.id === oldParentId);
            if (oldParent) {
                const podsInOld = currentNodes.filter(n => n.parentId === oldParentId && n.type === 'Pod' && n.id !== node.id);
                const syncedPods = syncPodsInDeployment(oldParent, podsInOld);
                const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
                const laidOutPods = layoutPodsInDeployment(oldParent, syncedWithHandlers);

                currentNodes = currentNodes.filter(n => (n.parentId !== oldParentId || n.type !== 'Pod') && n.id !== node.id);
                currentNodes = [...currentNodes, ...laidOutPods];
            }
        } else {
            currentNodes = currentNodes.filter(n => n.id !== node.id);
        }

        return { nodes: sortNodes(currentNodes) };
      });
    }
  },

  onNodeResize: (event: any, node: Node) => {
    set((state) => {
      let nextNodes = state.nodes.map(n => n.id === node.id ? { ...n, width: node.width, height: node.height } : n);
      
      const resizedNode = nextNodes.find(n => n.id === node.id);
      if (!resizedNode) return state;

      if (resizedNode.type === 'Pod' && resizedNode.parentId) {
        const parentDeployment = nextNodes.find(n => n.id === resizedNode.parentId);

        if (parentDeployment) {
          nextNodes = nextNodes.map(n => {
            if (n.parentId === parentDeployment.id) {
                return { ...n, width: resizedNode.width, height: resizedNode.height };
            }
            return n;
          });

          const siblingPods = nextNodes.filter(n => n.parentId === parentDeployment.id);
          const reLayoutedPods = layoutPodsInDeployment(parentDeployment, siblingPods);
          nextNodes = nextNodes.map(n => {
            const reLayoutedPod = reLayoutedPods.find(rp => rp.id === n.id);
            return reLayoutedPod || n;
          });

          const maxPodX = Math.max(0, ...reLayoutedPods.map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
          const maxPodY = Math.max(0, ...reLayoutedPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
          const minWidthNeeded = maxPodX + 20;
          const minHeightNeeded = maxPodY + 40;
          nextNodes = nextNodes.map(n => {
            if (n.id === parentDeployment.id) {
              return { 
                ...n, 
                width: Math.max(n.width || 0, minWidthNeeded),
                height: Math.max(n.height || 0, minHeightNeeded) 
              };
            }
            return n;
          });
        }
      } else if (resizedNode.type === 'Deployment') {
        const childPods = nextNodes.filter(n => n.parentId === resizedNode.id);
        const reLayoutedPods = layoutPodsInDeployment(resizedNode, childPods);
        nextNodes = nextNodes.map(n => {
          const reLayoutedPod = reLayoutedPods.find(rp => rp.id === n.id);
          return reLayoutedPod || n;
        });

        const maxPodX = Math.max(0, ...reLayoutedPods.map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
        const maxPodY = Math.max(0, ...reLayoutedPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
        const minWidthNeeded = maxPodX + 20;
        const minHeightNeeded = maxPodY + 40;
        
        if ((resizedNode.height || 0) < minHeightNeeded || (resizedNode.width || 0) < minWidthNeeded) {
            nextNodes = nextNodes.map(n => n.id === resizedNode.id ? { 
                ...n, 
                height: Math.max(n.height || 0, minHeightNeeded),
                width: Math.max(n.width || 0, minWidthNeeded)
            } : n);
        }
      }
      return { nodes: nextNodes };
    });
  },
};
};
