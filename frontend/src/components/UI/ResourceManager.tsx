import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Database, Settings, Search, Box, Check } from 'lucide-react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';
import { hydrateNodes } from '../../store/nodeHelpers';
import { Modal } from '../Modals/Modal';
import { DEFAULT_REGISTRY_IMAGES } from '../../constants/config';
import { useFitView } from '../../hooks/useFitView';
import { FetchDockerHubPopular, SearchDockerHub, FetchDockerHubTags } from '@wailsjs/go/main/App';

import { Project } from './ResourceManager/ArchitectureRow';
import { DockerImageCard, parseDockerResults, LocalImageRow } from './ResourceManager/DockerImageRow';
import { ProjectsTab } from './ResourceManager/ProjectsTab';
import { mapProjectNodes, mapProjectEdges, generateTimestampedProjectName } from './ResourceManager/resourceManagerHelpers';

/** Props interface for the ResourceManager modal component. */
interface ResourceManagerProps {
  /** Controls modal visibility state. */
  isOpen: boolean;
  /** Callback fired when the modal is closed. */
  onClose: () => void;
}

/** Props interface for the TagsView subcomponent. */
interface TagsViewProps {
  /** Docker repository name to fetch tags for (e.g. 'library/nginx'). */
  repoName: string;
  /** Callback to navigate back to the main registry list view. */
  onBack: () => void;
  /** Active application theme mode. */
  colorMode: 'dark' | 'light';
  /** Array of currently registered custom docker image strings. */
  customImages: string[];
  /** Callback to add a new custom docker image. */
  addCustomImage: (img: string) => void;
  /** Callback to delete an existing custom docker image. */
  deleteCustomImage: (img: string) => void;
}

/**
 * TagsView component renders available image tags for a selected Docker Hub repository,
 * allowing users to selectively register specific container image tags into the simulator.
 *
 * @param props - Subcomponent props.
 * @returns Renderable React node element.
 */
