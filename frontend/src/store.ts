import { create } from 'zustand';
import {
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { K8sResourceType, K8sNodeData } from './types';

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  activeDeploymentId: string | null;
  hoveredDeploymentId: string | null;
  detachingDeploymentId: string | null;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  setActiveDeploymentId: (id: string | null) => void;
  setHoveredDeploymentId: (id: string | null) => void;
  setDetachingDeploymentId: (id: string | null) => void;

  addNode: (type: K8sResourceType) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onNodeDrag: (event: any, node: Node) => void;
  onNodeDragStop: (event: any, node: Node) => void;
}

const sortNodes = (nodes: Node[]): Node[] => {
  return [...nodes].sort((a, b) => {
    if (a.type === 'Deployment' && b.type === 'Pod') return -1;
    if (a.type === 'Pod' && b.type === 'Deployment') return 1;
    return 0;
  });
};

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  activeDeploymentId: null,
  hoveredDeploymentId: null,
  detachingDeploymentId: null,

  onNodesChange: (changes: NodeChange[]) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },
  onConnect: (connection: Connection) => {
    set((state) => ({
      edges: applyEdgeChanges([{ item: connection, type: 'add' }], state.edges),
    }));
  },
  setNodes: (nodes: Node[]) => set({ nodes }),
  setEdges: (edges: Edge[]) => set({ edges }),

  setActiveDeploymentId: (id: string | null) => set({ activeDeploymentId: id }),
  setHoveredDeploymentId: (id: string | null) => set({ hoveredDeploymentId: id }),
  setDetachingDeploymentId: (id: string | null) => set({ detachingDeploymentId: id }),

  addNode: (type: K8sResourceType) => {
    const { nodes, activeDeploymentId } = get();
    const id = `${type.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
    let position = { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 };
    let parentId: string | undefined = undefined;

    if (type === 'Pod' && activeDeploymentId) {
      const activeDeployment = nodes.find(n => n.id === activeDeploymentId && n.type === 'Deployment');
      if (activeDeployment) {
        parentId = activeDeployment.id;
        position = { x: 20 + Math.random() * 50, y: 40 + Math.random() * 50 }; 
      }
    } else {
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
      data: {
        label: `${type} ${nodes.length + 1}`,
        type,
        replicas: type === 'Deployment' ? 0 : undefined,
        onDelete: () => {
          set((state) => {
            const nodeToDelete = state.nodes.find(n => n.id === id);
            let updatedNodes = state.nodes.filter((n) => n.id !== id);
            if (nodeToDelete?.parentId) {
              updatedNodes = updatedNodes.map(n => {
                if (n.id === nodeToDelete.parentId && n.type === 'Deployment') {
                  return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - 1) } };
                }
                return n;
              });
            }
            return { nodes: updatedNodes };
          });
          set((state) => ({ edges: state.edges.filter((e) => e.source !== id && e.target !== id) }));
        },
        onRename: (newName: string) => {
          set((state) => ({
            nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: newName } } : n)),
          }));
        },
      },
    };

    set((state) => {
      let nextNodes = [...state.nodes];
      if (parentId) {
        nextNodes = nextNodes.map(n => {
          if (n.id === parentId) {
            return { ...n, data: { ...n.data, replicas: (n.data.replicas || 0) + 1 } };
          }
          return n;
        });
      }
      return { nodes: sortNodes([...nextNodes, newNode]) };
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

  onNodeDrag: (event: any, node: Node) => {
    const { nodes } = get();
    if (node.type !== 'Pod') return;

    let newHoveredDeploymentId: string | null = null;
    let newDetachingDeploymentId: string | null = null;

    const podWidth = node.measured?.width || 160;
    const podHeight = node.measured?.height || 80;
    const podArea = podWidth * podHeight;

    // Calculate Pod's current absolute position
    let podAbsX = node.position.x;
    let podAbsY = node.position.y;
    if (node.parentId) {
        const parent = nodes.find(n => n.id === node.parentId);
        if (parent) {
            podAbsX += parent.position.x;
            podAbsY += parent.position.y;
        }
    }

    // Reset all visual states for deployments before recalculating
    let nextNodes = nodes.map(n => {
      if (n.type === 'Deployment') {
        return { ...n, data: { ...n.data, isHovered: false, isDetaching: false } };
      }
      return n;
    });

    for (const deployment of nodes.filter(n => n.type === 'Deployment')) {
        const depAbsX = deployment.position.x;
        const depAbsY = deployment.position.y;
        const depWidth = deployment.measured?.width || 320;
        const depHeight = deployment.measured?.height || 160;

        const intersects = 
            podAbsX < depAbsX + depWidth &&
            podAbsX + podWidth > depAbsX &&
            podAbsY < depAbsY + depHeight &&
            podAbsY + podHeight > depAbsY;

        if (node.parentId === deployment.id) {
            // This is the Pod's current parent deployment
            const overlapX = Math.max(0, Math.min(podAbsX + podWidth, depAbsX + depWidth) - Math.max(podAbsX, depAbsX));
            const overlapY = Math.max(0, Math.min(podAbsY + podHeight, depAbsY + depHeight) - Math.max(podAbsY, depAbsY));
            const overlapArea = overlapX * overlapY;
            const overlapPercentage = (overlapArea / podArea) * 100;

            if (overlapPercentage < 50) {
                newDetachingDeploymentId = deployment.id;
                // Mark this deployment as detaching
                nextNodes = nextNodes.map(n => n.id === deployment.id ? { ...n, data: { ...n.data, isDetaching: true } } : n);
            } else {
                // If still mostly inside, it's considered "hovered" over its own parent
                newHoveredDeploymentId = deployment.id;
                nextNodes = nextNodes.map(n => n.id === deployment.id ? { ...n, data: { ...n.data, isHovered: true } } : n);
            }
        } else if (intersects) {
            // This is a different deployment being hovered
            newHoveredDeploymentId = deployment.id;
            nextNodes = nextNodes.map(n => n.id === deployment.id ? { ...n, data: { ...n.data, isHovered: true } } : n);
        }
    }

    set({ 
        hoveredDeploymentId: newHoveredDeploymentId, 
        detachingDeploymentId: newDetachingDeploymentId,
        nodes: nextNodes 
    });
  },

  onNodeDragStop: (event: any, node: Node) => {
    const { nodes } = get();
    
    // Capture final states before resetting visual feedback
    const finalDetachingDeploymentId = get().detachingDeploymentId;
    const finalHoveredDeploymentId = get().hoveredDeploymentId;
    const activeDeploymentId = get().activeDeploymentId; // Get active deployment ID

    // Reset visual feedback for all deployments
    set((state) => ({
      hoveredDeploymentId: null,
      detachingDeploymentId: null,
      nodes: state.nodes.map(n => ({ ...n, data: { ...n.data, isHovered: false, isDetaching: false } }))
    }));

    if (node.type !== 'Pod') return;

    // --- NEW HIGH PRIORITY: Handle Active Deployment ---
    if (activeDeploymentId) {
        const activeDeployment = nodes.find(n => n.id === activeDeploymentId && n.type === 'Deployment');
        // Only attach if activeDeployment exists and the pod is not already its child
        if (activeDeployment && node.parentId !== activeDeployment.id) {
            set((state) => {
                let currentNodes = state.nodes;
                // Decrement replicas of previous parent if any
                if (node.parentId) {
                    currentNodes = currentNodes.map(n => {
                        if (n.id === node.parentId) {
                            return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - 1) } };
                        }
                        return n;
                    });
                }

                const podWidth = node.measured?.width || 160;
                const podHeight = node.measured?.height || 80;
                const targetWidth = activeDeployment.measured?.width || 320;
                const targetHeight = activeDeployment.measured?.height || 160;

                const updatedNodes = currentNodes.map((n) => {
                    if (n.id === node.id) {
                        // Snap inside the active deployment
                        const paddingX = 20;
                        const paddingY = 40;
                        const randomX = paddingX + Math.random() * (targetWidth - podWidth - (2 * paddingX));
                        const randomY = paddingY + Math.random() * (targetHeight - podHeight - (2 * paddingY));

                        return {
                            ...n,
                            parentId: activeDeployment.id,
                            position: { x: randomX, y: randomY },
                        };
                    }
                    if (n.id === activeDeployment.id) {
                        return { ...n, data: { ...n.data, replicas: (n.data.replicas || 0) + 1 } };
                    }
                    return n;
                });
                return { nodes: sortNodes(updatedNodes) };
            });
            return; // Action completed, no further processing
        }
    }

    // --- Action 1: Handle Detaching (Merah) ---
    // If the pod was being detached from its parent
    if (node.parentId && finalDetachingDeploymentId === node.parentId) {
      set((state) => {
        const parent = state.nodes.find(n => n.id === node.parentId);
        if (!parent) return state;

        const podWidth = node.measured?.width || 160;
        const podHeight = node.measured?.height || 80;
        const parentWidth = parent.measured?.width || 320;
        const parentHeight = parent.measured?.height || 160;
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

        return {
          nodes: state.nodes.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                parentId: undefined,
                position: { x: finalSnapX, y: finalSnapY },
              };
            }
            if (n.id === node.parentId) {
              return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - 1) } };
            }
            return n;
          }),
        };
      });
      return;
    } 
    
    // --- Action 2: Handle Attaching (Ungu) ---
    // This block will now handle both:
    // a) Attaching a standalone pod to a new hovered deployment
    // b) Snapping a pod back into its own parent deployment if it was hovered (not detaching)
    if (finalHoveredDeploymentId) { // Simplified condition
      set((state) => {
        const targetDeployment = state.nodes.find(n => n.id === finalHoveredDeploymentId);
        if (!targetDeployment) return state;

        let currentNodes = state.nodes;
        // Decrement replicas of previous parent if it's a different parent
        if (node.parentId && node.parentId !== finalHoveredDeploymentId) {
            currentNodes = currentNodes.map(n => {
                if (n.id === node.parentId) {
                    return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - 1) } };
                }
                return n;
            });
        }

        const podWidth = node.measured?.width || 160;
        const podHeight = node.measured?.height || 80;
        const targetWidth = targetDeployment.measured?.width || 320;
        const targetHeight = targetDeployment.measured?.height || 160;

        const updatedNodes = currentNodes.map((n) => {
          if (n.id === node.id) {
            const paddingX = 20;
            const paddingY = 40;
            
            const randomX = paddingX + Math.random() * (targetWidth - podWidth - (2 * paddingX));
            const randomY = paddingY + Math.random() * (targetHeight - podHeight - (2 * paddingY));

            return {
              ...n,
              parentId: targetDeployment.id,
              position: { x: randomX, y: randomY },
            };
          }
          // Increment replicas only if it's a new attachment or snapping back into its own parent
          // and it wasn't already a child of this target.
          if (n.id === targetDeployment.id && node.parentId !== finalHoveredDeploymentId) {
            return { ...n, data: { ...n.data, replicas: (n.data.replicas || 0) + 1 } };
          }
          return n;
        });
        return { nodes: sortNodes(updatedNodes) };
      });
    }
  },
}));
