import { Node } from '@xyflow/react';
import { loadYoga } from 'yoga-layout/load';
import { K8sNodeData } from '@/types';
import {
  getPodMinimumSize,
  calculatePodBaseHeight,
  calculatePodContentHeight,
  calculatePodAttachedHeight,
  POD_MIN_DIMENSIONS
} from '@/lib/podSizing';
import { getPodSpacing } from './layoutHelpers';

export type YogaEngine = Awaited<ReturnType<typeof loadYoga>>;

let cachedYogaInstance: YogaEngine | null = null;

try {
  cachedYogaInstance = await loadYoga();
} catch {
  cachedYogaInstance = null;
}

/**
 * Returns the currently cached Yoga Layout engine instance.
 *
 * @returns Promise resolving to the cached Yoga Layout engine instance.
 */
export const getYogaEngine = async (): Promise<YogaEngine> => {
  if (cachedYogaInstance) {
    return cachedYogaInstance;
  }
  cachedYogaInstance = await loadYoga();
  return cachedYogaInstance;
};

/**
 * Returns the currently cached Yoga Layout engine instance synchronously if available.
 *
 * @returns Cached Yoga instance or null if not yet initialized.
 */
export const getYogaInstanceSync = (): YogaEngine | null => {
  return cachedYogaInstance;
};

/**
 * Calculates bottom padding for Deployment container based on attached resource badges.
 */
const calculateBottomPadding = (data: K8sNodeData): number => {
  const rolesCount = data.roles?.length ?? 0;
  const configMapsCount = data.configMaps?.length ?? 0;
  const secretsCount = data.secrets?.length ?? 0;
  const hpasCount = data.hpas?.length ?? 0;
  const resourceLimitsCount = data.resourceLimits?.length ?? 0;
  const totalCount = rolesCount + configMapsCount + secretsCount + hpasCount + resourceLimitsCount;

  if (totalCount === 0) return 40;
  const rows = Math.max(1, Math.ceil(totalCount / 3));
  return 40 + rows * 36;
};

/**
 * Builds Yoga sub-tree for attached item badges (Roles, ConfigMaps, Secrets, ResourceLimits, HPAs) using DOM principles.
 */
const buildAttachedContainerYogaNode = (
  yoga: YogaEngine,
  podData: K8sNodeData,
  podWidth: number
) => {
  const roles = podData.roles || [];
  const configMaps = podData.configMaps || [];
  const secrets = podData.secrets || [];
  const resourceLimits = podData.resourceLimits || [];
  const hpas = podData.hpas || [];
  const allAttachedItems = [...roles, ...configMaps, ...secrets, ...resourceLimits, ...hpas];

  if (allAttachedItems.length === 0) return null;

  const attachedHeight = calculatePodAttachedHeight(podData);
  const attachedContainerNode = yoga.Node.create();
  attachedContainerNode.setFlexDirection(yoga.FLEX_DIRECTION_ROW);
  attachedContainerNode.setFlexWrap(yoga.WRAP_WRAP);
  attachedContainerNode.setWidth(podWidth);
  attachedContainerNode.setGap(yoga.GUTTER_ALL, 6);
  attachedContainerNode.setMargin(yoga.EDGE_TOP, 8);
  attachedContainerNode.setMinHeight(attachedHeight);

  let badgeIndex = 0;
  for (const _item of allAttachedItems) {
    const itemNode = yoga.Node.create();
    itemNode.setWidth(28);
    itemNode.setHeight(28);
    attachedContainerNode.insertChild(itemNode, badgeIndex++);
  }

  return attachedContainerNode;
};

/**
 * Builds Yoga sub-tree node for an individual Pod card.
 */
