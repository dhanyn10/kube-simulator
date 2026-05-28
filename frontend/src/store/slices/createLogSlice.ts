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
const MAX_LOGS = 500; // Increased because we are capturing all logs now

// Internal logging to avoid infinite recursion if storage fails
const internalError = (...args: any[]) => {
  if ((globalThis as any)._originalConsoleError) {
    (globalThis as any)._originalConsoleError.apply(console, args);
  } else {
    // Fallback if not initialized yet
    const originalError = (globalThis as any)._originalConsoleError || console.error;
    originalError.apply(console, args);
  }
};

const loadLogsFromStorage = (): LogEntry[] => {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    internalError('Failed to load logs from storage:', e);
    return [];
  }
};

const saveLogsToStorage = (logs: LogEntry[]) => {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    internalError('Failed to save logs to storage:', e);
  }
};

export const createLogSlice: StateCreator<FlowState, [], [], LogSlice> = (set, get) => {
  const initialLogs = loadLogsFromStorage();

  return {
    logs: initialLogs,
    // Only show toast on load if there are actual errors/warnings
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

      set({
        logs: updatedLogs,
        // Only trigger toast for error/warn/fatal
        ...(level !== 'info' ? { isLogToastVisible: true } : {})
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
