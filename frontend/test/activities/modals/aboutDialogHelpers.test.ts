import { describe, it, expect, vi } from 'vitest';
import { fetchAboutData, formatAboutCopyText, SystemInfo, UpdateInfo } from '@/activities/modals/aboutDialogHelpers';

describe('aboutDialogHelpers', () => {
  it('formats copy text correctly', () => {
    const sysInfo: SystemInfo = {
      os: 'linux',
      arch: 'amd64',
      goVersion: 'go1.22.0',
      version: '1.0.0',
    };
    const text = formatAboutCopyText('Kube Simulator', '1.0.0', sysInfo, 'Copyright 2026');
    expect(text).toContain('Kube Simulator 1.0.0');
    expect(text).toContain('Build #KS-1.0.0');
    expect(text).toContain('Runtime version: go1.22.0 amd64');
    expect(text).toContain('Operating system: linux');
    expect(text).toContain('Copyright 2026');
  });

  it('fetches system info and update info when go app window object is present', async () => {
    const mockGetSystemInfo = vi.fn().mockResolvedValue({
      os: 'windows',
      arch: 'amd64',
      goVersion: 'go1.22.1',
      version: '1.2.0',
    });
    const mockCheckForUpdates = vi.fn().mockResolvedValue({
      currentVersion: '1.2.0',
      latestVersion: '1.3.0',
      updateAvailable: true,
      releaseUrl: 'https://github.com',
      isPrerelease: false,
    });

    (globalThis.window as any).go = {
      main: {
        App: {
          GetSystemInfo: mockGetSystemInfo,
          CheckForUpdates: mockCheckForUpdates,
        },
      },
    };

    let setSys: SystemInfo | null = null;
    let setVer = '';
    let setUpd: UpdateInfo | null = null;

    await fetchAboutData(
      '1.0.0',
      (info) => { setSys = info; },
      (v) => { setVer = v; },
      (u) => { setUpd = u; }
    );

    expect(setSys).toEqual({
      os: 'windows',
      arch: 'amd64',
      goVersion: 'go1.22.1',
      version: '1.2.0',
    });
    expect(setVer).toBe('1.2.0');
    expect(setUpd).toEqual({
      currentVersion: '1.2.0',
      latestVersion: '1.3.0',
      updateAvailable: true,
      releaseUrl: 'https://github.com',
      isPrerelease: false,
    });
  });

  it('handles empty or partial GetSystemInfo response without version', async () => {
    const mockGetSystemInfo = vi.fn().mockResolvedValue({});
    (globalThis.window as any).go = {
      main: {
        App: {
          GetSystemInfo: mockGetSystemInfo,
        },
      },
    };

    let setSys: SystemInfo | null = null;
    let setVer = '';
    let setUpd: UpdateInfo | null = null;

    await fetchAboutData(
      '1.0.0',
      (info) => { setSys = info; },
      (v) => { setVer = v; },
      (u) => { setUpd = u; }
    );

    expect(setSys).toEqual({
      os: '',
      arch: '',
      goVersion: '',
      version: '',
    });
    expect(setVer).toBe('');
  });

  it('handles simulated update info', async () => {
    delete (globalThis.window as any).go;

    let setSys: SystemInfo | null = null;
    let setVer = '';
    let setUpd: UpdateInfo | null = null;

    const simulated = {
      latestVersion: '2.0.0',
      releaseUrl: 'https://github.com/release',
    };

    await fetchAboutData(
      '1.5.0',
      (info) => { setSys = info; },
      (v) => { setVer = v; },
      (u) => { setUpd = u; },
      simulated
    );

    expect(setUpd).toEqual({
      currentVersion: '1.5.0',
      latestVersion: '2.0.0',
      updateAvailable: true,
      releaseUrl: 'https://github.com/release',
      isPrerelease: false,
    });
  });
});
