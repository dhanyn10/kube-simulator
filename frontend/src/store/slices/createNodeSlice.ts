import { StateCreator } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import { FlowState } from '../types';
import { K8sResourceType } from '../../types';
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

      // 2. Pod-specific logic (Attach/Detach/Move)
      if (node.type === 'Pod') {
        if (activeDeploymentId && node.parentId !== activeDeploymentId) {
          const activeDeployment = nextNodes.find(n => n.id === activeDeploymentId && n.type === 'Deployment');
          if (activeDeployment) {
            const oldParentId = node.parentId;
            const targetParentId = activeDeployment.id;
            const movingReplicas = node.data.replicas || 1;

            // Update replicas
            nextNodes = nextNodes.map(n => {
              if (n.id === targetParentId) return { ...n, data: { ...n.data, replicas: (n.data.replicas || 0) + movingReplicas } };
              if (oldParentId && n.id === oldParentId) return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - movingReplicas) } };
              return n;
            });

            // Re-layout target
            const podsInTarget = nextNodes.filter(n => n.parentId === targetParentId && n.type === 'Pod' && n.id !== node.id);
            const syncedPods = syncPodsInDeployment(activeDeployment, [finalNode, ...podsInTarget]);
            const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
            const laidOutPods = layoutPodsInDeployment(activeDeployment, syncedWithHandlers);
            
            nextNodes = nextNodes.filter(n => n.parentId !== targetParentId || n.type !== 'Pod');
            nextNodes = [...nextNodes, ...laidOutPods];

            // Resize target
            const maxPodX = Math.max(0, ...laidOutPods.map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
            const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
            nextNodes = nextNodes.map(n => n.id === targetParentId ? {
                ...n, width: Math.max(n.width || 0, maxPodX + 20), height: Math.max(n.height || 0, maxPodY + 40),
                style: { width: Math.max(n.width || 0, maxPodX + 20), height: Math.max(n.height || 0, maxPodY + 40) },
                measured: { width: Math.max(n.width || 0, maxPodX + 20), height: Math.max(n.height || 0, maxPodY + 40) }
            } : n);

            // Re-layout old parent
            if (oldParentId) {
              const oldParent = nextNodes.find(n => n.id === oldParentId);
              if (oldParent) {
                const podsInOld = nextNodes.filter(n => n.parentId === oldParentId && n.type === 'Pod' && n.id !== node.id);
                const syncedPodsOld = syncPodsInDeployment(oldParent, podsInOld);
                const syncedWithHandlersOld = syncedPodsOld.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
                const laidOutPodsOld = layoutPodsInDeployment(oldParent, syncedWithHandlersOld);
                nextNodes = nextNodes.filter(n => n.parentId !== oldParentId || n.type !== 'Pod');
                nextNodes = [...nextNodes, ...laidOutPodsOld];
              }
            } else {
                nextNodes = nextNodes.filter(n => n.id !== node.id); // Remove the old top-level pod as it's now in deployment
            }
          }
        } else if (node.parentId && detachingDeploymentId === node.parentId) {
          const parent = nextNodes.find(n => n.id === node.parentId);
          if (parent) {
            const movingReplicas = node.data.replicas || 1;
            const parentWidth = parent.width || parent.measured?.width || 320;
            const parentHeight = parent.height || parent.measured?.height || 160;
            const snapOffset = 50;

            const podCenterRelX = node.position.x + nodeWidth / 2;
            const podCenterRelY = node.position.y + nodeHeight / 2;
            const deltaX = podCenterRelX - parentWidth / 2;
            const deltaY = podCenterRelY - parentHeight / 2;

            let finalSnapX = parent.position.x;
            let finalSnapY = parent.position.y;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                finalSnapX = deltaX < 0 ? parent.position.x - nodeWidth - snapOffset : parent.position.x + parentWidth + snapOffset;
                finalSnapY = parent.position.y + (parentHeight / 2) - (nodeHeight / 2);
            } else {
                finalSnapY = deltaY < 0 ? parent.position.y - nodeHeight - snapOffset : parent.position.y + parentHeight + snapOffset;
                finalSnapX = parent.position.x + (parentWidth / 2) - (nodeWidth / 2);
            }

            const updatedParent = {
                ...parent,
                data: { ...parent.data, replicas: Math.max(0, (parent.data.replicas || 0) - movingReplicas) },
                style: { width: parent.width, height: parent.height },
                measured: { width: parent.width, height: parent.height }
            };

            const podsInOld = nextNodes.filter(n => n.parentId === parent.id && n.type === 'Pod' && n.id !== node.id);
            const syncedPods = syncPodsInDeployment(updatedParent, podsInOld);
            const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
            const laidOutPods = layoutPodsInDeployment(updatedParent, syncedWithHandlers);

            const detachingPod = {
                ...node,
                parentId: undefined,
                position: { x: finalSnapX, y: finalSnapY },
                data: { ...node.data, ...setupPodHandlers(node.id) }
            };

            nextNodes = nextNodes.filter(n => (n.parentId !== parent.id || n.type !== 'Pod') && n.id !== node.id);
            nextNodes = [...nextNodes.map(n => n.id === parent.id ? updatedParent : n), ...laidOutPods, detachingPod];
          }
        } else if (hoveredDeploymentId && node.parentId !== hoveredDeploymentId) {
            const targetParentId = hoveredDeploymentId;
            const targetDeployment = nextNodes.find(n => n.id === targetParentId);
            if (targetDeployment) {
                const oldParentId = node.parentId;
                const movingReplicas = node.data.replicas || 1;

                nextNodes = nextNodes.map(n => {
                    if (n.id === targetParentId) return { ...n, data: { ...n.data, replicas: (n.data.replicas || 0) + movingReplicas } };
                    if (oldParentId && n.id === oldParentId) return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - movingReplicas) } };
                    return n;
                });

                const podsInTarget = nextNodes.filter(n => n.parentId === targetParentId && n.type === 'Pod' && n.id !== node.id);
                const syncedPods = syncPodsInDeployment(targetDeployment, [finalNode, ...podsInTarget]);
                const syncedWithHandlers = syncedPods.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
                const laidOutPods = layoutPodsInDeployment(targetDeployment, syncedWithHandlers);

                nextNodes = nextNodes.filter(n => n.parentId !== targetParentId || n.type !== 'Pod');
                nextNodes = [...nextNodes, ...laidOutPods];

                // Resize target
                const maxPodX = Math.max(0, ...laidOutPods.map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
                const maxPodY = Math.max(0, ...laidOutPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
                nextNodes = nextNodes.map(n => n.id === targetParentId ? {
                    ...n, width: Math.max(n.width || 0, maxPodX + 20), height: Math.max(n.height || 0, maxPodY + 40),
                    style: { width: Math.max(n.width || 0, maxPodX + 20), height: Math.max(n.height || 0, maxPodY + 40) },
                    measured: { width: Math.max(n.width || 0, maxPodX + 20), height: Math.max(n.height || 0, maxPodY + 40) }
                } : n);

                if (oldParentId) {
                    const oldParent = nextNodes.find(n => n.id === oldParentId);
                    if (oldParent) {
                        const podsInOld = nextNodes.filter(n => n.parentId === oldParentId && n.type === 'Pod' && n.id !== node.id);
                        const syncedPodsOld = syncPodsInDeployment(oldParent, podsInOld);
                        const syncedWithHandlersOld = syncedPodsOld.map(p => ({ ...p, data: { ...p.data, ...setupPodHandlers(p.id) } }));
                        const laidOutPodsOld = layoutPodsInDeployment(oldParent, syncedWithHandlersOld);
                        nextNodes = nextNodes.filter(n => n.parentId !== oldParentId || n.type !== 'Pod');
                        nextNodes = [...nextNodes, ...laidOutPodsOld];
                    }
                } else {
                    nextNodes = nextNodes.filter(n => n.id !== node.id);
                }
            }
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
