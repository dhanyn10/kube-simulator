import Yoga from 'yoga-layout';
import { Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { getPodSpacing } from './layoutHelpers';
import { getPodMinimumSize, POD_MIN_DIMENSIONS } from '@/lib/podSizing';

/**
 * Calculates base pod height excluding container image content height.
 *
 * @param data - K8sNodeData for the pod.
 * @param isMegaPod - Flag indicating if pod is a mega pod (replicas >= 100).
 * @returns Base height of the pod in pixels.
 */
export const calculatePodBaseHeight = (
  data: Partial<K8sNodeData>,
  isMegaPod: boolean
): number => {
  const showDashedProgress =
    data.type === 'Pod' &&
    ((data.parentReplicas || 0) > 3 || ((data.replicas || 1) > 1 && !data.parentId));
  let height = 72;
  if (showDashedProgress) height += isMegaPod ? 120 : 14;
  if (
    data.displaySettings?.resources !== false &&
    (data.cpuLimit || data.memoryLimit || data.cpuRequest || data.memoryRequest)
  ) {
    height += 38;
  }
  if (data.displaySettings?.restartPolicy !== false && !!data.restartPolicy) height += 24;

  const showRuntime = Boolean(
    data.displaySettings?.runtime !== false && data.runtime && data.runtime !== 'none'
  );
  const showWebserver = Boolean(
    data.displaySettings?.webserver !== false && data.webserver && data.webserver !== 'none'
  );
  const visibleBadges: string[] = [];
  if (showRuntime && data.runtime) visibleBadges.push(String(data.runtime));
  if (showWebserver && data.webserver) visibleBadges.push(String(data.webserver));
  if (visibleBadges.length > 0) height += 20;

  const hasAttached =
    (data.roles?.length ?? 0) > 0 ||
    (data.configMaps?.length ?? 0) > 0 ||
    (data.secrets?.length ?? 0) > 0 ||
    (data.hpas?.length ?? 0) > 0 ||
    (data.resourceLimits?.length ?? 0) > 0;
  if (hasAttached) height += 28;

  const baseHeight = isMegaPod ? POD_MIN_DIMENSIONS.height * 2 : POD_MIN_DIMENSIONS.height;
  return Math.max(baseHeight, Math.ceil(height));
};

/**
 * Calculates container image content height for a pod.
 *
 * @param data - K8sNodeData for the pod.
 * @param width - Calculated width of the pod.
 * @returns Height of the image content section in pixels, or 0 if hidden/absent.
 */
export const calculatePodContentHeight = (
  data: Partial<K8sNodeData>,
  width: number
): number => {
  const showImage = Boolean(data.displaySettings?.image !== false && data.image);
  if (!showImage) return 0;
  const charsPerLine = Math.max(10, Math.floor((width - 24) / 5.5));
  return Math.ceil(String(data.image).length / charsPerLine) * 12 + 8;
};

export interface DeploymentYogaLayoutResult {
  laidOutPods: Node[];
  width: number;
  height: number;
}

/**
 * Computes Deployment internal layout (Pods, Pod Content, and Footer) using the Yoga Flexbox engine.
 *
 * @param deployment - Parent Deployment node.
 * @param pods - Child Pod nodes inside the Deployment.
 * @param customYoga - Optional custom Yoga engine instance for testing.
 * @returns Object containing laid out child Pod nodes with computed positions and Deployment width/height.
 */
export const calculateDeploymentLayoutWithYoga = (
  deployment: Node,
  pods: Node[],
  customYoga?: typeof Yoga | null
): DeploymentYogaLayoutResult => {
  const YogaEngine = customYoga || Yoga;
  const data = deployment.data as K8sNodeData;
  const isReplicaSet = deployment.type === 'ReplicaSet';

  const paddingX = 24;
  const paddingTop = isReplicaSet ? 30 : 48;

  const hasAttached =
    (data.roles?.length ?? 0) > 0 ||
    (data.configMaps?.length ?? 0) > 0 ||
    (data.secrets?.length ?? 0) > 0 ||
    (data.hpas?.length ?? 0) > 0 ||
    (data.resourceLimits?.length ?? 0) > 0 ||
    pods.some(
      (p) =>
        ((p.data?.roles as any[])?.length ?? 0) > 0 ||
        ((p.data?.configMaps as any[])?.length ?? 0) > 0 ||
        ((p.data?.secrets as any[])?.length ?? 0) > 0 ||
        ((p.data?.hpas as any[])?.length ?? 0) > 0 ||
        ((p.data?.resourceLimits as any[])?.length ?? 0) > 0
    );

  const bottomPadding = hasAttached ? 48 : 40;
  const minWidth = isReplicaSet ? 180 : POD_MIN_DIMENSIONS.width + paddingX * 2 + 10;
  const minHeight = isReplicaSet
    ? 100
    : POD_MIN_DIMENSIONS.height + paddingTop + bottomPadding;

  if (pods.length === 0) {
    let depW = minWidth;
    let depH = minHeight;
    if (data.isManuallyResized) {
      depW = Math.max(depW, deployment.width || minWidth);
      depH = Math.max(depH, deployment.height || minHeight);
    }
    return {
      laidOutPods: [],
      width: depW,
      height: depH,
    };
  }

  // Precompute pod dimensions
  const podInfos = pods.map((pod) => {
    const isMegaPod = (Number(pod.data?.replicas) || 0) >= 100 || (Number(pod.data?.parentReplicas) || 0) >= 100;
    const minSize = getPodMinimumSize(pod.data);
    const podW = Math.max(pod.width || 0, pod.measured?.width || 0, minSize.width);
    const styleMinH = Number((pod.style as any)?.minHeight) || 0;
    const calculatedBase = calculatePodBaseHeight(pod.data || {}, isMegaPod);
    const baseH = Math.max(styleMinH, calculatedBase);
    const contentH = calculatePodContentHeight(pod.data || {}, podW);
    const totalH = baseH + contentH;
    const spacing = getPodSpacing(isMegaPod);
    return {
      pod,
      isMegaPod,
      podW,
      baseH,
      contentH,
      totalH,
      spacing,
      styleMinH,
      minHeight: Math.max(styleMinH, minSize.height),
    };
  });

  const maxPodWidth = Math.max(0, ...podInfos.map((p) => p.podW));
  const deploymentWidth = Math.max(
    minWidth,
    deployment.width || 0,
    maxPodWidth + paddingX * 2
  );

  // Fallback layout if Yoga engine is unavailable
  if (!YogaEngine || !YogaEngine.Node) {
    let currentY = paddingTop;
    const laidOutPods: Node[] = [];

    podInfos.forEach((info) => {
      const pos = { x: paddingX, y: currentY };
      currentY += info.totalH + info.spacing;

      laidOutPods.push({
        ...info.pod,
        width: info.podW,
        height: info.totalH,
        style: {
          ...info.pod.style,
          width: info.podW,
          minHeight: Math.max(info.styleMinH, info.totalH),
        },
        position: pos,
      });
    });

    const calculatedHeight = Math.max(minHeight, currentY + bottomPadding - podInfos[podInfos.length - 1].spacing);
    let finalW = deploymentWidth;
    let finalH = calculatedHeight;
    if (data.isManuallyResized) {
      finalW = Math.max(finalW, deployment.width || minWidth);
      finalH = Math.max(finalH, deployment.height || minHeight);
    }

    return { laidOutPods, width: finalW, height: finalH };
  }

  // Build Yoga Tree
  const rootNode = YogaEngine.Node.create();
  rootNode.setFlexDirection(YogaEngine.FLEX_DIRECTION_COLUMN);
  rootNode.setPadding(YogaEngine.EDGE_TOP, paddingTop);
  rootNode.setPadding(YogaEngine.EDGE_BOTTOM, bottomPadding);
  rootNode.setPadding(YogaEngine.EDGE_LEFT, paddingX);
  rootNode.setPadding(YogaEngine.EDGE_RIGHT, paddingX);

  const podYogaNodes: {
    podNode: any;
    baseNode: any;
    contentNode: any;
    info: (typeof podInfos)[0];
  }[] = [];

  podInfos.forEach((info, index) => {
    const podNode = YogaEngine.Node.create();
    podNode.setFlexDirection(YogaEngine.FLEX_DIRECTION_COLUMN);
    podNode.setWidth(info.podW);

    if (index < podInfos.length - 1) {
      podNode.setMargin(YogaEngine.EDGE_BOTTOM, info.spacing);
    }

    const baseNode = YogaEngine.Node.create();
    baseNode.setHeight(info.baseH);
    podNode.insertChild(baseNode, 0);

    const contentNode = YogaEngine.Node.create();
    contentNode.setHeight(info.contentH);
    podNode.insertChild(contentNode, 1);

    rootNode.insertChild(podNode, index);

    podYogaNodes.push({ podNode, baseNode, contentNode, info });
  });

  // Calculate Layout using Yoga
  rootNode.calculateLayout(deploymentWidth, undefined, YogaEngine.DIRECTION_LTR);

  const laidOutPods: Node[] = podYogaNodes.map(({ podNode, info }) => {
    const computedTop = podNode.getComputedTop();
    const computedLeft = podNode.getComputedLeft();
    const computedHeight = podNode.getComputedHeight();
    const computedWidth = podNode.getComputedWidth();

    return {
      ...info.pod,
      width: computedWidth,
      height: computedHeight,
      style: {
        ...info.pod.style,
        width: computedWidth,
        minHeight: Math.max(info.styleMinH, computedHeight),
      },
      position: { x: computedLeft, y: computedTop },
    };
  });

  const computedRootHeight = rootNode.getComputedHeight();
  rootNode.freeRecursive();

  let finalWidth = deploymentWidth;
  let finalHeight = Math.max(minHeight, computedRootHeight);

  if (data.isManuallyResized) {
    finalWidth = Math.max(finalWidth, deployment.width || minWidth);
    finalHeight = Math.max(finalHeight, deployment.height || minHeight);
  }

  return {
    laidOutPods,
    width: finalWidth,
    height: finalHeight,
  };
};
