import { Node } from '@xyflow/react';

const checkAlignment = (nP: any, otherPoints: number[], otherNode: Node, guides: Map<number, any>, snap: Map<number, boolean>, threshold: number, tolerance: number, bounds: { min: number, max: number }, axis: 'x' | 'y') => {
  for (const oP of otherPoints) {
    if (Math.abs(nP.pos - oP) < threshold) {
      const guideData = {
        position: oP,
        targetNodeId: otherNode.id,
        type: nP.type === 'center' ? 'center' : 'edge',
        ...(axis === 'x' ? { minY: bounds.min, maxY: bounds.max } : { minX: bounds.min, maxX: bounds.max })
      };
      guides.set(oP, guideData);
      if (Math.abs(nP.pos - oP) < tolerance) snap.set(oP, true);
    }
  }
};

export const checkXAlignment = (nP: any, otherPointsX: number[], otherNode: Node, verticalGuides: Map<number, any>, vSnap: Map<number, boolean>, SNAP_THRESHOLD: number, SNAP_TOLERANCE: number, nodeAbs: any, otherAbs: any, nodeHeight: number, otherHeight: number) => {
  const bounds = { min: Math.min(nodeAbs.y, otherAbs.y), max: Math.max(nodeAbs.y + nodeHeight, otherAbs.y + otherHeight) };
  checkAlignment(nP, otherPointsX, otherNode, verticalGuides, vSnap, SNAP_THRESHOLD, SNAP_TOLERANCE, bounds, 'x');
};

export const checkYAlignment = (nP: any, otherPointsY: number[], otherNode: Node, horizontalGuides: Map<number, any>, hSnap: Map<number, boolean>, SNAP_THRESHOLD: number, SNAP_TOLERANCE: number, nodeAbs: any, otherAbs: any, nodeWidth: number, otherWidth: number) => {
  const bounds = { min: Math.min(nodeAbs.x, otherAbs.x), max: Math.max(nodeAbs.x + nodeWidth, otherAbs.x + otherWidth) };
  checkAlignment(nP, otherPointsY, otherNode, horizontalGuides, hSnap, SNAP_THRESHOLD, SNAP_TOLERANCE, bounds, 'y');
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
