// Global interception to capture third-party logs or unhandled errors
const originalLog = console.log.bind(console);
const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

// Attach to globalThis so other modules can use them before/after this file runs
(globalThis as any)._originalConsoleLog = originalLog;
(globalThis as any)._originalConsoleWarn = originalWarn;
(globalThis as any)._originalConsoleError = originalError;

export { originalLog, originalWarn, originalError };
