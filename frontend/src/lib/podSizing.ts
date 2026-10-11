import { K8sNodeData } from '@/types';

export const POD_MIN_DIMENSIONS = {
  width: 168,
  height: 92,
};

export const calculatePodWidth = (data: Partial<K8sNodeData>, badges: string[]) => {
  const horizontalPadding = 24;
  const isMegaPod = (data.replicas || 0) >= 100 || (data.parentReplicas || 0) >= 100;
  const baseWidth = isMegaPod ? POD_MIN_DIMENSIONS.width * 2 : POD_MIN_DIMENSIONS.width;
  const headerContentWidth = 36 + ((data.replicas || 0) > 1 ? String(data.replicas).length * 5 + 18 : 0);
  const labelWidth = String(data.label || '').length * 7 + 16;
  const badgeWidth = badges.length > 0 ? badges.reduce((t, b) => t + b.length * 5 + 14, 0) + (badges.length - 1) * 4 : 0;
  const showImage = Boolean(data.displaySettings?.image !== false && data.image);
  const readableImageWidth = showImage ? Math.min(320, Math.max(148, String(data.image || '').length * 5.5 + 16)) : 0;
  return Math.ceil(Math.max(baseWidth, headerContentWidth + 44 + horizontalPadding, labelWidth + horizontalPadding, badgeWidth + horizontalPadding, readableImageWidth + horizontalPadding));
};

export const calculatePodBaseHeight = (data: Partial<K8sNodeData>, _width: number, badges: string[], isMegaPod: boolean) => {
  const showDashedProgress = data.type === 'Pod' && ((data.parentReplicas || 0) > 3 || ((data.replicas || 1) > 1 && !data.parentId));
  let height = 80;
  if (showDashedProgress) height += isMegaPod ? 120 : 16;
  if (data.displaySettings?.resources !== false && (data.cpuLimit || data.memoryLimit || data.cpuRequest || data.memoryRequest)) height += 38;
  if (data.displaySettings?.restartPolicy !== false && !!data.restartPolicy) height += 24;
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

export const calculatePodHeight = (data: Partial<K8sNodeData>, width: number, badges: string[], isMegaPod: boolean) => {
  const baseHeight = calculatePodBaseHeight(data, width, badges, isMegaPod);
  const contentHeight = calculatePodContentHeight(data, width);
  const attachedHeight = calculatePodAttachedHeight(data);
  return baseHeight + contentHeight + attachedHeight;
};

export const getPodMinimumSize = (data: Partial<K8sNodeData> = {}) => {
  const showRuntime = Boolean(data.displaySettings?.runtime !== false && data.runtime && data.runtime !== 'none');
  const showWebserver = Boolean(data.displaySettings?.webserver !== false && data.webserver && data.webserver !== 'none');
  const visibleBadges: string[] = [];
  if (showRuntime && data.runtime) visibleBadges.push(String(data.runtime));
  if (showWebserver && data.webserver) visibleBadges.push(String(data.webserver));

  const isMegaPod = (data.replicas || 0) >= 100 || (data.parentReplicas || 0) >= 100;
  const width = calculatePodWidth(data, visibleBadges);
  const height = calculatePodHeight(data, width, visibleBadges, isMegaPod);
  return { width, height };
};
