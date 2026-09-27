import { K8sNodeData } from '@/types';

export const POD_MIN_DIMENSIONS = {
  width: 168,
  height: 92,
};

export const calculatePodWidth = (data: Partial<K8sNodeData>, badges: string[]) => {
  const horizontalPadding = 24;
  const isMegaPod = data.replicas === 100;
  const baseWidth = isMegaPod ? POD_MIN_DIMENSIONS.width * 2 : POD_MIN_DIMENSIONS.width;
  const headerContentWidth = 36 + ((data.replicas || 0) > 1 ? String(data.replicas).length * 5 + 18 : 0);
  const labelWidth = String(data.label || '').length * 7 + 16;
  const badgeWidth = badges.length > 0 ? badges.reduce((t, b) => t + b.length * 5 + 14, 0) + (badges.length - 1) * 4 : 0;
  const showImage = Boolean(data.displaySettings?.image !== false && data.image);
  const readableImageWidth = showImage ? Math.min(320, Math.max(148, String(data.image || '').length * 5.5 + 16)) : 0;
  return Math.ceil(Math.max(baseWidth, headerContentWidth + 44 + horizontalPadding, labelWidth + horizontalPadding, badgeWidth + horizontalPadding, readableImageWidth + horizontalPadding));
};

export const calculatePodHeight = (data: Partial<K8sNodeData>, width: number, badges: string[], isMegaPod: boolean) => {
  const showDashedProgress = data.type === 'Pod' && ((data.parentReplicas || 0) > 3 || ((data.replicas || 1) > 1 && !data.parentId));
  let height = 72;
  if (showDashedProgress) height += isMegaPod ? 120 : 14;
  if (data.displaySettings?.resources !== false && (data.cpuLimit || data.memoryLimit)) height += 38;
  if (badges.length > 0) height += 20;
  const showImage = Boolean(data.displaySettings?.image !== false && data.image);
  if (showImage) {
    const charsPerLine = Math.max(10, Math.floor((width - 24) / 5.5));
    height += Math.ceil(String(data.image).length / charsPerLine) * 12 + 8;
  }
  const baseHeight = isMegaPod ? POD_MIN_DIMENSIONS.height * 2 : POD_MIN_DIMENSIONS.height;
  return Math.max(baseHeight, Math.ceil(height));
};

export const getPodMinimumSize = (data: Partial<K8sNodeData> = {}) => {
  const showRuntime = Boolean(data.displaySettings?.runtime !== false && data.runtime && data.runtime !== 'none');
  const showWebserver = Boolean(data.displaySettings?.webserver !== false && data.webserver && data.webserver !== 'none');
  const visibleBadges: string[] = [];
  if (showRuntime && data.runtime) visibleBadges.push(String(data.runtime));
  if (showWebserver && data.webserver) visibleBadges.push(String(data.webserver));

  const width = calculatePodWidth(data, visibleBadges);
  const height = calculatePodHeight(data, width, visibleBadges, data.replicas === 100);
  return { width, height };
};
