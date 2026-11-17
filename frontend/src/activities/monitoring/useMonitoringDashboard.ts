/**
 * Custom hooks and state handlers for Monitoring Dashboard.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFlowStore } from '@/store';
import { getBackendGateway } from '@/gateway';
import { useSimulationSync } from './useSimulationSync';

export const useMonitoringDashboardHandler = () => {
  const isMonitoringOpen = useFlowStore((state) => state.isMonitoringOpen);
  const setMonitoringOpen = useFlowStore((state) => state.setMonitoringOpen);
  const isMonitoringDetached = useFlowStore((state) => state.isMonitoringDetached);
  const simulationMetrics = useFlowStore((state) => state.simulationMetrics);
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);

  const [position, setPosition] = useState({ x: 400, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dashboardRef = useRef<HTMLDivElement>(null);

  const workloads = nodes.filter(n =>
    n.type === 'Deployment' ||
    n.type === 'ReplicaSet' ||
    (n.type === 'Pod' && !n.parentId)
  );

  const handleDetachOpen = useCallback(() => {
    setMonitoringOpen(false);
  }, [setMonitoringOpen]);

  useSimulationSync({ onDetachOpen: handleDetachOpen });

  const handleDetach = async () => {
    await getBackendGateway().openSimulationWindow();
    setMonitoringOpen(false);
  };

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

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
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const isSimulating = useFlowStore((state) => state.isSimulating);
  const simulationSpeed = useFlowStore((state) => state.simulationSpeed) || 1;

  let totalCpu = 0;
  let totalMem = 0;
  let activeCount = 0;
  workloads.forEach((w) => {
    const pts = simulationMetrics[w.id];
    if (pts && pts.length > 0) {
      const last = pts.at(-1);
      if (last) {
        totalCpu += last.cpuPercent || 0;
        totalMem += last.memoryPercent || 0;
        activeCount++;
      }
    }
  });
  const clusterCpuAvg = activeCount > 0 ? Math.round(totalCpu / activeCount) : 0;
  const clusterMemAvg = activeCount > 0 ? Math.round(totalMem / activeCount) : 0;

  return {
    isMonitoringOpen,
    setMonitoringOpen,
    isMonitoringDetached,
    simulationMetrics,
    colorMode,
    position,
    dashboardRef,
    workloads,
    isSimulating,
    simulationSpeed,
    clusterCpuAvg,
    clusterMemAvg,
    handleDetach,
    handleMouseDown,
  };
};
