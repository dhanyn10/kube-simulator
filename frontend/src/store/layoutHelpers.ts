import { Node } from '@xyflow/react';

interface AlignmentParams {
  nP: { pos: number; type: string };
  otherPoints: number[];
  otherNode: Node;
  guides: Map<number, any>;
  snap: Map<number, boolean>;
  config: { threshold: number; tolerance: number };
  bounds: { min: number; max: number };
  axis: 'x' | 'y';
}

const checkAlignment = ({ nP, otherPoints, otherNode, guides, snap, config, bounds, axis }: AlignmentParams) => {
  for (const oP of otherPoints) {
    if (Math.abs(nP.pos - oP) < config.threshold) {
      const guideData = {
        position: oP,
        targetNodeId: otherNode.id,
        type: nP.type === 'center' ? 'center' : 'edge',
        ...(axis === 'x' ? { minY: bounds.min, maxY: bounds.max } : { minX: bounds.min, maxX: bounds.max })
      };
      guides.set(oP, guideData);
      if (Math.abs(nP.pos - oP) < config.tolerance) snap.set(oP, true);
    }
  }
};

interface AxisAlignmentParams {
  nP: { pos: number; type: string };
  otherPoints: number[];
  otherNode: Node;
  guides: Map<number, any>;
  snap: Map<number, boolean>;
  config: { threshold: number; tolerance: number };
  nodeAbs: { x: number; y: number };
  otherAbs: { x: number; y: number };
  size: { node: number; other: number };
}

export const checkXAlignment = ({ nP, otherPoints, otherNode, guides, snap, config, nodeAbs, otherAbs, size }: AxisAlignmentParams) => {
  const bounds = { min: Math.min(nodeAbs.y, otherAbs.y), max: Math.max(nodeAbs.y + size.node, otherAbs.y + size.other) };
  checkAlignment({ nP, otherPoints, otherNode, guides, snap, config, bounds, axis: 'x' });
};

export const checkYAlignment = ({ nP, otherPoints, otherNode, guides, snap, config, nodeAbs, otherAbs, size }: AxisAlignmentParams) => {
  const bounds = { min: Math.min(nodeAbs.x, otherAbs.x), max: Math.max(nodeAbs.x + size.node, otherAbs.x + size.other) };
  checkAlignment({ nP, otherPoints, otherNode, guides, snap, config, bounds, axis: 'y' });
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
