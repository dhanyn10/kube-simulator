import { generateYaml } from '@/lib/utils';
import { logger } from '@/lib/logger';
import React, { useCallback } from 'react';
import { useFlowStore } from '@/store';
import { hydrateNodes } from '@/store/nodeHelpers';
import { Node, Edge } from '@xyflow/react';
import { getBackendGateway } from '@/gateway';

interface CanvasPayload {
  nodes?: any[];
  edges?: any[];
  [key: string]: any;
}

const validateCanvasPayload = (canvasRaw: any): CanvasPayload => {
  if (!canvasRaw || typeof canvasRaw !== 'object') {
    throw new Error('Canvas payload must be an object');
  }
  if (canvasRaw.nodes !== undefined && !Array.isArray(canvasRaw.nodes)) {
    throw new Error('Canvas nodes must be an array');
  }
  if (canvasRaw.edges !== undefined && !Array.isArray(canvasRaw.edges)) {
    throw new Error('Canvas edges must be an array');
  }
  return canvasRaw;
};

const extractCanvasData = (canvasField: any): CanvasPayload => {
  if (!canvasField) {
    throw new Error('Missing canvas data in project payload');
  }
  if (typeof canvasField === 'string') {
    return validateCanvasPayload(JSON.parse(canvasField));
  }
  if (typeof canvasField === 'object') {
    return validateCanvasPayload(canvasField);
  }
  throw new Error('Invalid canvas format: expected JSON string or object');
};

const mapNodesWithStrings = (nodes: any[] = []): any[] => {
  return nodes.map((n: any) => {
    if (!n || typeof n !== 'object') {
      throw new Error('Canvas node must be an object');
    }
    return {
      ...n,
      id: String(n.id),
      parentId: n.parentId ? String(n.parentId) : undefined,
    };
  });
};

const mapEdgesWithStrings = (edges: any[] = []): any[] => {
  return edges.map((e: any) => {
    if (!e || typeof e !== 'object') {
      throw new Error('Canvas edge must be an object');
    }
    return {
      ...e,
      id: String(e.id),
      source: String(e.source),
      target: String(e.target),
      type: 'custom',
    };
  });
};

export const parseAndHydrateProject = (json: string): boolean => {
  if (!json) return false;
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid project file format: root object expected');
    }

    const canvas = extractCanvasData(data.canvas);
    const nodesWithStrings = mapNodesWithStrings(canvas.nodes);
    const edgesWithStrings = mapEdgesWithStrings(canvas.edges);

    const hydratedNodes = hydrateNodes(nodesWithStrings, () => useFlowStore.getState());
    const projectName = data.name || 'Imported Architecture';
    const rawSnapshot = typeof data.canvas === 'string' ? data.canvas : JSON.stringify(data.canvas);

    useFlowStore.setState({
      nodes: hydratedNodes,
      edges: edgesWithStrings,
      currentProject: { id: -1, name: projectName },
      lastSavedSnapshot: rawSnapshot,
    });

    useFlowStore.getState().addLog('info', `Imported architecture "${projectName}" successfully.`, 'System');
    return true;
  } catch (e: any) {
    logger.error('Failed to parse project file', e);
    const errorMsg = e?.message || 'Corrupted or invalid project file format';
    useFlowStore.getState().addLog('error', `Failed to import architecture: ${errorMsg}`, 'System');
    useFlowStore.getState().setLogModalOpen(true);
    return false;
  }
};

export const useFileSystem = (nodes: Node[], edges: Edge[]) => {
  useEffectExternalFileListener();

  const handleExportFile = useCallback(async () => {
    try {
      const currentProject = useFlowStore.getState().currentProject;
      const projectName = currentProject?.name || 'unnamed-project';
      const canvasContent = JSON.stringify({ nodes, edges });
      const yamlContent = await generateYaml(nodes, edges);
      const success = await getBackendGateway().exportProjectFile(
        projectName,
        canvasContent,
        yamlContent
      );
      if (success) {
        useFlowStore.getState().addLog('info', `Resource architecture "${projectName}" exported successfully.`, 'System');
      }
    } catch (err: any) {
      logger.error('Failed to export project file', err);
      const errorMsg = err?.message || 'Unknown error occurred while exporting file';
      useFlowStore.getState().addLog('error', `Failed to export architecture: ${errorMsg}`, 'System');
      useFlowStore.getState().setLogModalOpen(true);
    }
  }, [nodes, edges]);

  const handleImportFile = useCallback(async () => {
    try {
      const json = await getBackendGateway().importProjectFile();
      if (!json) return;
      parseAndHydrateProject(json);
    } catch (err: any) {
      logger.error('Failed to import project file', err);
      const errorMsg = err?.message || 'Unknown error occurred while importing file';
      useFlowStore.getState().addLog('error', `Failed to import architecture: ${errorMsg}`, 'System');
      useFlowStore.getState().setLogModalOpen(true);
    }
  }, []);

  return { handleExportFile, handleImportFile };
};

function useEffectExternalFileListener() {
  React.useEffect(() => {
    const off = getBackendGateway().onEvent('open-infra-file', (json: string) => {
      parseAndHydrateProject(json);
    });

    return () => {
      if (typeof off === 'function') off();
    };
  }, []);
}
