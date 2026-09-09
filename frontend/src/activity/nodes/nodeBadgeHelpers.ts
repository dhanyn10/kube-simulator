export const getPodBadgeVisibility = (data: any) => {
  if (!data || data.type !== 'Pod') {
    return { showRuntime: false, showWebserver: false, showImage: false, hasAnyBadge: false };
  }

  const showRuntime = Boolean(data.displaySettings?.runtime !== false && data.runtime && data.runtime !== 'none');
  const showWebserver = Boolean(data.displaySettings?.webserver !== false && data.webserver && data.webserver !== 'none');
  const showImage = Boolean(data.displaySettings?.image !== false && data.image);
  const hasAnyBadge = showRuntime || showWebserver || showImage;

  return { showRuntime, showWebserver, showImage, hasAnyBadge };
};