const buildPodYogaSubTree = (
  yoga: YogaEngine,
  pod: Node,
  idx: number,
  isLastPod: boolean
) => {
  const podData = (pod.data as unknown as K8sNodeData) || ({} as K8sNodeData);
  const showRuntime = Boolean(podData.displaySettings?.runtime !== false && podData.runtime && podData.runtime !== 'none');
  const showWebserver = Boolean(podData.displaySettings?.webserver !== false && podData.webserver && podData.webserver !== 'none');
  const visibleBadges: string[] = [];
  if (showRuntime && podData.runtime) visibleBadges.push(String(podData.runtime));
  if (showWebserver && podData.webserver) visibleBadges.push(String(podData.webserver));

  const isMegaPod = (podData.replicas || 0) >= 100 || (podData.parentReplicas || 0) >= 100;
  const minSize = getPodMinimumSize(podData);

  const podWidth = podData.isManuallyResized
    ? Math.max(pod.width || 0, pod.measured?.width || 0, minSize.width)
    : minSize.width;

  const baseHeight = calculatePodBaseHeight(podData, podWidth, visibleBadges, isMegaPod);
  const contentHeight = calculatePodContentHeight(podData, podWidth);

  const podYogaNode = yoga.Node.create();
  podYogaNode.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN);
  podYogaNode.setWidth(podWidth);
  podYogaNode.setHeightAuto();
  podYogaNode.setMinHeight(minSize.height);

  const podSpacing = getPodSpacing(isMegaPod);
  podYogaNode.setMargin(yoga.EDGE_BOTTOM, isLastPod ? 0 : podSpacing);

  const baseYogaNode = yoga.Node.create();
  baseYogaNode.setWidth(podWidth);
  baseYogaNode.setMinHeight(baseHeight);
  podYogaNode.insertChild(baseYogaNode, 0);

  const contentYogaNode = yoga.Node.create();
  contentYogaNode.setWidth(podWidth);
  contentYogaNode.setMinHeight(contentHeight);
  podYogaNode.insertChild(contentYogaNode, 1);

  const attachedContainerNode = buildAttachedContainerYogaNode(yoga, podData, podWidth);
  if (attachedContainerNode) {
    podYogaNode.insertChild(attachedContainerNode, 2);
  }

  return podYogaNode;
};

/**
 * Fallback layout calculation when Yoga engine instance is not available synchronously.
 */
const calculateFallbackLayout = (
  pods: Node[],
  paddingX: number,
  paddingY: number,
  bottomPadding: number,
  minHeight: number,
  deploymentWidth: number,
  data: K8sNodeData,
  deployment: Node
) => {
  let currentY = paddingY;
  const laidOutPods = pods.map((pod, idx) => {
    const podData = (pod.data as unknown as K8sNodeData) || ({} as K8sNodeData);
    const minSize = getPodMinimumSize(podData);
    const podW = podData.isManuallyResized
      ? Math.max(pod.width || 0, pod.measured?.width || 0, minSize.width)
      : minSize.width;
    const isMegaPod = (podData.replicas || 0) >= 100 || (podData.parentReplicas || 0) >= 100;
    const podH = minSize.height;

    const pos = { x: paddingX, y: currentY };
    const isLastPod = idx === pods.length - 1;
    const spacing = isLastPod ? 0 : getPodSpacing(isMegaPod);
    currentY += podH + spacing;

    const cleanStyle = { ...pod.style };
    delete (cleanStyle as any).height;

    return {
      ...pod,
      width: podW,
      height: podH,
      style: {
        ...cleanStyle,
        width: podW,
        minHeight: Math.max(Number((pod.style as any)?.minHeight) || 0, minSize.height),
      },
      position: pos,
    };
  });

  const calculatedHeight = pods.length === 0 ? minHeight : currentY + bottomPadding;
  const width = data.isManuallyResized ? Math.max(deploymentWidth, deployment.width || minHeight) : deploymentWidth;
  const height = data.isManuallyResized ? Math.max(calculatedHeight, deployment.height || minHeight) : calculatedHeight;

  return { width, height, laidOutPods };
};

