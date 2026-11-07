import { getBackendGateway } from '@/gateway';

export function useWindowControls() {
  const handleMinimize = () => {
    void getBackendGateway().minimizeWindow();
  };

  const handleMaximize = () => {
    void getBackendGateway().maximizeWindow();
  };

  const handleClose = () => {
    void getBackendGateway().closeWindow();
  };

  return { handleMinimize, handleMaximize, handleClose };
}
