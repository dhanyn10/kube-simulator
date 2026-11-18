import { useEffect } from 'react';
import { useFlowStore } from '@/store';
import { getBackendGateway } from '@/gateway';

export const useThemeSync = () => {
  const colorMode = useFlowStore((state) => state.colorMode);

  useEffect(() => {
    const isDark = colorMode === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('light', !isDark);
  }, [colorMode]);

  useEffect(() => {
    const channel = new BroadcastChannel('monitoring-data');
    const gw = getBackendGateway();

    const handleSync = (mode: string) => {
      if ((mode === 'dark' || mode === 'light') && useFlowStore.getState().colorMode !== mode) {
        useFlowStore.setState({ colorMode: mode });
      }
    };

    channel.onmessage = (event) => {
      if (event.data?.type === 'THEME_SYNC' && event.data.colorMode) {
        handleSync(event.data.colorMode);
      }
    };

    const unsubGw = gw.onEvent('theme-sync', (mode: any) => {
      if (typeof mode === 'string') {
        handleSync(mode);
      }
    });

    return () => {
      channel.close();
      unsubGw();
    };
  }, []);
};
