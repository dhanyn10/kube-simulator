import { Node } from '@xyflow/react';

export const checkXAlignment = (nP: any, otherPointsX: number[], otherNode: Node, verticalGuides: Map<number, any>, vSnap: Map<number, boolean>, SNAP_THRESHOLD: number, SNAP_TOLERANCE: number, nodeAbs: any, otherAbs: any, nodeHeight: number, otherHeight: number) => {
  for (const oP of otherPointsX) {
    if (Math.abs(nP.pos - oP) < SNAP_THRESHOLD) {
      verticalGuides.set(oP, {
        position: oP,
        targetNodeId: otherNode.id,
        type: nP.type === 'center' ? 'center' : 'edge',
        minY: Math.min(nodeAbs.y, otherAbs.y),
        maxY: Math.max(nodeAbs.y + nodeHeight, otherAbs.y + otherHeight)
      });
      if (Math.abs(nP.pos - oP) < SNAP_TOLERANCE) {
        vSnap.set(oP, true);
      }
    }
  }
};

export const checkYAlignment = (nP: any, otherPointsY: number[], otherNode: Node, horizontalGuides: Map<number, any>, hSnap: Map<number, boolean>, SNAP_THRESHOLD: number, SNAP_TOLERANCE: number, nodeAbs: any, otherAbs: any, nodeWidth: number, otherWidth: number) => {
  for (const oP of otherPointsY) {
    if (Math.abs(nP.pos - oP) < SNAP_THRESHOLD) {
      horizontalGuides.set(oP, {
        position: oP,
        targetNodeId: otherNode.id,
        type: nP.type === 'center' ? 'center' : 'edge',
        minX: Math.min(nodeAbs.x, otherAbs.x),
        maxX: Math.max(nodeAbs.x + nodeWidth, otherAbs.x + otherWidth)
      });
      if (Math.abs(nP.pos - oP) < SNAP_TOLERANCE) {
        hSnap.set(oP, true);
      }
    }
  }
};

export const getPodSpacing = (isMegaPod: boolean) => isMegaPod ? 56 : 20;

export const getReplicaThresholds = (totalReplicas: number) => {
  const targetPodReplicas: number[] = [];
  if (totalReplicas <= 3) {
    for (let i = 0; i < totalReplicas; i++) targetPodReplicas.push(1);
  } else {
    let remaining = totalReplicas;
    while (remaining > 0) {
      const count = remaining >= 100 ? 100 : Math.min(remaining, 10);
      targetPodReplicas.push(count);
      remaining -= count;
    }
  }
  return targetPodReplicas;
};
