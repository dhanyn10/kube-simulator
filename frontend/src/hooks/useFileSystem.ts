import React, { useCallback } from 'react';
import { useFlowStore } from '../store';
import { generateYaml } from '../lib/utils';
import { hydrateNodes } from '../store/nodeHelpers';
import { Node, Edge } from '@xyflow/react';

export const useFileSystem = (nodes: Node[], edges: Edge[]) => {
  // Listen for external file open events (Open With)
  React.useEffect(() => {
    if (globalThis.runtime?.EventsOn) {
      const off = globalThis.runtime.EventsOn('open-infra-file', (json: string) => {
        if (json) {
          try {
            const data = JSON.parse(json);
            const canvas = JSON.parse(data.canvas);
            const nodesWithStrings = (canvas.nodes || []).map((n: any) => ({
              ...n,
              id: String(n.id),
              parentId: n.parentId ? String(n.parentId) : undefined
            })) as any[];

            const edgesWithStrings = (canvas.edges || []).map((e: any) => ({
              ...e,
              id: String(e.id),
              source: String(e.source),
              target: String(e.target),
              type: 'custom'
            }));

            const hydratedNodes = hydrateNodes(nodesWithStrings, () => useFlowStore.getState());
            useFlowStore.setState({
              nodes: hydratedNodes,
              edges: edgesWithStrings,
              currentProject: { id: -1, name: data.name },
              lastSavedSnapshot: data.canvas
            });
          } catch (e) {
            console.error("Failed to open external file", e);
          }
        }
      });
      return () => {
        if (typeof off === 'function') (off as () => void)();
      };
    }
  }, []);

  const handleExportFile = useCallback(async () => {
    const currentProject = useFlowStore.getState().currentProject;
    if (globalThis.go?.main?.App?.ExportProjectFile) {
      const canvasContent = JSON.stringify({ nodes, edges });
      const yamlContent = await generateYaml(nodes, edges);
      await globalThis.go.main.App.ExportProjectFile(
        currentProject?.name || "unnamed-project",
        canvasContent,
        yamlContent
      );
    }
  }, [nodes, edges]);

  const handleImportFile = useCallback(async () => {
    if (globalThis.go?.main?.App?.ImportProjectFile) {
      const json = await globalThis.go.main.App.ImportProjectFile();
      if (json) {
        try {
          const data = JSON.parse(json);
          const canvas = JSON.parse(data.canvas);
          const nodesWithStrings = (canvas.nodes || []).map((n: any) => ({
            ...n,
            id: String(n.id),
            parentId: n.parentId ? String(n.parentId) : undefined
          })) as any[];

          const edgesWithStrings = (canvas.edges || []).map((e: any) => ({
            ...e,
            id: String(e.id),
            source: String(e.source),
            target: String(e.target),
            type: 'custom'
          }));

          const hydratedNodes = hydrateNodes(nodesWithStrings, () => useFlowStore.getState());
          useFlowStore.setState({
            nodes: hydratedNodes,
            edges: edgesWithStrings,
            currentProject: { id: -1, name: data.name },
            lastSavedSnapshot: data.canvas
          });
        } catch (e) {
          console.error("Failed to import file", e);
        }
      }
    }
  }, []);

  return { handleExportFile, handleImportFile };
};
