/**
 * Custom hooks and state handlers for Monitoring Dashboard.
 */

import { useState, useRef, useEffect } from 'react';
import { useFlowStore } from '../../store';

export const useMonitoringDashboardHandler = () => {
  const isMonitoringOpen = useFlowStore((state) => state.isMonitoringOpen);
  const setMonitoringOpen = useFlowStore((state) => state.setMonitoringOpen);
  const isMonitoringDetached = useFlowStore((state) => state.isMonitoringDetached);
  const setMonitoringDetached = useFlowStore((state) => state.setMonitoringDetached);
  const simulationMetrics = useFlowStore((state) => state.simulationMetrics);
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);

  const [position, setPosition] = useState({ x: 400, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dashboardRef = useRef<HTMLDivElement>(null);

  const workloads = nodes.filter(n =>
    n.type === 'Deployment' ||
    n.type === 'ReplicaSet' ||
    (n.type === 'Pod' && !n.parentId)
  );

  useEffect(() => {
    const channel = new BroadcastChannel('monitoring-data');
    const runtime = globalThis.runtime;

    const handleOpen = () => {
      setMonitoringDetached(true);
      setMonitoringOpen(false);
    };

    const handleClose = () => {
      setMonitoringDetached(false);
    };

    channel.onmessage = (event) => {
      if (event.data.type === 'DETACHED_OPEN') {
        handleOpen();
      } else if (event.data.type === 'DETACHED_CLOSED') {
        handleClose();
      }
    };

    if (runtime) {
      runtime.EventsOn('detached-open', handleOpen);
      runtime.EventsOn('detached-closed', handleClose);
    }

    return () => channel.close();
  }, [setMonitoringDetached, setMonitoringOpen]);

  const handleDetach = () => {
    const width = 800;
    const height = 600;
    const left = (globalThis.screen.width / 2) - (width / 2);
    const top = (globalThis.screen.height / 2) - (height / 2);

    globalThis.open(
      `${globalThis.location.origin}${globalThis.location.pathname}?mode=monitoring`,
      '_blank',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  return {
    isMonitoringOpen,
    setMonitoringOpen,
    isMonitoringDetached,
    simulationMetrics,
    colorMode,
    position,
    dashboardRef,
    workloads,
    handleDetach,
    handleMouseDown,
  };
};
