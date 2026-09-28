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

/**
 * Fetches system information and checks for available software updates.
 */
export const fetchAboutData = async (
  appVersion: string,
  setSystemInfo: (info: SystemInfo) => void,
  setAppVersion: (v: string) => void,
  setUpdateInfo: (u: UpdateInfo) => void,
  simulatedUpdateInfo?: { latestVersion: string; releaseUrl: string } | null
): Promise<void> => {
  const app = globalThis.window?.go?.main?.App;
  let sys: SystemInfo = { os: '', arch: '', goVersion: '', version: '' };

  if (app?.GetSystemInfo) {
    const info = await app.GetSystemInfo();
    sys = {
      os: (info as any).os ?? '',
      arch: (info as any).arch ?? '',
      goVersion: (info as any).goVersion ?? '',
      version: (info as any).version ?? '',
    };
    setSystemInfo(sys);
    if (sys.version) {
      setAppVersion(sys.version);
    }
  }

  const effectiveVersion = sys.version || appVersion;

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

  if (app?.CheckForUpdates) {
    const update = await app.CheckForUpdates(effectiveVersion);
    setUpdateInfo(update);
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
