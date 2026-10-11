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

/**
 * Asynchronously initializes and retrieves the cached Yoga Layout engine instance.
 * Avoids top-level await errors during Vite builds.
 *
 * @returns Promise resolving to the Yoga Layout engine instance.
 */
export const getYogaEngine = async (): Promise<YogaEngine> => {
  if (cachedYogaInstance) {
    return cachedYogaInstance;
  }
  cachedYogaInstance = await loadYoga();
  return cachedYogaInstance;
};

// Eagerly trigger background loading of Yoga WASM
void getYogaEngine();

/**
 * Returns the currently cached Yoga Layout engine instance synchronously if available.
 *
 * @returns Cached Yoga instance or null if not yet initialized.
 */
export const getYogaInstanceSync = (): YogaEngine | null => {
  return cachedYogaInstance;
};

/**
 * Calculates internal sub-tree layout for Deployment node and its child Pods using Yoga Flexbox Layout Engine.
 * Builds Yoga tree hierarchy (Deployment Container -> Pods -> Pod Content -> Attached Items Footer) with column flex direction,
 * computing precise coordinates and auto-collapsing empty gaps when container image content or attached items change.
 * Models each attached item (ConfigMap, Secret, Role, HPA, ResourceLimit) as an individual Yoga child node using DOM principles.
 * Removes rigid fixed height constraints so Pods scale dynamically with minHeight while preserving uniform inter-pod margins.
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
  const yoga = yogaSync || cachedYogaInstance;

  const data = (deployment.data as unknown as K8sNodeData) || ({} as K8sNodeData);
  const isReplicaSet = deployment.type === 'ReplicaSet';

  const hasDeploymentAttached = Boolean(
    (data.roles?.length ?? 0) > 0 ||
    (data.configMaps?.length ?? 0) > 0 ||
    (data.secrets?.length ?? 0) > 0 ||
    (data.hpas?.length ?? 0) > 0 ||
    (data.resourceLimits?.length ?? 0) > 0
  );

  const deploymentAttachedCount = (data.roles?.length ?? 0) + (data.configMaps?.length ?? 0) + (data.secrets?.length ?? 0) + (data.hpas?.length ?? 0) + (data.resourceLimits?.length ?? 0);
  const deploymentAttachedRows = hasDeploymentAttached ? Math.max(1, Math.ceil(deploymentAttachedCount / 3)) : 0;
  const bottomPadding = 40 + (hasDeploymentAttached ? deploymentAttachedRows * 36 : 0);

  const paddingX = 24;
  const paddingY = isReplicaSet ? 30 : 48;

  const minWidth = isReplicaSet ? 180 : (POD_MIN_DIMENSIONS.width + paddingX * 2 + 10);
  const minHeight = isReplicaSet ? 100 : (POD_MIN_DIMENSIONS.height + paddingY + bottomPadding);

  const maxPodWidth = Math.max(0, ...pods.map(p => getPodMinimumSize((p.data as unknown as K8sNodeData) || {}).width));
  let deploymentWidth = Math.max(minWidth, maxPodWidth + paddingX * 2);

  if (data.isManuallyResized && deployment.width) {
    deploymentWidth = Math.max(deploymentWidth, deployment.width);
  }

  // Fallback calculation if Yoga engine is not yet available synchronously
  if (!yoga) {
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
    const width = data.isManuallyResized ? Math.max(deploymentWidth, deployment.width || minWidth) : deploymentWidth;
    const height = data.isManuallyResized ? Math.max(calculatedHeight, deployment.height || minHeight) : calculatedHeight;

    return { width, height, laidOutPods };
  }

  // Yoga Flexbox calculation
  const rootNode = yoga.Node.create();
  rootNode.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN);
  rootNode.setPadding(yoga.EDGE_TOP, paddingY);
  rootNode.setPadding(yoga.EDGE_LEFT, paddingX);
  rootNode.setPadding(yoga.EDGE_RIGHT, paddingX);
  rootNode.setPadding(yoga.EDGE_BOTTOM, bottomPadding);
  rootNode.setWidth(deploymentWidth);

  pods.forEach((pod, idx) => {
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
    const attachedHeight = calculatePodAttachedHeight(podData);

    const podYogaNode = yoga.Node.create();
    podYogaNode.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN);
    podYogaNode.setWidth(podWidth);
    podYogaNode.setHeightAuto();
    podYogaNode.setMinHeight(minSize.height);

    const podSpacing = getPodSpacing(isMegaPod);
    const isLastPod = idx === pods.length - 1;
    podYogaNode.setMargin(yoga.EDGE_BOTTOM, isLastPod ? 0 : podSpacing);

    // Sub-tree child node 1: Pod Base (Header, status, badges, restart policy)
    const baseYogaNode = yoga.Node.create();
    baseYogaNode.setWidth(podWidth);
    baseYogaNode.setMinHeight(baseHeight);
    podYogaNode.insertChild(baseYogaNode, 0);

    // Sub-tree child node 2: Pod Content (Container Image)
    const contentYogaNode = yoga.Node.create();
    contentYogaNode.setWidth(podWidth);
    contentYogaNode.setMinHeight(contentHeight);
    podYogaNode.insertChild(contentYogaNode, 1);

    // Sub-tree child node 3: Dynamic Attached Resources Footer (Roles, ConfigMaps, Secrets, ResourceLimits, HPAs)
    const roles = podData.roles || [];
    const configMaps = podData.configMaps || [];
    const secrets = podData.secrets || [];
    const resourceLimits = podData.resourceLimits || [];
    const hpas = podData.hpas || [];
    const totalAttached = roles.length + configMaps.length + secrets.length + resourceLimits.length + hpas.length;

    if (totalAttached > 0) {
      const attachedContainerNode = yoga.Node.create();
      attachedContainerNode.setFlexDirection(yoga.FLEX_DIRECTION_ROW);
      attachedContainerNode.setFlexWrap(yoga.WRAP_WRAP);
      attachedContainerNode.setWidth(podWidth);
      attachedContainerNode.setGap(yoga.GUTTER_ALL, 6);
      attachedContainerNode.setMargin(yoga.EDGE_TOP, 8);
      attachedContainerNode.setMinHeight(attachedHeight);

      let badgeIndex = 0;
      const createItemBadgeNode = () => {
        const itemNode = yoga.Node.create();
        itemNode.setWidth(28);
        itemNode.setHeight(28);
        return itemNode;
      };

      for (let i = 0; i < roles.length; i++) {
        attachedContainerNode.insertChild(createItemBadgeNode(), badgeIndex++);
      }
      for (let i = 0; i < configMaps.length; i++) {
        attachedContainerNode.insertChild(createItemBadgeNode(), badgeIndex++);
      }
      for (let i = 0; i < secrets.length; i++) {
        attachedContainerNode.insertChild(createItemBadgeNode(), badgeIndex++);
      }
      for (let i = 0; i < resourceLimits.length; i++) {
        attachedContainerNode.insertChild(createItemBadgeNode(), badgeIndex++);
      }
      for (let i = 0; i < hpas.length; i++) {
        attachedContainerNode.insertChild(createItemBadgeNode(), badgeIndex++);
      }

      podYogaNode.insertChild(attachedContainerNode, 2);
    }

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