/**
 * Calculates internal sub-tree layout for Deployment node and its child Pods using Yoga Flexbox Layout Engine.
 *
 * @param deployment - Parent Deployment canvas node.
 * @param pods - Array of child Pod canvas nodes.
 * @param yogaSync - Optional pre-loaded Yoga Layout engine instance.
 * @returns Object containing computed width, height, and array of laid out child Pod nodes with updated positions.
 */
export const calculateDeploymentLayoutWithYoga = (
  deployment: Node,
  pods: Node[],
  yogaSync?: YogaEngine | null
): { width: number; height: number; laidOutPods: Node[] } => {
  const yoga = yogaSync === null ? null : (yogaSync || cachedYogaInstance);

  const data = (deployment.data as unknown as K8sNodeData) || ({} as K8sNodeData);
  const isReplicaSet = deployment.type === 'ReplicaSet';

  const bottomPadding = calculateBottomPadding(data);
  const paddingX = 24;
  const paddingY = isReplicaSet ? 30 : 48;

  const minWidth = isReplicaSet ? 180 : (POD_MIN_DIMENSIONS.width + paddingX * 2 + 10);
  const minHeight = isReplicaSet ? 100 : (POD_MIN_DIMENSIONS.height + paddingY + bottomPadding);

  const maxPodWidth = Math.max(0, ...pods.map(p => getPodMinimumSize((p.data as unknown as K8sNodeData) || {}).width));
  let deploymentWidth = Math.max(minWidth, maxPodWidth + paddingX * 2);

  if (data.isManuallyResized && deployment.width) {
    deploymentWidth = Math.max(deploymentWidth, deployment.width);
  }

  if (!yoga) {
    return calculateFallbackLayout(pods, paddingX, paddingY, bottomPadding, minHeight, deploymentWidth, data, deployment);
  }

  const rootNode = yoga.Node.create();
  rootNode.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN);
  rootNode.setPadding(yoga.EDGE_TOP, paddingY);
  rootNode.setPadding(yoga.EDGE_LEFT, paddingX);
  rootNode.setPadding(yoga.EDGE_RIGHT, paddingX);
  rootNode.setPadding(yoga.EDGE_BOTTOM, bottomPadding);
  rootNode.setWidth(deploymentWidth);

  pods.forEach((pod, idx) => {
    const isLastPod = idx === pods.length - 1;
    const podYogaNode = buildPodYogaSubTree(yoga, pod, idx, isLastPod);
    rootNode.insertChild(podYogaNode, idx);
  });

  rootNode.calculateLayout(deploymentWidth, undefined, yoga.DIRECTION_LTR);

  const laidOutPods = pods.map((pod, idx) => {
    const podYogaNode = rootNode.getChild(idx);
    const left = podYogaNode.getComputedLeft();
    const top = podYogaNode.getComputedTop();
    const computedW = podYogaNode.getComputedWidth();
    const computedH = podYogaNode.getComputedHeight();

    const minSize = getPodMinimumSize((pod.data as unknown as K8sNodeData) || {});

    const cleanStyle = { ...pod.style };
    delete (cleanStyle as any).height;

    return {
      ...pod,
      width: computedW,
      height: computedH,
      style: {
        ...cleanStyle,
        width: computedW,
        minHeight: Math.max(Number((pod.style as any)?.minHeight) || 0, minSize.height),
      },
      position: { x: left, y: top },
    };
  });

  let calculatedWidth = rootNode.getComputedWidth();
  let calculatedHeight = rootNode.getComputedHeight();

  rootNode.freeRecursive();

  if (data.isManuallyResized) {
    calculatedWidth = Math.max(calculatedWidth, deployment.width || minWidth);
    calculatedHeight = Math.max(calculatedHeight, deployment.height || minHeight);
  } else {
    calculatedWidth = Math.max(minWidth, calculatedWidth);
    calculatedHeight = Math.max(minHeight, calculatedHeight);
  }

  return {
    width: calculatedWidth,
    height: calculatedHeight,
    laidOutPods,
  };
};
