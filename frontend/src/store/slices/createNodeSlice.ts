import { StateCreator } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import { FlowState } from '../types';
import { K8sResourceType, K8sNodeData } from '../../types';
import { sortNodes, layoutPodsInDeployment, syncPodsInDeployment, getPodMinimumSize, POD_MIN_DIMENSIONS } from '../helpers';

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
  onNodeResizeStop: (event: any, node: Node) => void;
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
        const pastedData = pastedPod.data as unknown as K8sNodeData;
        const targetData = targetPod.data as unknown as K8sNodeData;
        const delta = pastedData.replicas || 1;
        
        if (targetPod.parentId) {
          const parent = nodes.find(n => n.id === targetPod.parentId);
          if (parent) {
            const parentData = parent.data as unknown as K8sNodeData;
            get().updateNodeData(parent.id, { replicas: (parentData.replicas || 0) + delta });
            return;
          }
        } else {
          get().updateNodeData(targetPod.id, { replicas: (targetData.replicas || 1) + delta });
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

    set({
      nodes: sortNodes(nextNodes),
      edges: [...edges, ...newEdges],
      lastActionId: `paste-${Date.now()}`,
      lastActionName: 'Paste Elements'
    });
  },
  updateNodeData: (nodeId: string, newData: any) => {
    set((state) => {
      const previousNode = state.nodes.find(n => n.id === nodeId);
      let nextNodes = state.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n);
      const updatedNode = nextNodes.find(n => n.id === nodeId);
      if (!updatedNode) return { ...state };

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
        const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 130)));
        const depW = Math.max(updatedNode.width || 0, maxPodX + 20);
        const depH = Math.max(updatedNode.height || 0, maxPodY + 40);
        nextNodes = nextNodes.map(n => n.id === parentId ? {
          ...n,
          width: depW,
          height: depH,
          style: { ...n.style, width: depW, height: depH },
        } : n);
      } else if (updatedNode.type === 'Pod' && updatedNode.parentId) {
        const parentId = updatedNode.parentId;
        const parent = nextNodes.find(n => n.id === parentId);
        if (parent) {
          const currentPods = nextNodes.filter(n => n.parentId === parentId && n.type === 'Pod');
          const previousLabel = previousNode?.data.label;
          const selectedLabel = previousLabel || updatedNode.data.label;
          const groupPods = currentPods.filter(pod =>
            pod.data.label === selectedLabel || pod.id === updatedNode.id
          );
          const otherPods = currentPods.filter(pod =>
            pod.data.label !== selectedLabel && pod.id !== updatedNode.id
          );
          const groupReplicas = typeof newData.replicas === 'number'
            ? newData.replicas
            : groupPods.reduce((acc, pod) => acc + (pod.data.replicas || 1), 0);
          const otherReplicas = otherPods.reduce((acc, pod) => acc + (pod.data.replicas || 1), 0);
          const totalReplicas = groupReplicas + otherReplicas;
          const updatedParent = {
            ...parent,
            data: {
              ...parent.data,
              replicas: totalReplicas
            }
          };

          nextNodes = nextNodes.map(n => n.id === parentId ? updatedParent : n);

          const groupDeployment = {
            ...updatedParent,
            data: {
              ...updatedParent.data,
              replicas: groupReplicas
            }
          };

          // Use the specifically updated node as the data template for this label group.
          const syncedPods = syncPodsInDeployment(groupDeployment, groupPods, updatedNode);
          const syncedWithHandlers = syncedPods.map(p => ({
            ...p,
            data: { ...p.data, ...setupPodHandlers(p.id) }
          }));
          const laidOutPods = layoutPodsInDeployment(updatedParent, [...otherPods, ...syncedWithHandlers]);

          nextNodes = nextNodes.filter(n => n.parentId !== parentId || n.type !== 'Pod');
          nextNodes = [...nextNodes, ...laidOutPods];

          const maxPodX = Math.max(0, ...laidOutPods.map(p => (p.position.x || 0) + (p.width || 160)));
          const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || 80)));
          const depW = Math.max(updatedParent.width || 0, maxPodX + 20);
          const depH = Math.max(updatedParent.height || 0, maxPodY + 40);
          nextNodes = nextNodes.map(n => n.id === parentId ? {
            ...n,
            width: depW,
            height: depH,
            style: { width: depW, height: depH },
            measured: { width: depW, height: depH }
          } : n);
        }
      } else if (updatedNode.type === 'Pod' && !updatedNode.parentId) {
        const label = updatedNode.data.label;
        
        // 1. Sync all top-level pods with the same label
        nextNodes = nextNodes.map(n => {
          if (n.type === 'Pod' && !n.parentId && (n.id === updatedNode.id || n.data.label === label)) {
            const podData = { ...n.data, ...newData };
            const minSize = getPodMinimumSize(podData);
            const width = n.data?.isManuallyResized ? Math.max(n.width || 0, minSize.width) : minSize.width;
            const minHeight = n.data?.isManuallyResized ? Math.max(n.height || 0, minSize.height) : minSize.height;
            return {
              ...n,
              data: podData,
              width,
              style: {
                ...(n.style || {}),
                width,
                minHeight
              },
              measured: undefined
            };
          }
          return n;
        });

        // 2. Simple Collision Avoidance (Push logic)
        // We only push nodes that are below or to the right of the updated group
        const MARGIN = 24;
        const affectedLabelNodes = nextNodes.filter(n => n.type === 'Pod' && !n.parentId && n.data.label === label);
        
        // For each node in the affected group, check if it now overlaps with other top-level nodes
        affectedLabelNodes.forEach(movedNode => {
          let hasCollision = true;
          let safetyCounter = 0;
          
          while (hasCollision && safetyCounter < 5) {
            hasCollision = false;
            safetyCounter++;

            const rectA = {
              left: movedNode.position.x,
              top: movedNode.position.y,
              right: movedNode.position.x + (movedNode.width || 160),
              bottom: movedNode.position.y + (Number((movedNode.style as any)?.minHeight) || 80)
            };

            nextNodes = nextNodes.map(other => {
              if (other.parentId || other.id === movedNode.id || (other.type === 'Pod' && other.data.label === label)) return other;

              const otherW = other.width || other.measured?.width || 160;
              const otherH = other.measured?.height || Number((other.style as any)?.minHeight) || 80;
              
              const rectB = {
                left: other.position.x,
                top: other.position.y,
                right: other.position.x + otherW,
                bottom: other.position.y + otherH
              };

              const isOverlapping = !(rectA.right + MARGIN < rectB.left || 
                                     rectA.left - MARGIN > rectB.right || 
                                     rectA.bottom + MARGIN < rectB.top || 
                                     rectA.top - MARGIN > rectB.bottom);

              if (isOverlapping) {
                hasCollision = true;
                // Push logic: prefer pushing down, then right
                const dy = rectB.top - rectA.top;
                const dx = rectB.left - rectA.left;

                if (Math.abs(dy) >= Math.abs(dx) && dy >= 0) {
                  return { ...other, position: { ...other.position, y: rectA.bottom + MARGIN } };
                } else if (dx >= 0) {
                  return { ...other, position: { ...other.position, x: rectA.right + MARGIN } };
                }
              }
              return other;
            });
          }
        });
      }

      return { 
        nodes: sortNodes(nextNodes),
        lastActionId: `update-${Date.now()}`,
        lastActionName: 'Update Node Data'
      };
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
      width = POD_MIN_DIMENSIONS.width;
      height = undefined;
    } else if (type === 'Deployment') {
      width = 320;
    } else if (type === 'Service') {
        width = 180;
    } else if (type === 'Internet') {
        width = 180;
    } else if (type === 'Namespace') {
        width = 600;
        height = 400;
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
      style: type === 'Pod' ? { width, minHeight: POD_MIN_DIMENSIONS.height } : { width, height },
      measured: { width, height },
      extent: parentId ? 'parent' : undefined,
      data: {
        label: type === 'Pod' ? 'new-app-pod-' + (nodes.length + 1) : type.toLowerCase() + '-' + (nodes.length + 1),
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
        const parentNode = nextNodes.find(n => n.id === parentId);
        
        // Special logic only for Pods inside Deployments
        if (parentNode?.type === 'Deployment' && type === 'Pod') {
          const updatedParent = {
            ...parentNode,
            data: {
              ...parentNode.data,
              replicas: (parentNode.data.replicas || 0) + 1
            }
          };

          const currentPods = nextNodes.filter(n => n.parentId === parentId && n.type === 'Pod');
          const syncedPods = syncPodsInDeployment(updatedParent, currentPods);
          const syncedPodsWithHandlers = syncedPods.map(pod => ({
            ...pod,
            data: { ...pod.data, ...setupPodHandlers(pod.id) }
          }));

          const laidOutPods = layoutPodsInDeployment(updatedParent, syncedPodsWithHandlers);

          nextNodes = nextNodes.filter(n => n.parentId !== parentId || n.type !== 'Pod');
          nextNodes = nextNodes.map(n => n.id === parentId ? updatedParent : n);
          nextNodes = [...nextNodes, ...laidOutPods];

          const maxPodX = Math.max(0, ...laidOutPods.map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
          const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 130)));
          const minW = maxPodX + 20;
          const minH = maxPodY + 40;
          nextNodes = nextNodes.map(n => {
            if (n.id === parentId) {
              const finalW = Math.max(n.width || 0, minW);
              const finalH = Math.max(n.height || 0, minH);
              return {
                ...n,
                width: finalW,
                height: finalH,
                style: { ...n.style, width: finalW, height: finalH },
              };
            }
            return n;
          });
        } else {
          // For other parenting (e.g. Deployment in Namespace, Pod in Namespace, etc.)
          nextNodes = [...nextNodes, newNode];
        }
      } else {
        nextNodes = [...nextNodes, newNode];
      }
      return { 
        nodes: sortNodes(nextNodes),
        lastActionId: `add-${Date.now()}`,
        lastActionName: `Add ${type}`
      };
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
            const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 130)));
            const finalW = Math.max(parentDeployment.width || 0, maxPodX + 20);
            const finalH = Math.max(parentDeployment.height || 0, maxPodY + 40);
            nextNodes = nextNodes.map(n => n.id === parentId ? {
                ...n,
                width: finalW,
                height: finalH,
                style: { ...n.style, width: finalW, height: finalH },
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
        edges: state.edges.filter(e => !finalIdsToDelete.has(e.source) && !finalIdsToDelete.has(e.target)),
        lastActionId: `delete-${Date.now()}`,
        lastActionName: 'Delete Elements'
      };
    });
  },

  onNodeClick: (event: React.MouseEvent, node: Node) => {
    get().setConfiguringNodeId(null);
    get().setConfiguringEdgeId(null);
    if (node.type === 'Deployment') {
      get().setActiveDeploymentId(node.id);
    } else {
      get().setActiveDeploymentId(null);
    }
  },

  onPaneClick: () => {
    get().setConfiguringNodeId(null);
    get().setConfiguringEdgeId(null);
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
    
    const getAbsPos = (nodeId: string, currentNodes: Node[], draggedNode?: Node): { x: number, y: number } => {
      const n = (draggedNode && nodeId === draggedNode.id) ? draggedNode : currentNodes.find(i => i.id === nodeId);
      if (!n) return { x: 0, y: 0 };
      if (!n.parentId) return n.position;
      const pAbs = getAbsPos(n.parentId, currentNodes, draggedNode);
      return { x: n.position.x + pAbs.x, y: n.position.y + pAbs.y };
    };

    const nodeAbs = getAbsPos(node.id, nodes, node);
    const nodeAbsX = nodeAbs.x;
    const nodeAbsY = nodeAbs.y;
    
    // Calculate alignment guides for any node type
    const SNAP_THRESHOLD = 8;
    const SNAP_TOLERANCE = 4; // Threshold for snap guides to be active
    const verticalGuides = new Set<number>();
    const horizontalGuides = new Set<number>();
    const verticalSnapGuides = new Map<number, boolean>();
    const horizontalSnapGuides = new Map<number, boolean>();

    // Detect if we should show guides for this node
    const isAutoLaidOutPod = node.type === 'Pod' && node.parentId && nodes.find(p => p.id === node.parentId)?.type === 'Deployment';
    const shouldShowGuides = !isAutoLaidOutPod || (detachingDeploymentId !== null);

    if (shouldShowGuides) {
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
          // Skip pods inside deployments as alignment targets (too many lines, and they auto-layout anyway)
          const otherIsAutoPod = otherNode.type === 'Pod' && otherNode.parentId && nodes.find(p => p.id === otherNode.parentId)?.type === 'Deployment';
          if (otherIsAutoPod) continue;

          const otherAbs = getAbsPos(otherNode.id, nodes);
          const otherAbsX = otherAbs.x;
          const otherAbsY = otherAbs.y;

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
    }

    // Generic Parenting Logic (Hover and Detach)
    let newHoveredDeploymentId: string | null = null;
    let newDetachingDeploymentId: string | null = null;

    const podArea = nodeWidth * nodeHeight;
    const isAllowed = (parentType: string, childType: string) => {
      if (parentType === 'Deployment') return childType === 'Pod';
      if (parentType === 'Namespace') return ['Pod', 'Deployment', 'Service', 'Internet'].includes(childType);
      return false;
    };

    let nextNodes = nodes.map(n => {
      if (n.type === 'Deployment' || n.type === 'Namespace') {
        return { ...n, data: { ...n.data, isHovered: false, isDetaching: false } };
      }
      return n;
    });

    // Find valid containers to check for hover/detach
    const containers = nodes.filter(n => n.type === 'Deployment' || n.type === 'Namespace');
    
    // Sort containers by area (smallest first) to prioritize nesting
    const sortedContainers = [...containers].sort((a, b) => {
      const areaA = (a.width || 320) * (a.height || 160);
      const areaB = (b.width || 320) * (b.height || 160);
      return areaA - areaB;
    });

    for (const container of sortedContainers) {
        if (container.id === node.id) continue;

        const contAbs = getAbsPos(container.id, nodes);
        const contWidth = container.width || container.measured?.width || (container.type === 'Deployment' ? 320 : 600);
        const contHeight = container.height || container.measured?.height || (container.type === 'Deployment' ? 160 : 400);

        const intersects = 
            nodeAbsX < contAbs.x + contWidth &&
            nodeAbsX + nodeWidth > contAbs.x &&
            nodeAbsY < contAbs.y + contHeight &&
            nodeAbsY + nodeHeight > contAbs.y;

        if (node.parentId === container.id) {
            // DETACHMENT CHECK
            const overlapX = Math.max(0, Math.min(nodeAbsX + nodeWidth, contAbs.x + contWidth) - Math.max(nodeAbsX, contAbs.x));
            const overlapY = Math.max(0, Math.min(nodeAbsY + nodeHeight, contAbs.y + contHeight) - Math.max(nodeAbsY, contAbs.y));
            const overlapArea = overlapX * overlapY;
            const overlapPercentage = (overlapArea / podArea) * 100;

            if (overlapPercentage < 50) {
                newDetachingDeploymentId = container.id;
                nextNodes = nextNodes.map(n => n.id === container.id ? { ...n, data: { ...n.data, isDetaching: true } } : n);
            } else {
                // Keep attached
                newHoveredDeploymentId = container.id;
            }
        } else if (intersects && !node.parentId && isAllowed(container.type || '', node.type || '')) {
            // HOVER CHECK (only if not already parented)
            newHoveredDeploymentId = container.id;
            nextNodes = nextNodes.map(n => n.id === container.id ? { ...n, data: { ...n.data, isHovered: true } } : n);
        } else if (intersects && node.parentId && node.parentId !== container.id && isAllowed(container.type || '', node.type || '')) {
            // RE-PARENT HOVER (moving from one container to another)
            newHoveredDeploymentId = container.id;
            nextNodes = nextNodes.map(n => n.id === container.id ? { ...n, data: { ...n.data, isHovered: true } } : n);
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
  },

  onNodeDragStop: (event: any, node: Node) => {
    const { nodes, snapGuides, detachingDeploymentId, hoveredDeploymentId, activeDeploymentId } = get();

    set((state) => {
      let nextNodes = [...state.nodes];
      const nodeWidth = node.width || node.measured?.width || 160;
      const nodeHeight = node.height || node.measured?.height || 80;

      // 1. Handle Snapping
      const activeVerticalSnaps = state.snapGuides.vertical.filter(g => g.isActive).map(g => g.position);
      const activeHorizontalSnaps = state.snapGuides.horizontal.filter(g => g.isActive).map(g => g.position);

      let finalNode = { ...node };
      if (activeVerticalSnaps.length > 0) {
          finalNode.position.x = activeVerticalSnaps[0] - nodeWidth / 2;
      }
      if (activeHorizontalSnaps.length > 0) {
          finalNode.position.y = activeHorizontalSnaps[0] - nodeHeight / 2;
      }
      
      // Update the node in the list
      nextNodes = nextNodes.map(n => n.id === node.id ? finalNode : n);

      // 2. Parenting Logic
      const targetParentId = hoveredDeploymentId;
      const targetParent = targetParentId ? nextNodes.find(n => n.id === targetParentId) : null;
      
      const stateNode = nextNodes.find(n => n.id === node.id);
      const oldParentId = stateNode?.parentId;
      
      const isAllowed = (parentType: string, childType: string) => {
        if (parentType === 'Deployment') return childType === 'Pod';
        if (parentType === 'Namespace') return ['Pod', 'Deployment', 'Service', 'Internet'].includes(childType);
        return false;
      };

      // Calculate absolute position of the node before parenting changes
      const getAbsPos = (nodeId: string, currentNodes: Node[], draggedNode?: Node) => {
        const n = (draggedNode && nodeId === draggedNode.id) ? draggedNode : currentNodes.find(i => i.id === nodeId);
        if (!n) return { x: 0, y: 0 };
        if (!n.parentId) return n.position;
        const pAbs = getAbsPos(n.parentId, currentNodes, draggedNode);
        return { x: n.position.x + pAbs.x, y: n.position.y + pAbs.y };
      };

      const absPos = getAbsPos(node.id, nextNodes, finalNode);

      if (targetParentId && targetParent && targetParentId !== oldParentId) {
        if (isAllowed(targetParent.type || '', node.type || '')) {
          // ATTACH to new parent
          if (targetParent.type === 'Deployment' && node.type === 'Pod') {
            // Special Deployment Layout Logic
            const nodeData = node.data as unknown as K8sNodeData;
            const targetData = targetParent.data as unknown as K8sNodeData;
            const movingReplicas = nodeData.replicas || 1;
            const updatedTarget = {
              ...targetParent,
              data: { ...targetData, replicas: (targetData.replicas || 0) + movingReplicas }
            };

            const podsInTarget = nextNodes.filter(n => n.parentId === targetParentId && n.type === 'Pod' && n.id !== node.id);
            const syncedPods = syncPodsInDeployment(updatedTarget, [finalNode, ...podsInTarget]);
            const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
            const laidOutPods = layoutPodsInDeployment(updatedTarget, syncedWithHandlers);

            nextNodes = nextNodes.filter(n => (n.parentId !== targetParentId || n.type !== 'Pod') && n.id !== node.id);
            nextNodes = [...nextNodes.map(n => n.id === targetParentId ? updatedTarget : n), ...laidOutPods];

            // Re-layout old parent if it was a Deployment
            if (oldParentId) {
              const oldParent = nextNodes.find(n => n.id === oldParentId);
              if (oldParent?.type === 'Deployment') {
                const podsInOld = nextNodes.filter(n => n.parentId === oldParentId && n.type === 'Pod' && n.id !== node.id);
                const updatedOldParent = { ...oldParent, data: { ...oldParent.data, replicas: Math.max(0, (oldParent.data.replicas || 0) - movingReplicas) } };
                const syncedPodsOld = syncPodsInDeployment(updatedOldParent, podsInOld);
                const syncedWithHandlersOld = syncedPodsOld.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
                const laidOutPodsOld = layoutPodsInDeployment(updatedOldParent, syncedWithHandlersOld);
                nextNodes = nextNodes.filter(n => (n.parentId !== oldParentId || n.type !== 'Pod'));
                nextNodes = [...nextNodes.map(n => n.id === oldParentId ? updatedOldParent : n), ...laidOutPodsOld];
              }
            }
          } else {
            // Generic Parenting (Namespace, etc.)
            const targetAbsPos = getAbsPos(targetParentId, nextNodes);
            const relativePos = { x: absPos.x - targetAbsPos.x, y: absPos.y - targetAbsPos.y };
            
            nextNodes = nextNodes.map(n => {
              if (n.id === node.id) return { ...n, parentId: targetParentId, position: relativePos, extent: 'parent' as const };
              return n;
            });

            // If moving out of a Deployment, update its replicas
            if (oldParentId) {
              const oldParent = nextNodes.find(n => n.id === oldParentId);
              if (oldParent?.type === 'Deployment' && node.type === 'Pod') {
                 const movingReplicas = node.data.replicas || 1;
                 const updatedOldParent = { ...oldParent, data: { ...oldParent.data, replicas: Math.max(0, (oldParent.data.replicas || 0) - movingReplicas) } };
                 const podsInOld = nextNodes.filter(n => n.parentId === oldParentId && n.type === 'Pod' && n.id !== node.id);
                 const syncedPodsOld = syncPodsInDeployment(updatedOldParent, podsInOld);
                 const syncedWithHandlersOld = syncedPodsOld.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
                 const laidOutPodsOld = layoutPodsInDeployment(updatedOldParent, syncedWithHandlersOld);
                 nextNodes = nextNodes.filter(n => (n.parentId !== oldParentId || n.type !== 'Pod'));
                 nextNodes = [...nextNodes.map(n => n.id === oldParentId ? updatedOldParent : n), ...laidOutPodsOld];
              }
            }
          }
        } else {
          // NOT ALLOWED in this container - Bounce out or just stay top-level
          // For now, if invalid, we'll just treat it as dropping on the pane
          nextNodes = nextNodes.map(n => {
            if (n.id === node.id) return { ...n, parentId: undefined, position: absPos, extent: undefined };
            return n;
          });
        }
      } else if (detachingDeploymentId && oldParentId === detachingDeploymentId) {
        // DETACH from current parent
        const parentId = oldParentId;
        const parent = nextNodes.find(n => n.id === parentId);
        
        if (parent?.type === 'Deployment' && node.type === 'Pod') {
          // Special Deployment Detach Logic
          const nodeData = node.data as unknown as K8sNodeData;
          const parentData = parent.data as unknown as K8sNodeData;
          const movingReplicas = nodeData.replicas || 1;
          const updatedParent = { ...parent, data: { ...parentData, replicas: Math.max(0, (parentData.replicas || 0) - movingReplicas) } };
          const podsInOld = nextNodes.filter(n => n.parentId === parentId && n.type === 'Pod' && n.id !== node.id);
          const syncedPods = syncPodsInDeployment(updatedParent, podsInOld);
          const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
          const laidOutPods = layoutPodsInDeployment(updatedParent, syncedWithHandlers);
          
          const detachedNode = { ...node, parentId: undefined, position: absPos, extent: undefined };
          
          nextNodes = nextNodes.filter(n => (n.parentId !== parentId || n.type !== 'Pod') && n.id !== node.id);
          nextNodes = [...nextNodes.map(n => n.id === parentId ? updatedParent : n), ...laidOutPods, detachedNode];
        } else {
          // Generic Detach
          nextNodes = nextNodes.map(n => {
            if (n.id === node.id) return { ...n, parentId: undefined, position: absPos, extent: undefined };
            return n;
          });
        }
      }

      // 3. Final Cleanup and State Return
      return {
        hoveredDeploymentId: null,
        detachingDeploymentId: null,
        draggedNodeId: null,
        alignmentGuides: { vertical: [], horizontal: [] },
        snapGuides: { vertical: [], horizontal: [] },
        nodes: sortNodes(nextNodes.map(n => ({ ...n, data: { ...n.data, isHovered: false, isDetaching: false } }))),
        lastActionId: `drag-${Date.now()}`,
        lastActionName: 'Move Element'
      };
    });
  },

  onNodeResize: (event: any, node: Node) => {
    set((state) => {
      const currentNode = state.nodes.find(n => n.id === node.id);
      const minSize = currentNode?.type === 'Pod'
        ? getPodMinimumSize(currentNode.data)
        : { width: node.width || 0, height: node.height || 0 };
      const nextWidth = Math.max(node.width || 0, minSize.width);
      const nextHeight = Math.max(node.height || 0, minSize.height);
      let nextNodes = state.nodes.map(n => n.id === node.id ? {
          ...n,
          width: nextWidth,
          height: n.type === 'Pod' ? undefined : nextHeight,
          style: n.type === 'Pod' ? { ...(n.style || {}), width: nextWidth, minHeight: nextHeight } : { width: nextWidth, height: nextHeight },
          measured: n.type === 'Pod' ? undefined : { width: nextWidth, height: nextHeight },
          data: n.type === 'Pod' ? { ...n.data, isManuallyResized: true } : n.data
      } : n);
      
      const resizedNode = nextNodes.find(n => n.id === node.id);
      if (!resizedNode) return { ...state };

      if (resizedNode.type === 'Pod' && resizedNode.parentId) {
        const parentDeployment = nextNodes.find(n => n.id === resizedNode.parentId);

        if (parentDeployment) {
          const resizedMinHeight = Number((resizedNode.style as any)?.minHeight) || POD_MIN_DIMENSIONS.height;
          nextNodes = nextNodes.map(n => {
            if (n.parentId === parentDeployment.id) {
                return {
                    ...n,
                    width: resizedNode.width,
                    height: undefined,
                    style: { ...(n.style || {}), width: resizedNode.width, minHeight: resizedMinHeight },
                    measured: undefined
                };
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
          const maxPodY = Math.max(0, ...reLayoutedPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || Number((p.style as any)?.minHeight) || POD_MIN_DIMENSIONS.height)));
          const minW = maxPodX + 20;
          const minH = maxPodY + 40;
          nextNodes = nextNodes.map(n => {
            if (n.id === parentDeployment.id) {
              const finalW = Math.max(n.width || 0, minW);
              const finalH = Math.max(n.height || 0, minH);
              return { 
                ...n, 
                width: finalW,
                height: finalH,
                style: { ...n.style, width: finalW, height: finalH },
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
        const maxPodY = Math.max(0, ...reLayoutedPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || Number((p.style as any)?.minHeight) || POD_MIN_DIMENSIONS.height)));
        const minW = maxPodX + 20;
        const minH = maxPodY + 40;
        
        if ((resizedNode.height || 0) < minH || (resizedNode.width || 0) < minW) {
            nextNodes = nextNodes.map(n => n.id === resizedNode.id ? { 
                ...n, 
                width: Math.max(n.width || 0, minW),
                height: Math.max(n.height || 0, minH),
                style: { ...n.style, width: Math.max(n.width || 0, minW), height: Math.max(n.height || 0, minH) },
            } : n);
        }
      }
      return { nodes: nextNodes };
    });
  },

  onNodeResizeStop: (event: any, node: Node) => {
    set({
      lastActionId: `resize-${Date.now()}`,
      lastActionName: 'Resize Element'
    });
  },
};
};
