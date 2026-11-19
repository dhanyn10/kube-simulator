import { useEffect, useRef } from 'react';
import { useFlowStore } from '@/store';
import { getBackendGateway } from '@/gateway';
import { broadcastMetrics } from '@/store/slices/simulationManager';
import { handleSimulationControl, applyTrafficSpike } from './simulationControlHelpers';

export interface SimulationSyncOptions {
  onDetachOpen?: () => void;
}

/**
 * Hook to manage real-time synchronization between the main window simulation
 * and the detached standalone monitoring window (System Monitor view).
 */
export const useSimulationSync = (options?: SimulationSyncOptions) => {
  const setMonitoringDetached = useFlowStore((state) => state.setMonitoringDetached);
  const onDetachOpenRef = useRef(options?.onDetachOpen);

  useEffect(() => {
    onDetachOpenRef.current = options?.onDetachOpen;
  }, [options?.onDetachOpen]);

  useEffect(() => {
    const isDetachedMode =
      typeof globalThis !== 'undefined' &&
      new URLSearchParams(globalThis.location?.search || '').get('mode') === 'monitoring';
    if (isDetachedMode) return;

    const channel = new BroadcastChannel('monitoring-data');
    const gw = getBackendGateway();

    const sendSnapshot = () => {
      const state = useFlowStore.getState();
      const workloadNodes = state.nodes.filter(
        (n) => n.type === 'Deployment' || n.type === 'StatefulSet' || n.type === 'ReplicaSet' || (n.type === 'Pod' && !n.parentId)
      );
      const hasInternet = state.nodes.some((n) => n.type === 'Internet');
      const canStart = hasInternet;
      const hpaNode = state.nodes.find((n) => n.type === 'HPA');
      const attachedWorkloadWithHpa = state.nodes.find((n) => Array.isArray(n.data?.hpas) && n.data.hpas.length > 0);
      const hasHpa = Boolean(hpaNode || attachedWorkloadWithHpa);
      let hpaTarget = 80;
      if (hpaNode?.data?.targetCPU) {
        hpaTarget = Number(hpaNode.data.targetCPU) || 80;
      } else if (attachedWorkloadWithHpa?.data?.hpas?.[0]?.targetCPU) {
        hpaTarget = Number(attachedWorkloadWithHpa.data.hpas[0].targetCPU) || 80;
      }

      broadcastMetrics(state.simulationMetrics, workloadNodes, {
        isSimulating: state.isSimulating,
        isPaused: state.isPaused,
        speed: state.simulationSpeed,
        canStart,
        hasInternet,
        hasHpa,
        hpaTarget,
      });
    };

    const handleOpen = () => {
      setMonitoringDetached(true);
      onDetachOpenRef.current?.();
      sendSnapshot();
    };

    const handleClose = () => {
      setMonitoringDetached(false);
    };

    channel.onmessage = (event) => {
      if (event.data?.type === 'DETACHED_OPEN') {
        handleOpen();
      } else if (event.data?.type === 'DETACHED_CLOSED') {
        handleClose();
      } else if (event.data?.type === 'REQUEST_SNAPSHOT') {
        sendSnapshot();
      } else if (event.data?.type === 'SIMULATION_CONTROL') {
        handleSimulationControl(event.data, useFlowStore.getState);
      } else if (event.data?.type === 'THEME_SYNC' && event.data.colorMode) {
        if (useFlowStore.getState().colorMode !== event.data.colorMode) {
          useFlowStore.setState({ colorMode: event.data.colorMode });
        }
      }
    };

    const unsubOpen = gw.onEvent('detached-open', handleOpen);
    const unsubClose = gw.onEvent('detached-closed', handleClose);
    const unsubSpeed = gw.onEvent('simulation-speed-change', (speed: number) => {
      useFlowStore.getState().setSimulationSpeed(speed as 1 | 5 | 10);
    });
    const unsubSpike = gw.onEvent('simulation-traffic-spike', (mult: number) => {
      applyTrafficSpike(useFlowStore.getState, mult);
    });
    const unsubSnapReq = gw.onEvent('request-monitoring-snapshot', sendSnapshot);
    const unsubStore = useFlowStore.subscribe((state, prevState) => {
      if (!state.isSimulating && state.nodes !== prevState.nodes) {
        sendSnapshot();
      }
    });

    return () => {
      unsubStore();
      channel.close();
      unsubOpen();
      unsubClose();
      unsubSpeed();
      unsubSpike();
      unsubSnapReq();
    };
  }, [setMonitoringDetached]);
};
