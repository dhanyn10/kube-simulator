import { Node } from '@xyflow/react';
import { 
  getPodMinimumSize, 
  POD_MIN_DIMENSIONS,
  layoutPodsInDeployment
} from '../../helpers';
import { FlowState } from '../../types';

export const resizeHandlers = (set: any, get: () => FlowState) => ({
  onNodeResize: (event: any, node: Node) => {
    set((state: FlowState) => {
      const currentNode = state.nodes.find((n: Node) => n.id === node.id);
      const minSize = currentNode?.type === 'Pod'
        ? getPodMinimumSize(currentNode.data)
        : { width: node.width || 0, height: node.height || 0 };
      const nextWidth = Math.max(node.width || 0, minSize.width);
      const nextHeight = Math.max(node.height || 0, minSize.height);
      let nextNodes = state.nodes.map((n: Node) => n.id === node.id ? {
          ...n,
          width: nextWidth,
          height: n.type === 'Pod' ? undefined : nextHeight,
          style: n.type === 'Pod' ? { ...(n.style || {}), width: nextWidth, minHeight: nextHeight } : { width: nextWidth, height: nextHeight },
          measured: n.type === 'Pod' ? undefined : { width: nextWidth, height: nextHeight },
          data: { ...n.data, isManuallyResized: true }
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
});
