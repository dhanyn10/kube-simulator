export const getPodBadgeVisibility = (data: any) => {
  if (data?.type !== 'Pod') {
    return { showRuntime: false, showWebserver: false, showImage: false, hasAnyBadge: false };
  }

  const showRuntime = Boolean(data.displaySettings?.runtime !== false && data.runtime && data.runtime !== 'none');
  const showWebserver = Boolean(data.displaySettings?.webserver !== false && data.webserver && data.webserver !== 'none');
  // Container image tag is rendered as key-value row in Pod.tsx, so set showImage to false in NodePodBadges to prevent duplicate badge rendering
  const showImage = false;
  const hasAnyBadge = showRuntime || showWebserver || showImage;

  return { showRuntime, showWebserver, showImage, hasAnyBadge };
};
