import { useCallback, useState } from 'react';
import { applyHistoryState } from '../store';

export function useHistory() {
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  const handleUndo = useCallback(async () => {
    // @ts-ignore
    if (window.go?.main?.App?.Undo) {
      // @ts-ignore
      const state = await window.go.main.App.Undo();
      if (state) applyHistoryState(state);
    }
  }, []);

  const handleRedo = useCallback(async () => {
    // @ts-ignore
    if (window.go?.main?.App?.Redo) {
      // @ts-ignore
      const state = await window.go.main.App.Redo();
      if (state) applyHistoryState(state);
    }
  }, []);

  const fetchHistoryLogs = useCallback(async () => {
    // @ts-ignore
    if (window.go?.main?.App?.GetHistoryLogs) {
      // @ts-ignore
      const logs = await window.go.main.App.GetHistoryLogs();
      setHistoryLogs([...logs].reverse());
    }
  }, []);

  const handleJumpToHistory = useCallback(async (index: number) => {
    // @ts-ignore
    if (window.go?.main?.App?.JumpToHistory) {
      // @ts-ignore
      const state = await window.go.main.App.JumpToHistory(index);
      if (state) applyHistoryState(state);
    }
  }, []);

  return { historyLogs, fetchHistoryLogs, handleUndo, handleRedo, handleJumpToHistory };
}
