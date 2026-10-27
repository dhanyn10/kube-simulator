import { K8sNodeData, K8sConfigMapItem } from '@/types';
import { getPodReplicaInfo } from './podReplicaHelpers';

export const POD_MIN_DIMENSIONS = {
  width: 168,
  height: 92,
};

const calculateMaxConfigMapVarWidth = (configMaps?: K8sConfigMapItem[]): number => {
  if (!configMaps || configMaps.length === 0) return 0;
  let maxWidth = 0;
  for (const cm of configMaps) {
    if (!cm.configData) continue;
    for (const item of cm.configData.slice(0, 3)) {
      const itemWidth = 24 + (item.key.length + String(item.value).length) * 5.5 + 20;
      if (itemWidth > maxWidth) maxWidth = itemWidth;
    }
  }
  return maxWidth;
};

export const calculatePodWidth = (
  data: Partial<K8sNodeData>,
  badges: string[],
  parentData?: Partial<K8sNodeData>
) => {
  const horizontalPadding = 24;
  const { isMegaPod, isStackedCard, replicas } = getPodReplicaInfo(data);
  const baseWidth = isMegaPod ? POD_MIN_DIMENSIONS.width * 2 : POD_MIN_DIMENSIONS.width;
  const headerContentWidth = 36 + (isStackedCard ? String(replicas).length * 5 + 18 : 0);
  const labelWidth = String(data.label || '').length * 7 + 16;
  const badgeWidth = badges.length > 0 ? badges.reduce((t, b) => t + b.length * 5 + 14, 0) + (badges.length - 1) * 4 : 0;
  const showImage = Boolean(data.displaySettings?.image !== false && data.image);
  const readableImageWidth = showImage ? Math.min(320, Math.max(148, String(data.image).length * 5.5 + 16)) : 0;

  const displaySettings = data.displaySettings ?? parentData?.displaySettings;
  const configMaps = (data.configMaps && data.configMaps.length > 0)
    ? data.configMaps
    : parentData?.configMaps;

  const maxCmVarWidth = displaySettings?.configMapVars !== false ? calculateMaxConfigMapVarWidth(configMaps) : 0;
  const readableCmVarWidth = maxCmVarWidth > 0 ? Math.min(260, Math.max(POD_MIN_DIMENSIONS.width, maxCmVarWidth)) : 0;

  return Math.ceil(Math.max(baseWidth, headerContentWidth + 44 + horizontalPadding, labelWidth + horizontalPadding, badgeWidth + horizontalPadding, readableImageWidth + horizontalPadding, readableCmVarWidth));
};

export const calculatePodBaseHeight = (data: Partial<K8sNodeData>, _width: number, badges: string[], isMegaPod: boolean) => {
  const { showDashedProgress } = getPodReplicaInfo(data);
  let height = 80;
  if (showDashedProgress) height += isMegaPod ? 120 : 16;
  if (data.displaySettings?.resources !== false && (data.cpuLimit || data.memoryLimit || data.cpuRequest || data.memoryRequest)) height += 38;
  if (data.displaySettings?.restartPolicy !== false) height += 24;
  if (badges.length > 0) height += 20;

  const baseHeight = isMegaPod ? POD_MIN_DIMENSIONS.height * 2 : POD_MIN_DIMENSIONS.height;
  return Math.max(baseHeight, Math.ceil(height));
};

export const calculatePodContentHeight = (data: Partial<K8sNodeData>, width: number) => {
  const showImage = Boolean(data.displaySettings?.image !== false && data.image);
  if (!showImage) return 0;
  const charsPerLine = Math.max(10, Math.floor((width - 24) / 5.5));
  return Math.ceil(String(data.image).length / charsPerLine) * 12 + 8;
};

export const calculatePodAttachedHeight = (data: Partial<K8sNodeData>) => {
  const rolesCount = data.roles?.length ?? 0;
  const configMapsCount = data.configMaps?.length ?? 0;
  const secretsCount = data.secrets?.length ?? 0;
  const hpasCount = data.hpas?.length ?? 0;
  const resourceLimitsCount = data.resourceLimits?.length ?? 0;
  const totalAttached = rolesCount + configMapsCount + secretsCount + hpasCount + resourceLimitsCount;
  if (totalAttached === 0) return 0;
  const rows = Math.max(1, Math.ceil(totalAttached / 3));
  return rows * 36;
};

export const calculatePodConfigMapVarsHeight = (
  data: Partial<K8sNodeData>,
  parentData?: Partial<K8sNodeData>
) => {
  const displaySettings = data.displaySettings ?? parentData?.displaySettings;
  if (displaySettings?.configMapVars === false) return 0;
  const configMaps = (data.configMaps && data.configMaps.length > 0)
    ? data.configMaps
    : parentData?.configMaps;
  if (!configMaps || configMaps.length === 0) return 0;
  const count = configMaps.reduce((sum, cm) => sum + (cm.configData?.length || 0), 0);
  if (count === 0) return 0;
  const displayedCount = Math.min(count, 3);
  const hasMore = count > 3;
  return 12 + displayedCount * 18 + (hasMore ? 14 : 0);
};

export const calculatePodHeight = (
  data: Partial<K8sNodeData>,
  width: number,
  badges: string[],
  isMegaPod: boolean,
  parentData?: Partial<K8sNodeData>
) => {
  const baseHeight = calculatePodBaseHeight(data, width, badges, isMegaPod);
  const contentHeight = calculatePodContentHeight(data, width);
  const attachedHeight = calculatePodAttachedHeight(data);
  const configMapVarsHeight = calculatePodConfigMapVarsHeight(data, parentData);
  return baseHeight + contentHeight + attachedHeight + configMapVarsHeight;
};

export const getPodMinimumSize = (
  data: Partial<K8sNodeData> = {},
  parentData?: Partial<K8sNodeData>
) => {
  const showRuntime = Boolean(data.displaySettings?.runtime !== false && data.runtime && data.runtime !== 'none');
  const showWebserver = Boolean(data.displaySettings?.webserver !== false && data.webserver && data.webserver !== 'none');
  const visibleBadges: string[] = [];
  if (showRuntime && data.runtime) visibleBadges.push(String(data.runtime));
  if (showWebserver && data.webserver) visibleBadges.push(String(data.webserver));

  const { isMegaPod } = getPodReplicaInfo(data);
  const width = calculatePodWidth(data, visibleBadges, parentData);
  const height = calculatePodHeight(data, width, visibleBadges, isMegaPod, parentData);
  return { width, height };
};
