import { StateCreator } from 'zustand';
import { FlowState, LogEntry, LogLevel, LogScope } from '../types';

export interface LogSlice {
  logs: LogEntry[];
  isLogToastVisible: boolean;
  isLogModalOpen: boolean;
  addLog: (level: LogLevel, message: string, scope?: LogScope) => void;
  deleteLog: (id: string) => void;
  deleteLogs: (ids: string[]) => void;
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
  }
};

const loadLogsFromStorage = (): LogEntry[] => {
  try {
    if (typeof localStorage === 'object') {
        const legacy = localStorage.getItem(LOG_STORAGE_KEY);
        if (legacy) {
            localStorage.removeItem(LOG_STORAGE_KEY);
        }
    }

    let stored = null;
    if (typeof sessionStorage === 'object') {
        stored = sessionStorage.getItem(LOG_STORAGE_KEY);
    }

    if (stored) {
        return JSON.parse(stored);
    }
    return [];
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
    addLog: (level, message, scope) => {
      const newLog: LogEntry = {
        id: crypto.randomUUID(),
        level,
        scope: scope || 'System',
        message,
        timestamp: Date.now(),
      };

      const currentLogs = get().logs;
      const updatedLogs = [...currentLogs, newLog].slice(-MAX_LOGS);

      const isImportant = level === 'error' || level === 'fatal' || level === 'warn';
      const newState: Partial<LogSlice> = {
        logs: updatedLogs,
      };

      if (isImportant) {
        newState.isLogToastVisible = true;
      }

      set(newState);
      saveLogsToStorage(updatedLogs);

      if (globalThis.go?.main?.App?.WriteLog) {
        globalThis.go.main.App.WriteLog(scope || 'app', level, message).catch(() => {});
      }
    },
    deleteLog: (id) => {
      const updatedLogs = get().logs.filter(l => l.id !== id);
      set({ logs: updatedLogs });
      saveLogsToStorage(updatedLogs);
    },
    deleteLogs: (ids) => {
      const idSet = new Set(ids);
      const updatedLogs = get().logs.filter(l => !idSet.has(l.id));
      set({ logs: updatedLogs });
      saveLogsToStorage(updatedLogs);
    },
    clearLogs: () => {
      set({ logs: [], isLogToastVisible: false, isLogModalOpen: false });
      saveLogsToStorage([]);
    },
    setLogToastVisible: (visible) => set({ isLogToastVisible: visible }),
    setLogModalOpen: (open) => set({ isLogModalOpen: open }),
  };
};
