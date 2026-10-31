import { Node } from '@xyflow/react';
import { loadYoga } from 'yoga-layout/load';
import { K8sNodeData } from '@/types';
import {
  getPodMinimumSize,
  calculatePodBaseHeight,
  calculatePodContentHeight,
  calculatePodAttachedHeight,
  calculatePodConfigMapVarsHeight,
  POD_MIN_DIMENSIONS
} from '@/lib/podSizing';
import { getPodReplicaInfo } from '@/lib/podReplicaHelpers';
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

const CARD_BASE_DIMENSIONS: Record<string, { minWidth: number; minHeight: number }> = {
  Service: { minWidth: 180, minHeight: 88 },
  Ingress: { minWidth: 180, minHeight: 96 },
  PVC: { minWidth: 168, minHeight: 88 },
  HPA: { minWidth: 168, minHeight: 84 },
  ResourceLimit: { minWidth: 168, minHeight: 84 },
  ConfigMap: { minWidth: 168, minHeight: 80 },
  Secret: { minWidth: 168, minHeight: 80 },
  Role: { minWidth: 168, minHeight: 80 },
  Internet: { minWidth: 140, minHeight: 70 },
};

/**
 * Returns base dimensions for a node type fallback.
 */
const getNodeBaseDimensions = (nodeType: string): { minWidth: number; minHeight: number } => {
  return CARD_BASE_DIMENSIONS[nodeType] ?? { minWidth: 168, minHeight: 80 };
};

/**
 * Calculates card dimensions for a Pod node.
 */
const calculatePodCardDimensions = (
  node: { width?: number; height?: number },
  data: K8sNodeData
): { width: number; height: number } => {
  const minSize = getPodMinimumSize(data);
  const width = data.isManuallyResized ? Math.max(node.width || 0, minSize.width) : minSize.width;
  const height = data.isManuallyResized ? Math.max(node.height || 0, minSize.height) : minSize.height;
  return { width, height };
};

/**
 * Builds Yoga layout sub-tree for card node and returns calculated dimensions.
 */
const calculateYogaCardLayout = (
  yoga: YogaEngine,
  computedWidth: number,
  baseMinHeight: number,
  attachedHeight: number,
  data: K8sNodeData,
  node: { width?: number; height?: number }
): { width: number; height: number } => {
  const rootNode = yoga.Node.create();
  rootNode.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN);
  rootNode.setPadding(yoga.EDGE_ALL, 12);
  rootNode.setWidth(computedWidth);

  const headerNode = yoga.Node.create();
  headerNode.setWidth(computedWidth - 24);
  headerNode.setMinHeight(24);
  rootNode.insertChild(headerNode, 0);

  const bodyNode = yoga.Node.create();
  bodyNode.setWidth(computedWidth - 24);
  bodyNode.setMinHeight(baseMinHeight - 48);
  rootNode.insertChild(bodyNode, 1);

  if (attachedHeight > 0) {
    const attachedNode = buildAttachedContainerYogaNode(yoga, data, computedWidth - 24);
    if (attachedNode) {
      rootNode.insertChild(attachedNode, 2);
    }
  }

  rootNode.calculateLayout(computedWidth, undefined, yoga.DIRECTION_LTR);

  let finalWidth = rootNode.getComputedWidth();
  let finalHeight = rootNode.getComputedHeight();
  rootNode.freeRecursive();

  if (data.isManuallyResized) {
    finalWidth = Math.max(node.width || 0, finalWidth);
    finalHeight = Math.max(node.height || 0, finalHeight);
  }

  return {
    width: Math.ceil(finalWidth),
    height: Math.ceil(finalHeight),
  };
};

/**
 * Calculates intrinsic layout dimensions for standalone card nodes (Service, Ingress, PVC, ConfigMap, Secret, Role, HPA, ResourceLimit, Internet, Pod)
 * using Yoga flexbox engine.
 *
 * @param node - The React Flow node or node data object.
 * @param yogaSync - Optional pre-loaded Yoga Layout engine instance.
 * @returns Computed width and height for the card node.
 */
