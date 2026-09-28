import { useState, useEffect } from 'react';
import { useFlowStore } from '@/store';
import { logger } from '@/lib/logger';
import { fetchAboutData, formatAboutCopyText, SystemInfo, UpdateInfo } from './aboutDialogHelpers';

export interface UseAboutDialogProps {
  isOpen: boolean;
}

export const useAboutDialog = ({ isOpen }: UseAboutDialogProps) => {
  const colorMode = useFlowStore((state: any) => state.colorMode);
  const simulatedUpdateInfo = useFlowStore((state: any) => state.simulatedUpdateInfo);
  const simulatedCurrentVersion = useFlowStore((state: any) => state.simulatedCurrentVersion);

  const [appVersion, setAppVersion] = useState('');
  const [appName] = useState('Kube Simulator');
  const [appCopyright] = useState('Copyright 2026');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setIsCheckingUpdate(true);
    fetchAboutData(
      appVersion,
      setSystemInfo,
      (v) => setAppVersion(simulatedCurrentVersion || v),
      setUpdateInfo,
      simulatedUpdateInfo
    )
      .catch((error) => logger.error('Failed to fetch info:', error))
      .finally(() => setIsCheckingUpdate(false));
  }, [isOpen, appVersion, simulatedUpdateInfo, simulatedCurrentVersion]);

  const displayVersion = simulatedCurrentVersion || appVersion;

  const handleCopy = async () => {
    const textToCopy = formatAboutCopyText(appName, displayVersion, systemInfo, appCopyright);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy', err);
    }
  };

  return {
    colorMode,
    appName,
    appCopyright,
    displayVersion,
    systemInfo,
    updateInfo,
    isCheckingUpdate,
    copied,
    handleCopy,
  };
};
