/**
 * Evaluates whether any modal, drawer, or backdrop overlay is currently active.
 *
 * @param modalStates Object containing active overlay boolean indicators.
 * @returns Boolean indicating whether any modal overlay is active.
 */
export function isAnyModalOverlayOpen(modalStates: {
  isFileBackstageOpen: boolean;
  isProjectOpen: boolean;
  isScenarioOpen: boolean;
  isAboutDialogOpen: boolean;
  isSettingsOpen: boolean;
  isSaveModalOpen: boolean;
  isYamlOpen: boolean;
  roleModalTargetNode: unknown;
  configMapModalTargetNode: unknown;
  secretModalTargetNode: unknown;
  hpaModalTargetNode: unknown;
  resourceLimitModalTargetNode: unknown;
  isTerminalOpen: boolean;
  isMonitoringDashboardOpen: boolean;
  isLogModalOpen: boolean;
  isKubeIamWizardOpen: boolean;
  isTerminalCommandTreeModalOpen: boolean;
  isWorkerBudgetModalOpen?: boolean;
}): boolean {
  return (
    modalStates.isFileBackstageOpen ||
    modalStates.isProjectOpen ||
    modalStates.isScenarioOpen ||
    modalStates.isAboutDialogOpen ||
    modalStates.isSettingsOpen ||
    modalStates.isSaveModalOpen ||
    modalStates.isYamlOpen ||
    Boolean(modalStates.roleModalTargetNode) ||
    Boolean(modalStates.configMapModalTargetNode) ||
    Boolean(modalStates.secretModalTargetNode) ||
    Boolean(modalStates.hpaModalTargetNode) ||
    Boolean(modalStates.resourceLimitModalTargetNode) ||
    modalStates.isTerminalOpen ||
    modalStates.isMonitoringDashboardOpen ||
    modalStates.isLogModalOpen ||
    modalStates.isKubeIamWizardOpen ||
    modalStates.isTerminalCommandTreeModalOpen ||
    Boolean(modalStates.isWorkerBudgetModalOpen)
  );
}
