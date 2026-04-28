import { Node } from '@xyflow/react';

export const sortNodes = (nodes: Node[]): Node[] => {
  return [...nodes].sort((a, b) => {
    if (a.type === 'Deployment' && b.type === 'Pod') return -1;
    if (a.type === 'Pod' && b.type === 'Deployment') return 1;
    return 0;
  });
};

// Helper function to layout pods within a deployment
export const layoutPodsInDeployment = (deployment: Node, pods: Node[]): Node[] => {
  const paddingX = 20;
  const paddingY = 40; // Account for deployment header
  const spacing = 10;
  
  const deploymentWidth = deployment.width || deployment.measured?.width || 320;
  const deployableWidth = Math.max(100, deploymentWidth - (2 * paddingX));

  let currentX = paddingX;
  let currentY = paddingY;
  let rowMaxHeight = 0;

  const updatedPods = pods.map(pod => {
    const podW = pod.width || pod.measured?.width || 160;
    const podH = pod.height || pod.measured?.height || 80;

    // If the current pod doesn't fit in the current row, move to next row
    if (currentX + podW > deployableWidth + paddingX && currentX > paddingX) {
      currentX = paddingX; // Reset X for new row
      currentY += rowMaxHeight + spacing; // Move Y down by max height of previous row + spacing
      rowMaxHeight = 0; // Reset max height for new row
    }

    // Update max height for the current row
    rowMaxHeight = Math.max(rowMaxHeight, podH);

    const newPosition = { x: currentX, y: currentY };
    currentX += podW + spacing; // Advance X for next pod

    return {
      ...pod,
      position: newPosition,
    };
  });

  return updatedPods;
};