export const calculateCardLayoutWithYoga = (
  node: { type?: string; width?: number; height?: number; data?: any },
  yogaSync?: YogaEngine | null
): { width: number; height: number } => {
  const yoga = yogaSync === null ? null : (yogaSync || cachedYogaInstance);
  const data: K8sNodeData = (node.data as unknown as K8sNodeData) || ({} as K8sNodeData);
  const nodeType = node.type || data.type || '';

  if (nodeType === 'Pod') {
    return calculatePodCardDimensions(node, data);
  }

  const { minWidth: baseMinWidth, minHeight: rawBaseMinHeight } = getNodeBaseDimensions(nodeType);
  const ingressPathCount =
    nodeType === 'Ingress' && data.displaySettings?.path !== false && Array.isArray(data.ingressPaths)
      ? data.ingressPaths.length
      : 0;
  const ingressExtraHeight = ingressPathCount > 1 ? (ingressPathCount - 1) * 16 : 0;
  const baseMinHeight = rawBaseMinHeight + ingressExtraHeight;

  const attachedHeight = calculatePodAttachedHeight(data);
  const textLabelLength = String(data.label || '').length;
  const computedLabelWidth = textLabelLength * 7 + 36;
  const computedWidth = Math.max(baseMinWidth, computedLabelWidth);
  const computedHeight = baseMinHeight + attachedHeight;

  if (!yoga) {
    const width = data.isManuallyResized ? Math.max(node.width || 0, computedWidth) : computedWidth;
    const height = data.isManuallyResized ? Math.max(node.height || 0, computedHeight) : computedHeight;
    return { width, height };
  }

  return calculateYogaCardLayout(yoga, computedWidth, baseMinHeight, attachedHeight, data, node);
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
  isLastPod: boolean,
  deployment?: Node
) => {
  const podData = (pod.data as unknown as K8sNodeData) || ({} as K8sNodeData);
  const parentData = deployment ? (deployment.data as unknown as K8sNodeData) : undefined;
  const showRuntime = Boolean(podData.displaySettings?.runtime !== false && podData.runtime && podData.runtime !== 'none');
  const showWebserver = Boolean(podData.displaySettings?.webserver !== false && podData.webserver && podData.webserver !== 'none');
  const visibleBadges: string[] = [];
  if (showRuntime && podData.runtime) visibleBadges.push(String(podData.runtime));
  if (showWebserver && podData.webserver) visibleBadges.push(String(podData.webserver));

  const { isMegaPod } = getPodReplicaInfo(podData);
  const minSize = getPodMinimumSize(podData, parentData);

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

  let childIndex = 2;
  const configMapVarsHeight = calculatePodConfigMapVarsHeight(podData, parentData);
  if (configMapVarsHeight > 0) {
    const cmYogaNode = yoga.Node.create();
    cmYogaNode.setWidth(podWidth);
    cmYogaNode.setMinHeight(configMapVarsHeight);
    podYogaNode.insertChild(cmYogaNode, childIndex++);
  }

  const attachedContainerNode = buildAttachedContainerYogaNode(yoga, podData, podWidth);
  if (attachedContainerNode) {
    podYogaNode.insertChild(attachedContainerNode, childIndex);
  }

  return podYogaNode;
};

export interface FallbackLayoutConfig {
  pods: Node[];
  paddingX: number;
  paddingY: number;
  bottomPadding: number;
  minHeight: number;
  deploymentWidth: number;
  data: K8sNodeData;
  deployment: Node;
}

/**
 * Fallback layout calculation when Yoga engine instance is not available synchronously.
 */
const calculateFallbackLayout = (config: FallbackLayoutConfig) => {
  const { pods, paddingX, paddingY, bottomPadding, minHeight, deploymentWidth, data, deployment } = config;
  let currentY = paddingY;
  const laidOutPods = pods.map((pod, idx) => {
    const podData = (pod.data as unknown as K8sNodeData) || ({} as K8sNodeData);
    const minSize = getPodMinimumSize(podData, data);
    const podW = podData.isManuallyResized
      ? Math.max(pod.width || 0, pod.measured?.width || 0, minSize.width)
      : minSize.width;
    const isMegaPod = getPodReplicaInfo(podData).isMegaPod;
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
      measured: { width: podW, height: podH },
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

  const maxPodWidth = Math.max(0, ...pods.map(p => getPodMinimumSize((p.data as unknown as K8sNodeData) || {}, data).width));
  let deploymentWidth = Math.max(minWidth, maxPodWidth + paddingX * 2);

  if (data.isManuallyResized && deployment.width) {
    deploymentWidth = Math.max(deploymentWidth, deployment.width);
  }

  if (!yoga) {
    return calculateFallbackLayout({
      pods,
      paddingX,
      paddingY,
      bottomPadding,
      minHeight,
      deploymentWidth,
      data,
      deployment,
    });
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
    const podYogaNode = buildPodYogaSubTree(yoga, pod, idx, isLastPod, deployment);
    rootNode.insertChild(podYogaNode, idx);
  });

  rootNode.calculateLayout(deploymentWidth, undefined, yoga.DIRECTION_LTR);

  const laidOutPods = pods.map((pod, idx) => {
    const podYogaNode = rootNode.getChild(idx);
    const left = podYogaNode.getComputedLeft();
    const top = podYogaNode.getComputedTop();
    const computedW = podYogaNode.getComputedWidth();
    const computedH = podYogaNode.getComputedHeight();

    const minSize = getPodMinimumSize((pod.data as unknown as K8sNodeData) || {}, data);

    const cleanStyle = { ...pod.style };
    delete (cleanStyle as any).height;

    return {
      ...pod,
      width: computedW,
      height: computedH,
      measured: { width: computedW, height: computedH },
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
