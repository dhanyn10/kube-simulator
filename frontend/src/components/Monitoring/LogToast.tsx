import React from 'react';
import { useFlowStore } from '../../store';
import { AlertCircle, AlertTriangle, X, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';

export const LogToast: React.FC = () => {
  const logs = useFlowStore((state) => state.logs);
  const isVisible = useFlowStore((state) => state.isLogToastVisible);
  const setVisible = useFlowStore((state) => state.setLogToastVisible);
  const setModalOpen = useFlowStore((state) => state.setLogModalOpen);
  const colorMode = useFlowStore((state) => state.colorMode);

  // Notification alert popup is replaced by the bell icon with badge counter next to the Play button in MenuBar
  return null;
};