const TagsView = ({
  repoName,
  onBack,
  colorMode,
  customImages,
  addCustomImage,
  deleteCustomImage
}: TagsViewProps) => {
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    const loadTags = async () => {
      try {
        const rawData = await FetchDockerHubTags(repoName);
        if (!rawData) {
          throw new Error("Failed to retrieve tags from backend");
        }
        const data = JSON.parse(rawData);
        if (!active) return;

        const parsedTags = (data.results || []).map((t: any) => t.name).filter(Boolean);
        setTags(parsedTags);
      } catch (err: any) {
        if (!active) return;
        setError(err.message || "Failed to load tags");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadTags();

    return () => {
      active = false;
    };
  }, [repoName]);

  let innerContent;
  if (isLoading) {
    innerContent = (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
      </div>
    );
  } else if (error) {
    innerContent = (
      <div className="text-center py-10 text-slate-500 text-xs">
        <p className="text-red-400 font-semibold mb-1">Failed to load tags</p>
        <p className="opacity-70">{error}</p>
      </div>
    );
  } else if (tags.length === 0) {
    innerContent = (
      <div className="text-center py-10 text-slate-500 text-xs">No tags found for "{repoName}"</div>
    );
  } else {
    innerContent = (
      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
        {tags.map((tag) => {
          const fullName = `${repoName}:${tag}`;
          const isAdded = customImages.includes(fullName);

          const handleToggle = () => {
            if (isAdded) {
              deleteCustomImage(fullName);
            } else {
              addCustomImage(fullName);
            }
          };

          return (
            <div
              key={tag}
              className={cn(
                "flex items-center justify-between p-2.5 px-3.5 rounded-lg border transition-all duration-150 min-w-0 gap-3",
                colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/80 hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300",
                isAdded && (colorMode === 'dark' ? "border-emerald-500/30 bg-emerald-950/5" : "border-emerald-300 bg-emerald-50/10")
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Box size={12} className={cn("shrink-0", isAdded ? "text-emerald-500" : "text-blue-500")} />
                <span className="font-semibold text-xs font-mono truncate flex-1" title={fullName}>{fullName}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleToggle}
                  className={cn(
                    "px-2.5 py-1 text-[9px] font-bold uppercase rounded transition-colors flex items-center gap-1 cursor-pointer",
                    isAdded
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  )}
                >
                  {isAdded ? (
                    <>
                      <Check size={10} strokeWidth={3} /> ADDED
                    </>
                  ) : (
                    "+ ADD OPTION"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b border-dashed border-slate-700/20">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "px-2.5 py-1 text-[10px] font-bold uppercase rounded border transition-colors cursor-pointer",
            colorMode === 'dark'
              ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
          )}
        >
          &larr; Back
        </button>
        <div>
          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Tags for {repoName}</h3>
          <p className="text-[10px] text-slate-500 leading-tight">Select specific tags to add to your available image options.</p>
        </div>
      </div>

      {innerContent}
    </div>
  );
};

/** Props interface for the DockerRegistryTab subcomponent. */
interface DockerRegistryTabProps {
  /** Live search input string for filtering Docker Hub images. */
  dockerSearch: string;
  /** Callback to update the docker search state string. */
  setDockerSearch: (val: string) => void;
  /** Active theme mode string. */
  colorMode: 'dark' | 'light';
  /** Array of registered custom image strings. */
  customImages: string[];
  /** Callback to add a new custom image string. */
  addCustomImage: (img: string) => void;
  /** Callback to delete a custom image string. */
  deleteCustomImage: (img: string) => void;
}

/**
 * DockerRegistryTab renders the real-time Docker Hub search interface, allowing users
 * to search for enterprise libraries or popular Docker registry images.
 *
 * @param props - Subcomponent props.
 * @returns Renderable React element for the Docker Hub tab.
 */
const DockerRegistryTab = ({
  dockerSearch,
  setDockerSearch,
  colorMode,
  customImages,
  addCustomImage,
  deleteCustomImage
}: DockerRegistryTabProps) => {
  const [images, setImages] = useState<{ name: string; desc: string }[]>(DEFAULT_REGISTRY_IMAGES as any);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    const fetchImages = async () => {
      try {
        const isSearch = dockerSearch.trim().length > 0;
        const rawData = isSearch
          ? await SearchDockerHub(dockerSearch.trim())
          : await FetchDockerHubPopular();

        if (!rawData) {
          throw new Error("No data returned from backend");
        }

        const parsed = parseDockerResults(rawData, isSearch);

        if (!active) return;

        if (parsed.length === 0 && !isSearch) {
          setImages(DEFAULT_REGISTRY_IMAGES as any);
        } else {
          setImages(parsed);
        }
      } catch (err: any) {
        if (!active) return;

        const isSearch = dockerSearch.trim().length > 0;
        if (!isSearch) {
          setImages(DEFAULT_REGISTRY_IMAGES as any);
        } else {
          setImages([]);
          setError(err.message || 'Failed to fetch images');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      fetchImages();
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [dockerSearch]);

  if (selectedRepo) {
    return (
      <TagsView
        repoName={selectedRepo}
        onBack={() => setSelectedRepo(null)}
        colorMode={colorMode}
        customImages={customImages}
        addCustomImage={addCustomImage}
        deleteCustomImage={deleteCustomImage}
      />
    );
  }

  let content;
  if (isLoading) {
    content = (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
      </div>
    );
  } else if (error && images.length === 0) {
    content = (
      <div className="text-center py-12 text-slate-500 text-xs">
        <p className="text-red-400 font-semibold mb-1">Offline / API Limit Exceeded</p>
        <p className="opacity-70">Could not retrieve results from Docker Hub.</p>
      </div>
    );
  } else if (images.length === 0) {
    content = (
      <div className="text-center py-12 text-slate-500 text-xs">No images matched "{dockerSearch}"</div>
    );
  } else {
    content = (
      <div className="grid grid-cols-2 gap-3">
        {images.map((img) => (
          <DockerImageCard
            key={img.name}
            img={img}
            colorMode={colorMode}
            onClick={() => setSelectedRepo(img.name)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Docker Hub Registry</h3>
          <p className="text-[10px] text-slate-500 leading-tight">Search real-time images or discover popular libraries from Docker Hub.</p>
        </div>
        <div className="relative w-44 shrink-0">
          <Search size={10} className={cn("absolute left-2 top-1/2 -translate-y-1/2", colorMode === 'dark' ? "text-slate-600" : "text-slate-400")} />
          <input
            type="text"
            placeholder="Search Docker Hub..."
            value={dockerSearch}
            onChange={(e) => setDockerSearch(e.target.value)}
            className={cn(
              "w-full pl-6 pr-2 py-0.8 text-[10px] outline-none rounded border",
              colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200"
            )}
          />
        </div>
      </div>

      {content}
    </div>
  );
};

/** Props interface for the LocalImagesTab subcomponent. */
interface LocalImagesTabProps {
  /** Form text value for adding a new custom local docker image tag. */
  newCustomImage: string;
  /** Callback to update the custom image input state string. */
  setNewCustomImage: (val: string) => void;
  /** Callback to process form submission for adding a custom image. */
  handleAddCustomImageSubmit: () => void;
  /** Array of currently registered custom local image strings. */
  customImages: string[];
  /** Callback to delete an existing custom image tag string. */
  deleteCustomImage: (img: string) => void;
  /** Active theme mode string. */
  colorMode: 'dark' | 'light';
}

/**
 * LocalImagesTab renders the custom local & enterprise private docker image management panel.
 *
 * @param props - Subcomponent props.
 * @returns Renderable React element for local image registration.
 */
const LocalImagesTab = ({
  newCustomImage,
  setNewCustomImage,
  handleAddCustomImageSubmit,
  customImages,
  deleteCustomImage,
  colorMode
}: LocalImagesTabProps) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Local & Private Images</h3>
      <p className="text-[10px] text-slate-500 leading-tight">Add your custom docker repositories, private enterprise images, or local builds.</p>
    </div>

    <div className={cn(
      "p-3 rounded-lg border flex gap-3 items-center",
      colorMode === 'dark' ? "bg-slate-950/20 border-slate-800" : "bg-slate-50 border-slate-200"
    )}>
      <div className="flex-1">
        <input
          type="text"
          placeholder="e.g. my-app:v1.0.0 or gcr.io/company/api:latest..."
          value={newCustomImage}
          onChange={(e) => setNewCustomImage(e.target.value)}
          className={cn(
            "w-full px-3 py-1.5 text-xs outline-none rounded border focus:ring-1 focus:ring-blue-500/50",
            colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200"
          )}
        />
      </div>
      <button
        type="button"
        onClick={handleAddCustomImageSubmit}
        disabled={!newCustomImage.trim()}
        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/10 transition-all"
      >
        <Plus size={14} /> Add Image
      </button>
    </div>

    <div className="space-y-2">
      {customImages.length === 0 ? (
        <div className={cn("text-center py-12 rounded-xl border border-dashed", colorMode === 'dark' ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400")}>
          No custom local images registered yet. Add one above!
        </div>
      ) : (
        customImages.map((img) => (
          <LocalImageRow
            key={img}
            img={img}
            onDelete={deleteCustomImage}
            colorMode={colorMode}
          />
        ))
      )}
    </div>
  </div>
);

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
