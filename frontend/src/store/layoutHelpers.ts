import { Node } from '@xyflow/react';

export interface AlignmentCandidate {
  position: number;
  targetNodeId: string;
  sourceType: 'center' | 'edge';
  targetType: 'center' | 'edge';
  targetCenterPos: number; // The center of the reference node on the cross-axis
  distance: number;
  crossDistance: number;
  min: number;
  max: number;
  axis: 'x' | 'y';
  isConnected?: boolean;
}

interface AlignmentParams {
  nP: { pos: number; type: string };
  otherPoints: { pos: number; type: string }[];
  otherNode: Node;
  config: { threshold: number; tolerance: number };
  nodeAbs: { x: number; y: number };
  otherAbs: { x: number; y: number };
  size: { node: number; other: number };
  axis: 'x' | 'y';
  isConnected?: boolean;
}

export const getAlignmentCandidates = ({
  nP,
  otherPoints,
  otherNode,
  config,
  nodeAbs,
  otherAbs,
  size,
  axis,
  isConnected
}: AlignmentParams): AlignmentCandidate[] => {
  const candidates: AlignmentCandidate[] = [];

  for (const oP of otherPoints) {
    const distance = Math.abs(nP.pos - oP.pos);
    if (distance <= config.threshold) {
      const crossDistance = axis === 'x'
        ? Math.abs((nodeAbs.y + size.node / 2) - (otherAbs.y + size.other / 2))
        : Math.abs((nodeAbs.x + size.node / 2) - (otherAbs.x + size.other / 2));

      const min = axis === 'x'
        ? Math.min(nodeAbs.y, otherAbs.y)
        : Math.min(nodeAbs.x, otherAbs.x);

      const max = axis === 'x'
        ? Math.max(nodeAbs.y + size.node, otherAbs.y + size.other)
        : Math.max(nodeAbs.x + size.node, otherAbs.x + size.other);

      candidates.push({
        position: oP.pos,
        targetNodeId: otherNode.id,
        sourceType: nP.type as 'center' | 'edge',
        targetType: oP.type as 'center' | 'edge',
        targetCenterPos: axis === 'x' ? otherAbs.y + size.other / 2 : otherAbs.x + size.other / 2,
        distance,
        crossDistance,
        min,
        max,
        axis,
        isConnected
      });
    }
  }

  return candidates;
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
