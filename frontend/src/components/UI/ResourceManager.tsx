import { useState, useEffect } from 'react';
import { FolderOpen, Database, Settings, Search } from 'lucide-react';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { hydrateNodes } from '@/store/nodeHelpers';
import { Modal } from '@/components/Modals/Modal';
import { useFitView } from '@/hooks/useFitView';

import { Project } from './ResourceManager/ArchitectureRow';
import { ProjectsTab } from './ResourceManager/ProjectsTab';
import { DockerRegistryTab } from './ResourceManager/DockerRegistryTab';
import { LocalImagesTab } from './ResourceManager/LocalImagesTab';
import { mapProjectNodes, mapProjectEdges, generateTimestampedProjectName } from './ResourceManager/resourceManagerHelpers';

/** Props interface for the ResourceManager modal component. */
export interface ResourceManagerProps {
  /** Controls modal visibility state. */
  readonly isOpen: boolean;
  /** Callback fired when the modal is closed. */
  readonly onClose: () => void;
}

/**
 * ResourceManager is the primary modal component for managing saved architecture projects,
 * searching Docker Hub registry libraries, and registering custom local container images.
 *
 * @param props - Modal visibility and callback props.
 * @returns Renderable React modal element or null if closed.
 */
export const ResourceManager = ({ isOpen, onClose }: ResourceManagerProps) => {
  const fitView = useFitView();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState('');
  const [newCustomImage, setNewCustomImage] = useState('');

  const [activeTab, setActiveTab] = useState<'projects' | 'docker' | 'local'>('projects');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [dockerSearch, setDockerSearch] = useState('');

  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const currentProject = useFlowStore((state) => state.currentProject);
  const lastSavedSnapshot = useFlowStore((state) => state.lastSavedSnapshot);

  const customImages = useFlowStore((state) => state.customImages);
  const addCustomImage = useFlowStore((state) => state.addCustomImage);
  const deleteCustomImage = useFlowStore((state) => state.deleteCustomImage);

  const isCanvasEmpty = nodes.length === 0;
  const currentContent = JSON.stringify({ nodes, edges });

  const loadProjects = async () => {
    const res = await globalThis.go?.main?.App?.GetProjects();
    setProjects(res || []);
  };

  useEffect(() => {
    if (!isOpen) return;

    loadProjects();

    const needsDefaultName = !isCanvasEmpty && (!currentProject || currentProject.id === -1);
    if (needsDefaultName) {
      setProjectName(generateTimestampedProjectName());
    } else {
      setProjectName('');
    }
  }, [isOpen, isCanvasEmpty, currentProject]);

  const [confirmOverwriteId, setConfirmOverwriteId] = useState<number | null>(null);
  const hasChanges = JSON.stringify({ nodes, edges }) !== lastSavedSnapshot;

  const handleUpdate = async () => {
    if (!currentProject) return;
    const content = JSON.stringify({ nodes, edges });
    const success = await globalThis.go?.main?.App?.UpdateProject(currentProject.id, content);
    if (success) {
      useFlowStore.setState({ lastSavedSnapshot: content });
      loadProjects();
      onClose();
    }
  };

  const handleOverwrite = async (id: number) => {
    const content = JSON.stringify({ nodes, edges });
    const success = await globalThis.go?.main?.App?.UpdateProject(id, content);
    if (success) {
      if (currentProject?.id === id) {
        useFlowStore.setState({ lastSavedSnapshot: content });
      }
      setConfirmOverwriteId(null);
      loadProjects();
    }
  };

  const handleSave = async () => {
    if (!projectName.trim()) return;
    const content = JSON.stringify({ nodes, edges });
    const id = await globalThis.go?.main?.App?.SaveProject(projectName, content);
    if (id !== undefined) {
      useFlowStore.setState({
        currentProject: { id, name: projectName },
        lastSavedSnapshot: content
      });
      setProjectName('');
      loadProjects();
    }
  };

  const handleLoad = async (id: number, name: string) => {
    const res = await globalThis.go?.main?.App?.LoadProject(id);
    if (!res?.content) return;

    const data = JSON.parse(res.content);
    const nodesWithStrings = mapProjectNodes(data.nodes);
    const edgesWithStrings = mapProjectEdges(data.edges);
    const hydratedNodes = hydrateNodes(nodesWithStrings, () => useFlowStore.getState());

    useFlowStore.setState({
      nodes: hydratedNodes,
      edges: edgesWithStrings,
      currentProject: { id, name },
      lastSavedSnapshot: res.content,
      isSimulating: false,
      activeSimulationEdges: [],
      simulationMetrics: {},
      lastActionId: `load-${Date.now()}`,
      lastActionName: 'Load Project'
    });

    onClose();
    setTimeout(() => {
      fitView({ padding: 0.1, duration: 800 });
    }, 50);
  };

  const handleDelete = async (id: number) => {
    await globalThis.go?.main?.App?.DeleteProject(id);
    if (currentProject?.id === id) {
      useFlowStore.setState({ currentProject: null, lastSavedSnapshot: null });
    }
    loadProjects();
  };

  const handleAddCustomImageSubmit = () => {
    if (!newCustomImage.trim()) return;
    addCustomImage(newCustomImage.trim());
    setNewCustomImage('');
  };

  const sidebarItems = [
    { id: 'projects', label: 'Saved Architectures', icon: FolderOpen },
    { id: 'docker', label: 'Docker Hub Registry', icon: Database },
    { id: 'local', label: 'Local & Custom Images', icon: Settings },
  ] as const;

  const filteredSidebarItems = sidebarItems.filter(item =>
    item.label.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resource Manager"
      icon={FolderOpen}
      widthClass="w-[780px]"
      maxHeightClass="h-[70vh]"
      disableScroll={true}
      compactHeader={true}
      footer={
        <div className="flex justify-between items-center w-full px-1 text-[10px] text-slate-500 font-medium font-mono">
          <span>Architecture & Resources Management</span>
          <span>SQLite & Zustand Store Synced</span>
        </div>
      }
    >
      <div className="flex h-[calc(100%+2rem)] -mx-4 -my-4 overflow-hidden">
        <div className={cn(
          "w-44 flex flex-col border-r h-full p-4 select-none shrink-0 space-y-1",
          colorMode === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
        )}>
          <div className="relative mb-2 shrink-0">
            <Search size={12} className={cn("absolute left-2.5 top-1/2 -translate-y-1/2", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")} />
            <input
              type="text"
              placeholder="Search tabs..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className={cn(
                "w-full pl-8 pr-2 py-1.5 text-[11px] outline-none rounded border transition-all",
                colorMode === 'dark'
                  ? "bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50"
                  : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-400"
              )}
            />
          </div>

          <div className="space-y-1 flex-1 overflow-y-auto pr-1">
            {filteredSidebarItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              let tabStyleClass = "";
              if (colorMode === 'dark') {
                tabStyleClass = isActive
                  ? "bg-slate-800 text-blue-400"
                  : "text-slate-400 hover:bg-slate-800/30 hover:text-slate-200";
              } else {
                tabStyleClass = isActive
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
              }

              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left",
                    tabStyleClass
                  )}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {filteredSidebarItems.length === 0 && (
              <p className="text-[10px] text-center text-slate-600 font-medium py-4">No categories found</p>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto h-full custom-scrollbar">
          {activeTab === 'projects' && (
            <ProjectsTab
              projectName={projectName}
              setProjectName={setProjectName}
              handleSave={handleSave}
              projects={projects}
              currentProject={currentProject}
              hasChanges={hasChanges}
              isCanvasEmpty={isCanvasEmpty}
              currentContent={currentContent}
              confirmOverwriteId={confirmOverwriteId}
              setConfirmOverwriteId={setConfirmOverwriteId}
              handleOverwrite={handleOverwrite}
              handleUpdate={handleUpdate}
              handleLoad={handleLoad}
              handleDelete={handleDelete}
              colorMode={colorMode}
            />
          )}

          {activeTab === 'docker' && (
            <DockerRegistryTab
              dockerSearch={dockerSearch}
              setDockerSearch={setDockerSearch}
              colorMode={colorMode}
              customImages={customImages}
              addCustomImage={addCustomImage}
              deleteCustomImage={deleteCustomImage}
            />
          )}

          {activeTab === 'local' && (
            <LocalImagesTab
              newCustomImage={newCustomImage}
              setNewCustomImage={setNewCustomImage}
              handleAddCustomImageSubmit={handleAddCustomImageSubmit}
              customImages={customImages}
              deleteCustomImage={deleteCustomImage}
              colorMode={colorMode}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};
