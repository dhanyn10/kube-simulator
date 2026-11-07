import { generateYaml } from '@/lib/utils';
import { logger } from '@/lib/logger';
import React, { useCallback } from 'react';
import { useFlowStore } from '@/store';
import { hydrateNodes } from '@/store/nodeHelpers';
import { Node, Edge } from '@xyflow/react';
import { getBackendGateway } from '@/gateway';

const parseAndHydrateProject = (json: string) => {
  if (!json) return;
  try {
    const data = JSON.parse(json);
    const canvas = JSON.parse(data.canvas);
    const nodesWithStrings = (canvas.nodes || []).map((n: any) => ({
      ...n,
      id: String(n.id),
      parentId: n.parentId ? String(n.parentId) : undefined,
    }));

    const edgesWithStrings = (canvas.edges || []).map((e: any) => ({
      ...e,
      id: String(e.id),
      source: String(e.source),
      target: String(e.target),
      type: 'custom',
    }));

    const hydratedNodes = hydrateNodes(nodesWithStrings, () => useFlowStore.getState());
    useFlowStore.setState({
      nodes: hydratedNodes,
      edges: edgesWithStrings,
      currentProject: { id: -1, name: data.name },
      lastSavedSnapshot: data.canvas,
    });
  } catch (e) {
    logger.error('Failed to parse project file', e);
  }
};

export const useFileSystem = (nodes: Node[], edges: Edge[]) => {
  useEffectExternalFileListener();

  const handleExportFile = useCallback(async () => {
    const currentProject = useFlowStore.getState().currentProject;
    const canvasContent = JSON.stringify({ nodes, edges });
    const yamlContent = await generateYaml(nodes, edges);
    await getBackendGateway().exportProjectFile(
      currentProject?.name || 'unnamed-project',
      canvasContent,
      yamlContent
    );
  }, [nodes, edges]);

  const handleImportFile = useCallback(async () => {
    const json = await getBackendGateway().importProjectFile();
    if (json) {
      parseAndHydrateProject(json);
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
