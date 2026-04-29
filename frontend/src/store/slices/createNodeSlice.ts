import { StateCreator } from 'zustand';
import { Node } from '@xyflow/react';
import { FlowState } from '../types';
import { K8sResourceType } from '../../types';
import { sortNodes, layoutPodsInDeployment } from '../helpers';

export interface NodeSlice {
  addNode: (type: K8sResourceType) => void;
  deleteNodes: (nodesToDelete: Node[]) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onNodeDragStart: (event: any, node: Node) => void;
  onNodeDrag: (event: any, node: Node) => void;
  onNodeDragStop: (event: any, node: Node) => void;
  onNodeResize: (event: any, node: Node) => void; 
  copyNodes: () => void;
  pasteNodes: () => void;
}

export const createNodeSlice: StateCreator<FlowState, [], [], NodeSlice> = (set, get) => ({
  clipboard: null,
  // ... (previous methods)

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

    const idMap: Record<string, string> = {};
    const offset = 40;
    const clipboardSourceIds = new Set(clipboard.nodes.map(n => n.id));

    // 1. Update ORIGINAL nodes (source of copy) to have a random suffix if they still exist
    const updatedExistingNodes = nodes.map(node => {
      if (clipboardSourceIds.has(node.id) && node.type === 'Pod') {
        const randomSuffix = Math.random().toString(36).substr(2, 4);
        // Avoid double suffixing if it already has one
        const baseLabel = node.data.label.split('-').slice(0, -1).join('-');
        const isAlreadySuffixed = /-[a-z0-9]{4}$/.test(node.data.label);
        const newLabel = isAlreadySuffixed 
          ? `${baseLabel}-${randomSuffix}` 
          : `${node.data.label}-${randomSuffix}`;

        return {
          ...node,
          data: { ...node.data, label: newLabel, isAutoNamed: false }
        };
      }
      return node;
    });

    // 2. Generate NEW nodes from clipboard and adjust positions/labels
    const newNodes: Node[] = clipboard.nodes.map(node => {
      const newId = `${node.type.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap[node.id] = newId;

      const randomSuffix = Math.random().toString(36).substr(2, 4);
      // For the new node, we always want a fresh suffix
      const isAlreadySuffixed = /-[a-z0-9]{4}$/.test(node.data.label);
      const baseLabel = isAlreadySuffixed 
        ? node.data.label.split('-').slice(0, -1).join('-') 
        : node.data.label;
      const newLabel = `${baseLabel}-${randomSuffix}`;

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
            label: newLabel,
            isAutoNamed: false, // Once pasted with suffix, it's a specific instance
            onDelete: () => {
                const nodeToDelete = get().nodes.find(n => n.id === newId);
                if (nodeToDelete) get().deleteNodes([nodeToDelete]);
            },
            onRename: (newName: string) => {
                set((state) => ({
                    nodes: state.nodes.map((n) => (n.id === newId ? { ...n, data: { ...n.data, label: newName.toLowerCase().replace(/\s+/g, '-'), isAutoNamed: false } } : n)),
                }));
            },
        }
      };
    });

    // 3. Fix parent-child relationships for new nodes
    const finalNewNodes = newNodes.map(node => {
      if (node.parentId && idMap[node.parentId]) {
        return { ...node, parentId: idMap[node.parentId] };
      }
      return node;
    });

    // 4. Clone edges with new IDs
    const newEdges: Edge[] = clipboard.edges.map(edge => ({
      ...edge,
      id: `edge-${Math.random().toString(36).substr(2, 9)}`,
      source: idMap[edge.source],
      target: idMap[edge.target],
    }));

    // 5. Deselect current nodes and combine everything
    const finalNodes = updatedExistingNodes.map(n => ({ ...n, selected: false }));
    
    setNodes(sortNodes([...finalNodes, ...finalNewNodes]));
    setEdges([...edges, ...newEdges]);
  },
  addNode: (type: K8sResourceType, customPosition?: { x: number, y: number }) => {
    const { nodes, activeDeploymentId, deleteNodes } = get();
    const id = type.toLowerCase() + '-' + Math.random().toString(36).substr(2, 9);
    let position = customPosition || { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 };
    let parentId: string | undefined = undefined;
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

    if (type === 'Pod' && activeDeploymentId && !customPosition) {
      const activeDeployment = nodes.find(n => n.id === activeDeploymentId && n.type === 'Deployment');
      if (activeDeployment) {
        parentId = activeDeployment.id;
        position = { x: 0, y: 0 }; 
      }
    } else if (!customPosition) {
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
        replicas: type === 'Deployment' ? 0 : undefined,
        status: type === 'Pod' ? 'pending' : undefined,
        webserver: type === 'Pod' ? 'none' : undefined,
        runtime: type === 'Pod' ? 'none' : undefined,
        isAutoNamed: type === 'Pod',
        onDelete: () => {
          const nodeToDelete = get().nodes.find(n => n.id === id);
          if (nodeToDelete) get().deleteNodes([nodeToDelete]);
        },
        onRename: (newName: string) => {
          set((state) => ({
            nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: newName.toLowerCase().replace(/\s+/g, '-'), isAutoNamed: false } } : n)),
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
        nextNodes = [...nextNodes.filter(n => n.id !== newNode.id), newNode]; 
        
        const parentDeployment = nextNodes.find(n => n.id === parentId);
        if (parentDeployment) {
          const siblingPods = nextNodes.filter(n => n.parentId === parentId);
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
    const idsToDelete = nodesToDelete.map(n => n.id);
    
    set((state) => {
      let updatedNodes = state.nodes.filter(n => !idsToDelete.includes(n.id));
      
      const parentsToUpdate = new Set<string>();
      nodesToDelete.forEach(node => {
        if (node.parentId) parentsToUpdate.add(node.parentId);
      });

      parentsToUpdate.forEach(parentId => {
        const deletedCount = nodesToDelete.filter(n => n.parentId === parentId).length;
        updatedNodes = updatedNodes.map(n => {
          if (n.id === parentId && n.type === 'Deployment') {
            return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - deletedCount) } };
          }
          return n;
        });

        const parentDeployment = updatedNodes.find(n => n.id === parentId);
        if (parentDeployment) {
          const siblingPods = updatedNodes.filter(n => n.parentId === parentId);
          const reLayoutedPods = layoutPodsInDeployment(parentDeployment, siblingPods);
          updatedNodes = updatedNodes.map(n => {
            const reLayoutedPod = reLayoutedPods.find(rp => rp.id === n.id);
            return reLayoutedPod || n;
          });

          const maxPodY = Math.max(0, ...reLayoutedPods.map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
          const minHeightNeeded = maxPodY + 40;
          updatedNodes = updatedNodes.map(n => {
            if (n.id === parentId) {
              return { ...n, height: Math.max(n.height || 0, minHeightNeeded) };
            }
            return n;
          });
        }
      });

      return { 
        nodes: updatedNodes,
        edges: state.edges.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target))
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
    if (node.type === 'Deployment') {
      get().setActiveDeploymentId(node.id);
    }
  },

  onNodeDrag: (event: any, node: Node) => {
    const { nodes } = get();
    if (node.type !== 'Pod') return;

    let newHoveredDeploymentId: string | null = null;
    let newDetachingDeploymentId: string | null = null;

    const podWidth = node.width || node.measured?.width || 160;
    const podHeight = node.height || node.measured?.height || 80;
    const podArea = podWidth * podHeight;

    let podAbsX = node.position.x;
    let podAbsY = node.position.y;
    if (node.parentId) {
        const parent = nodes.find(n => n.id === node.parentId);
        if (parent) {
            podAbsX += parent.position.x;
            podAbsY += parent.position.y;
        }
    }

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
            podAbsX < depAbsX + depWidth &&
            podAbsX + podWidth > depAbsX &&
            podAbsY < depAbsY + depHeight &&
            podAbsY + podHeight > depAbsY;

        if (node.parentId === deployment.id) {
            const overlapX = Math.max(0, Math.min(podAbsX + podWidth, depAbsX + depWidth) - Math.max(podAbsX, depAbsX));
            const overlapY = Math.max(0, Math.min(podAbsY + podHeight, depAbsY + depHeight) - Math.max(podAbsY, depAbsY));
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
        nodes: nextNodes 
    });
  },

  onNodeDragStop: (event: any, node: Node) => {
    const { nodes } = get();
    const finalDetachingDeploymentId = get().detachingDeploymentId;
    const finalHoveredDeploymentId = get().hoveredDeploymentId;
    const activeDeploymentId = get().activeDeploymentId;

    set((state) => ({
      hoveredDeploymentId: null,
      detachingDeploymentId: null,
      nodes: state.nodes.map(n => ({ ...n, data: { ...n.data, isHovered: false, isDetaching: false } }))
    }));

    if (node.type !== 'Pod') return;

    if (activeDeploymentId) {
        const activeDeployment = nodes.find(n => n.id === activeDeploymentId && n.type === 'Deployment');
        if (activeDeployment && node.parentId !== activeDeployment.id) {
            set((state) => {
                let currentNodes = state.nodes;
                if (node.parentId) {
                    currentNodes = currentNodes.map(n => {
                        if (n.id === node.parentId) {
                            return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - 1) } };
                        }
                        return n;
                    });
                }

                const podToAdd = { ...node, parentId: activeDeployment.id };
                let nextNodes = [...currentNodes.filter(n => n.id !== node.id), podToAdd];

                const siblingPods = nextNodes.filter(n => n.parentId === activeDeployment.id);
                const reLayoutedPods = layoutPodsInDeployment(activeDeployment, siblingPods);
                nextNodes = nextNodes.map(n => {
                  const reLayoutedPod = reLayoutedPods.find(rp => rp.id === n.id);
                  return reLayoutedPod || n;
                });

                nextNodes = nextNodes.map(n => {
                  if (n.id === activeDeployment.id) {
                    return { ...n, data: { ...n.data, replicas: (n.data.replicas || 0) + 1 } };
                  }
                  return n;
                });
                
                const maxPodX = Math.max(0, ...nextNodes.filter(n => n.parentId === activeDeployment.id).map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
                const maxPodY = Math.max(0, ...nextNodes.filter(n => n.parentId === activeDeployment.id).map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
                const minWidthNeeded = maxPodX + 20;
                const minHeightNeeded = maxPodY + 40; 
                nextNodes = nextNodes.map(n => {
                  if (n.id === activeDeployment.id) {
                    return { 
                      ...n, 
                      width: Math.max(n.width || 0, minWidthNeeded),
                      height: Math.max(n.height || 0, minHeightNeeded) 
                    };
                  }
                  return n;
                });

                return { nodes: sortNodes(nextNodes) };
            });
            return;
        }
    }

    if (node.parentId && finalDetachingDeploymentId === node.parentId) {
      set((state) => {
        const parent = state.nodes.find(n => n.id === node.parentId);
        if (!parent) return state;

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
    
    if (finalHoveredDeploymentId) {
      set((state) => {
        const targetDeployment = state.nodes.find(n => n.id === finalHoveredDeploymentId);
        if (!targetDeployment) return state;

        let currentNodes = state.nodes;
        if (node.parentId && node.parentId !== finalHoveredDeploymentId) {
            currentNodes = currentNodes.map(n => {
                if (n.id === node.parentId) {
                    return { ...n, data: { ...n.data, replicas: Math.max(0, (n.data.replicas || 0) - 1) } };
                }
                return n;
            });
        }

        const podToAdd = { ...node, parentId: targetDeployment.id };
        let nextNodes = [...currentNodes.filter(n => n.id !== node.id), podToAdd];

        const siblingPods = nextNodes.filter(n => n.parentId === targetDeployment.id);
        const reLayoutedPods = layoutPodsInDeployment(targetDeployment, siblingPods);
        nextNodes = nextNodes.map(n => {
          const reLayoutedPod = reLayoutedPods.find(rp => rp.id === n.id);
          return reLayoutedPod || n;
        });

        nextNodes = nextNodes.map(n => {
          if (n.id === targetDeployment.id && node.parentId !== finalHoveredDeploymentId) {
            return { ...n, data: { ...n.data, replicas: (n.data.replicas || 0) + 1 } };
          }
          return n;
        });

        const maxPodX = Math.max(0, ...nextNodes.filter(n => n.parentId === targetDeployment.id).map(p => (p.position.x || 0) + (p.width || p.measured?.width || 160)));
        const maxPodY = Math.max(0, ...nextNodes.filter(n => n.parentId === targetDeployment.id).map(p => (p.position.y || 0) + (p.height || p.measured?.height || 80)));
        const minWidthNeeded = maxPodX + 20;
        const minHeightNeeded = maxPodY + 40; 
        nextNodes = nextNodes.map(n => {
          if (n.id === targetDeployment.id) {
            return { 
                ...n, 
                width: Math.max(n.width || 0, minWidthNeeded),
                height: Math.max(n.height || 0, minHeightNeeded) 
            };
          }
          return n;
        });
        
        return { nodes: sortNodes(nextNodes) };
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
});
