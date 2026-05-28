import { StateCreator } from 'zustand';
import { FlowState, LogEntry, LogLevel } from '../types';

export interface LogSlice {
  logs: LogEntry[];
  isLogToastVisible: boolean;
  isLogModalOpen: boolean;
  addLog: (level: LogLevel, message: string) => void;
  clearLogs: () => void;
  setLogToastVisible: (visible: boolean) => void;
  setLogModalOpen: (open: boolean) => void;
}

const LOG_STORAGE_KEY = 'k8s_sim_logs';
const MAX_LOGS = 500;

// Internal logging to avoid infinite recursion if storage fails
const internalError = (...args: any[]) => {
  const originalError = (globalThis as any)._originalConsoleError;
  if (originalError) {
    originalError.apply(console, args);
  } else {
    // Last resort - if even originalError is missing (should not happen with init-console.ts)
    // We don't call console.error here to avoid recursion
  }
};

const loadLogsFromStorage = (): LogEntry[] => {
  try {
    if (typeof localStorage === 'object') {
        if (localStorage.getItem(LOG_STORAGE_KEY)) {
            localStorage.removeItem(LOG_STORAGE_KEY);
        }
    }
    const stored = typeof sessionStorage === 'object' ? sessionStorage.getItem(LOG_STORAGE_KEY) : null;
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    internalError('Failed to load logs from storage:', e);
    return [];
  }
};

const saveLogsToStorage = (logs: LogEntry[]) => {
  try {
    if (typeof sessionStorage === 'object') {
      sessionStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    }
  } catch (e) {
    internalError('Failed to save logs to storage:', e);
  }
};

export const createLogSlice: StateCreator<FlowState, [], [], LogSlice> = (set, get) => {
  const initialLogs = loadLogsFromStorage();

  return {
    logs: initialLogs,
    isLogToastVisible: initialLogs.some(l => l.level === 'error' || l.level === 'fatal' || l.level === 'warn'),
    isLogModalOpen: false,
    addLog: (level, message) => {
      const newLog: LogEntry = {
        id: crypto.randomUUID(),
        level,
        message,
        timestamp: Date.now(),
      };

      const currentLogs = get().logs;
      const updatedLogs = [...currentLogs, newLog].slice(-MAX_LOGS);

      const isImportant = level === 'error' || level === 'fatal' || level === 'warn';
      set({
        logs: updatedLogs,
        ...(isImportant ? { isLogToastVisible: true } : {})
      });
      saveLogsToStorage(updatedLogs);
    },
    clearLogs: () => {
      set({ logs: [], isLogToastVisible: false });
      saveLogsToStorage([]);
    },
    setLogToastVisible: (visible) => set({ isLogToastVisible: visible }),
    setLogModalOpen: (open) => set({ isLogModalOpen: open }),
  };
};
