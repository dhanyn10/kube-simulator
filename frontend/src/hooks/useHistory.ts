import { logger } from '../lib/logger';
import { useCallback, useState } from 'react';
import { applyHistoryState } from '../store';

export function useHistory() {
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  const handleUndo = useCallback(async () => {
    try {
      // @ts-ignore
      if (globalThis.go?.main?.App?.Undo) {
        // @ts-ignore
        const state = await globalThis.go.main.App.Undo();
        if (state) applyHistoryState(state);
      }
    } catch (e) {
      logger.error('[History] Failed to undo:', e);
    }
  }, []);

  const handleRedo = useCallback(async () => {
    try {
      // @ts-ignore
      if (globalThis.go?.main?.App?.Redo) {
        // @ts-ignore
        const state = await globalThis.go.main.App.Redo();
        if (state) applyHistoryState(state);
      }
    } catch (e) {
      logger.error('[History] Failed to redo:', e);
    }
  }, []);

  const fetchHistoryLogs = useCallback(async () => {
    try {
      // @ts-ignore
      if (globalThis.go?.main?.App?.GetHistoryLogs) {
        // @ts-ignore
        const logs = await globalThis.go.main.App.GetHistoryLogs();
        setHistoryLogs([...logs].reverse());
      }
    } catch (e) {
      logger.error('[History] Failed to fetch logs:', e);
    }
  }, []);

  const handleJumpToHistory = useCallback(async (index: number) => {
    try {
      // @ts-ignore
      if (globalThis.go?.main?.App?.JumpToHistory) {
        // @ts-ignore
        const state = await globalThis.go.main.App.JumpToHistory(index);
        if (state) applyHistoryState(state);
      }
    } catch (e) {
      logger.error('[History] Failed to jump to history:', e);
    }
  }, []);

  return { historyLogs, fetchHistoryLogs, handleUndo, handleRedo, handleJumpToHistory };
}
