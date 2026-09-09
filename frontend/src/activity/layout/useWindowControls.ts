export function useWindowControls() {
  const getWindowApp = () => (globalThis as any).go?.main?.App;

  const handleMinimize = () => {
    getWindowApp()?.MinimizeWindow?.();
  };

  const handleMaximize = () => {
    getWindowApp()?.MaximizeWindow?.();
  };

  const handleClose = () => {
    getWindowApp()?.CloseWindow?.();
  };

  return { handleMinimize, handleMaximize, handleClose };
}
