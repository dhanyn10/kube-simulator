// Test setup for Vitest / JSDOM environment

if (typeof window !== 'undefined') {
  const ensureDataTransferTypes = (event: Event) => {
    const dt = (event as any).dataTransfer;
    if (dt && !Array.isArray(dt.types)) {
      dt.types = [];
    }
  };

  window.addEventListener('dragenter', ensureDataTransferTypes, true);
  window.addEventListener('dragover', ensureDataTransferTypes, true);
  window.addEventListener('dragleave', ensureDataTransferTypes, true);
  window.addEventListener('drop', ensureDataTransferTypes, true);
}
