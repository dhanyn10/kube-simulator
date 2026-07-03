// Global interception to capture third-party logs or unhandled errors
const originalLog = console.log.bind(console);
const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

// Attach to window so other modules can use them before/after this file runs
(window as any)._originalConsoleLog = originalLog;
(window as any)._originalConsoleWarn = originalWarn;
(window as any)._originalConsoleError = originalError;

export { originalLog, originalWarn, originalError };
