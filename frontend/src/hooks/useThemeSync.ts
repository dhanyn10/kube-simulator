import { useEffect } from 'react';
import { useFlowStore } from '../store';

export const useThemeSync = () => {
  const colorMode = useFlowStore((state) => state.colorMode);

  useEffect(() => {
    if (colorMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [colorMode]);
};
