import { describe, it, expect } from 'vitest';
import { isAnyModalOverlayOpen } from '@/activities/layout/useModalOverlayState';

describe('useModalOverlayState', () => {
  it('returns false when all modal overlay flags are closed / null', () => {
    const result = isAnyModalOverlayOpen({
      isFileBackstageOpen: false,
      isProjectOpen: false,
      isScenarioOpen: false,
      isAboutDialogOpen: false,
      isSettingsOpen: false,
      isSaveModalOpen: false,
      isYamlOpen: false,
      roleModalTargetNode: null,
      configMapModalTargetNode: null,
      secretModalTargetNode: null,
      hpaModalTargetNode: null,
      resourceLimitModalTargetNode: null,
      isTerminalOpen: false,
      isMonitoringDashboardOpen: false,
      isLogModalOpen: false,
      isKubeIamWizardOpen: false,
      isTerminalCommandTreeModalOpen: false,
    });
    expect(result).toBe(false);
  });

  it('returns true when any modal overlay flag is open', () => {
    const result = isAnyModalOverlayOpen({
      isFileBackstageOpen: true,
      isProjectOpen: false,
      isScenarioOpen: false,
      isAboutDialogOpen: false,
      isSettingsOpen: false,
      isSaveModalOpen: false,
      isYamlOpen: false,
      roleModalTargetNode: null,
      configMapModalTargetNode: null,
      secretModalTargetNode: null,
      hpaModalTargetNode: null,
      resourceLimitModalTargetNode: null,
      isTerminalOpen: false,
      isMonitoringDashboardOpen: false,
      isLogModalOpen: false,
      isKubeIamWizardOpen: false,
      isTerminalCommandTreeModalOpen: false,
    });
    expect(result).toBe(true);
  });
});
