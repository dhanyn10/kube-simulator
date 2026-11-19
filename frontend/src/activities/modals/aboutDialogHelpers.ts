import { getBackendGateway, WailsBackendGateway, IBackendGateway } from '@/gateway';
import { isWailsDesktop } from '@/lib/mocks';
import { APP_VERSION } from '@/constants/config';
import { logger } from '@/lib/logger';

export interface SystemInfo {
  os: string;
  arch: string;
  goVersion: string;
  version: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  isPrerelease: boolean;
}

const resolveRawApp = () => {
  const g = globalThis as any;
  return g?.go?.main?.App || g?.window?.go?.main?.App || null;
};

const fetchSystemInfo = async (
  rawApp: any,
  gateway: IBackendGateway
): Promise<SystemInfo> => {
  let info: any = null;
  if (rawApp?.GetSystemInfo) {
    info = await rawApp.GetSystemInfo();
  } else if (isWailsDesktop() || !(gateway instanceof WailsBackendGateway)) {
    info = await gateway.getSystemInfo();
  }

  return {
    os: info?.os ?? '',
    arch: info?.arch ?? '',
    goVersion: info?.goVersion ?? '',
    version: info?.version ?? '',
  };
};

const fetchUpdateInfo = async (
  rawApp: any,
  gateway: IBackendGateway,
  version: string
): Promise<UpdateInfo | null> => {
  if (rawApp) {
    if (typeof rawApp.CheckForUpdates === 'function') {
      return rawApp.CheckForUpdates(version);
    }
    return null;
  }
  if (isWailsDesktop() || !(gateway instanceof WailsBackendGateway)) {
    return gateway.checkForUpdates(version);
  }
  return null;
};

/**
 * Fetches system information and checks for available software updates.
 */
export const fetchAboutData = async (
  appVersion: string,
  setSystemInfo: (info: SystemInfo) => void,
  setAppVersion: (v: string) => void,
  setUpdateInfo: (u: UpdateInfo | null) => void,
  simulatedUpdateInfo?: { latestVersion: string; releaseUrl: string } | null,
  gateway: IBackendGateway = getBackendGateway()
): Promise<void> => {
  const rawApp = resolveRawApp();

  let sys: SystemInfo = { os: '', arch: '', goVersion: '', version: '' };
  try {
    sys = await fetchSystemInfo(rawApp, gateway);
    setSystemInfo(sys);
    if (sys.version) {
      setAppVersion(sys.version);
    }
  } catch (err) {
    logger.error('Failed to get system info:', err);
  }

  const effectiveVersion = sys.version || appVersion || APP_VERSION;

  if (simulatedUpdateInfo) {
    setUpdateInfo({
      currentVersion: effectiveVersion,
      latestVersion: simulatedUpdateInfo.latestVersion,
      updateAvailable: true,
      releaseUrl: simulatedUpdateInfo.releaseUrl,
      isPrerelease: false,
    });
    return;
  }

  try {
    const update = await fetchUpdateInfo(rawApp, gateway, effectiveVersion);
    setUpdateInfo(update);
  } catch (err) {
    logger.error('Failed to check for updates:', err);
    setUpdateInfo(null);
  }
};

/**
 * Formats clipboard text summary for system details.
 */
export const formatAboutCopyText = (
  appName: string,
  displayVersion: string,
  systemInfo: SystemInfo | null,
  appCopyright: string
): string => {
  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return `${appName} ${displayVersion}
Build #KS-${displayVersion}, built on ${formattedDate}
Runtime version: ${systemInfo?.goVersion} ${systemInfo?.arch}
VM: Go by Google
Operating system: ${systemInfo?.os}
Architecture: ${systemInfo?.arch}

${appCopyright}`;
};
