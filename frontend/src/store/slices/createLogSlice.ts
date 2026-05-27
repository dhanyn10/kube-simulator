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
const MAX_LOGS = 200;

// Internal logging to avoid infinite recursion if storage fails
const internalError = (...args: any[]) => {
  if ((globalThis as any)._originalConsoleError) {
    (globalThis as any)._originalConsoleError(...args);
  } else {
    console.error(...args);
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
    isLogToastVisible: initialLogs.length > 0, // Show toast on load if logs exist
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
        isLogToastVisible: true
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
