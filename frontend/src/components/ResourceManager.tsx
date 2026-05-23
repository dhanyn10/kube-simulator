import { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, Plus, Database, Settings, Search, Globe, Box } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { hydrateNodes } from '../store/nodeHelpers';
import { Modal } from './Modal';
import { DEFAULT_REGISTRY_IMAGES } from '../constants/config';

interface Project {
  id: number;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface ResourceManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ArchitectureRowProps {
  p: Project;
  isActive: boolean;
  hasChanges: boolean;
  isCanvasEmpty: boolean;
  currentContent: string;
  confirmOverwriteId: number | null;
  setConfirmOverwriteId: (id: number | null) => void;
  onOverwrite: (id: number) => void;
  onUpdate: () => void;
  onLoad: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  colorMode: 'dark' | 'light';
}

const ArchitectureRow = ({
  p,
  isActive,
  hasChanges,
  isCanvasEmpty,
  currentContent,
  confirmOverwriteId,
  setConfirmOverwriteId,
  onOverwrite,
  onUpdate,
  onLoad,
  onDelete,
  colorMode
}: ArchitectureRowProps) => {
  const isConfirming = confirmOverwriteId === p.id;
  
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-all duration-150 hover:shadow-md",
        colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/80 hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300",
        isActive && (colorMode === 'dark' ? "border-blue-500 bg-blue-950/10" : "border-blue-300 bg-blue-50/20")
      )}
    >
      <div className="min-w-0 pr-3">
        <div className="font-semibold text-xs truncate flex items-center gap-1.5">
          <span>{p.name}</span>
          {isActive && (
            <span className="text-[9px] bg-blue-500 text-white px-1 py-0.2 rounded uppercase tracking-wider font-bold">Active</span>
          )}
        </div>
        <div className="text-[9px] text-slate-500 font-mono mt-0.5">
          {new Date(p.updatedAt * 1000).toLocaleString()}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isConfirming ? (
          <div className="flex items-center gap-2 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
            <span className="text-[9px] font-black text-red-500 uppercase tracking-wider">OVERWRITE?</span>
            <button onClick={() => onOverwrite(p.id)} className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 transition-colors">YES</button>
            <button onClick={() => setConfirmOverwriteId(null)} className="text-[10px] font-black text-slate-500 hover:text-slate-400 transition-colors">NO</button>
          </div>
        ) : (
          <>
            {isActive ? (
              hasChanges && (
                <button
                  onClick={onUpdate}
                  className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors flex items-center gap-1 shadow shadow-emerald-950/20"
                >
                  <Save size={12} /> Update
                </button>
              )
            ) : (
              <>
                {!isCanvasEmpty && p.content !== currentContent && (
                  <button
                    onClick={() => setConfirmOverwriteId(p.id)}
                    className="px-2.5 py-1 text-[10px] font-bold text-amber-500 hover:bg-amber-500/10 rounded transition-colors border border-amber-500/20"
                  >
                    Overwrite
                  </button>
                )}
                <button
                  onClick={() => onLoad(p.id, p.name)}
                  className="px-2.5 py-1 text-[10px] font-bold text-blue-500 hover:bg-blue-500/10 rounded transition-colors border border-blue-500/20"
                >
                  Open
                </button>
              </>
            )}
            <button
              onClick={() => onDelete(p.id)}
              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
              title="Delete project"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

interface DockerImageCardProps {
  img: { name: string; desc: string };
  colorMode: 'dark' | 'light';
}

const DockerImageCard = ({ img, colorMode }: DockerImageCardProps) => {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border flex flex-col justify-between transition-all select-none hover:shadow",
        colorMode === 'dark' ? "bg-slate-950/20 border-slate-800/80" : "bg-slate-50 border-slate-200"
      )}
    >
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Globe size={11} className="text-blue-500" />
          <span className="font-semibold text-xs font-mono">{img.name}</span>
        </div>
        <p className="text-[9px] text-slate-500 leading-tight line-clamp-2">{img.desc}</p>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-800/20 pt-1.5">
        <span className="text-[8px] bg-blue-500/10 text-blue-500 px-1 py-0.2 rounded font-bold uppercase tracking-wider">PUBLIC REGISTRY</span>
        <span className="text-[8px] text-slate-600 font-bold">READY TO USE</span>
      </div>
    </div>
  );
};

interface LocalImageRowProps {
  img: string;
  onDelete: (img: string) => void;
  colorMode: 'dark' | 'light';
}

const LocalImageRow = ({ img, onDelete, colorMode }: LocalImageRowProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-2.5 px-3.5 rounded-lg border transition-all duration-150",
        colorMode === 'dark' ? "bg-slate-950/30 border-slate-800/80 hover:border-slate-700" : "bg-slate-50 border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-center gap-2">
        <Box size={12} className="text-emerald-500" />
        <span className="font-semibold text-xs font-mono">{img}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1 py-0.2 rounded font-bold uppercase tracking-wider">LOCAL CACHE</span>
        <button
          onClick={() => onDelete(img)}
          className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
          title="Delete image option"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

const mapProjectNodes = (nodes: any[]): any[] => {
  return (nodes || []).map((n: any) => ({ 
    ...n, 
    id: String(n.id), 
    parentId: n.parentId ? String(n.parentId) : undefined 
  }));
};

const mapProjectEdges = (edges: any[]): any[] => {
  return (edges || []).map((e: any) => ({ 
    ...e, 
    id: String(e.id), 
    source: String(e.source), 
    target: String(e.target), 
    type: 'custom' 
  }));
};

const generateTimestampedProjectName = (): string => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dmyhis = `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `Project-${dmyhis}`;
};

export const ResourceManager = ({ isOpen, onClose }: ResourceManagerProps) => {
  const { fitView } = useReactFlow();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState('');
  const [newCustomImage, setNewCustomImage] = useState('');
  
  // Settings Tab selection (WebStorm style)
  const [activeTab, setActiveTab] = useState<'projects' | 'docker' | 'local'>('projects');
  // Left sidebar settings filter search
  const [sidebarSearch, setSidebarSearch] = useState('');
  // Content filters
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
      fitView({ padding: 0.2, duration: 800 });
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

  // JetBrains-style sidebar categories with search filtering
  const sidebarItems = [
    { id: 'projects', label: 'Saved Architectures', icon: FolderOpen },
    { id: 'docker', label: 'Docker Hub Registry', icon: Database },
    { id: 'local', label: 'Local & Custom Images', icon: Settings },
  ] as const;

  const filteredSidebarItems = sidebarItems.filter(item =>
    item.label.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  // Filter public images inside tab
  const filteredDockerImages = DEFAULT_REGISTRY_IMAGES.filter(img =>
    img.name.toLowerCase().includes(dockerSearch.toLowerCase()) ||
    img.desc.toLowerCase().includes(dockerSearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resource Manager"
      icon={FolderOpen}
      widthClass="w-[780px]"
      maxHeightClass="max-h-[85vh]"
      footer={
        <div className="flex justify-between items-center w-full px-1 text-[10px] text-slate-500 font-medium font-mono">
          <span>JetBrains WebStorm 2026 Settings Paradigm</span>
          <span>SQLite & Zustand Store Synced</span>
        </div>
      }
    >
      {/* WebStorm-style Settings Pane Layout */}
      <div className="flex h-[460px] -mx-5 -my-5 overflow-hidden">
        
        {/* LEFT COLUMN: Sleek Settings Navigation Sidebar */}
        <div className={cn(
          "w-[220px] flex flex-col border-r h-full p-3 select-none shrink-0",
          colorMode === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"
        )}>
          {/* WebStorm Settings Search Input */}
          <div className="relative mb-3">
            <Search size={12} className={cn("absolute left-2.5 top-1/2 -translate-y-1/2", colorMode === 'dark' ? "text-slate-500" : "text-slate-400")} />
            <input
              type="text"
              placeholder="Search settings..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className={cn(
                "w-full pl-8 pr-2 py-1 text-[10px] outline-none rounded transition-all",
                colorMode === 'dark'
                  ? "bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50"
                  : "bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-400"
              )}
            />
          </div>

          {/* Settings Category List */}
          <div className="space-y-0.5 flex-1 overflow-y-auto pr-1">
            {filteredSidebarItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              let itemClasses = "";
              if (isActive) {
                itemClasses = colorMode === 'dark'
                  ? "bg-blue-600/15 text-blue-400 border-l-[3px] border-blue-500 pl-[9px]"
                  : "bg-blue-50 text-blue-600 border-l-[3px] border-blue-500 pl-[9px]";
              } else {
                itemClasses = colorMode === 'dark'
                  ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-[11px] font-semibold text-left transition-all duration-150 group",
                    itemClasses
                  )}
                >
                  <Icon size={13} className={cn("transition-colors", isActive ? "text-blue-500" : "text-slate-500 group-hover:text-slate-400")} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {filteredSidebarItems.length === 0 && (
              <p className="text-[10px] text-center text-slate-600 font-medium py-4">No categories found</p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Settings Details content panel */}
        <div className={cn(
          "flex-1 flex flex-col h-full overflow-hidden p-5",
          colorMode === 'dark' ? "bg-slate-900/10" : "bg-white"
        )}>
          
          {/* TAB 1: SAVED ARCHITECTURES */}
          {activeTab === 'projects' && (
            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Architecture Archives</h3>
                <p className="text-[10px] text-slate-500 leading-tight">Create, update, restore, or manage local Kubernetes system architectures.</p>
              </div>

              {/* Save As Form */}
              <div className={cn(
                "p-3 rounded-lg border flex gap-3 items-center",
                colorMode === 'dark' ? "bg-slate-950/20 border-slate-800" : "bg-slate-50 border-slate-200"
              )}>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Enter new architecture name..."
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className={cn(
                      "w-full px-3 py-1.5 text-xs outline-none rounded border focus:ring-1 focus:ring-blue-500/50",
                      colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200"
                    )}
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={!projectName.trim()}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/10 transition-all"
                >
                  <Plus size={14} /> Save New
                </button>
              </div>

              {/* Saved Architectures List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {projects.length === 0 ? (
                  <div className={cn("text-center py-12 rounded-xl border border-dashed", colorMode === 'dark' ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400")}>
                    No saved architectures found
                  </div>
                ) : (
                  projects.map((p) => (
                    <ArchitectureRow
                      key={p.id}
                      p={p}
                      isActive={currentProject?.id === p.id}
                      hasChanges={hasChanges}
                      isCanvasEmpty={isCanvasEmpty}
                      currentContent={currentContent}
                      confirmOverwriteId={confirmOverwriteId}
                      setConfirmOverwriteId={setConfirmOverwriteId}
                      onOverwrite={handleOverwrite}
                      onUpdate={handleUpdate}
                      onLoad={handleLoad}
                      onDelete={handleDelete}
                      colorMode={colorMode}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DOCKER HUB REGISTRY */}
          {activeTab === 'docker' && (
            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Docker Hub Official Images</h3>
                  <p className="text-[10px] text-slate-500 leading-tight">Registry images readily available as options for Container Images.</p>
                </div>
                {/* Internal Search bar */}
                <div className="relative w-44">
                  <Search size={10} className={cn("absolute left-2 top-1/2 -translate-y-1/2", colorMode === 'dark' ? "text-slate-600" : "text-slate-400")} />
                  <input
                    type="text"
                    placeholder="Search images..."
                    value={dockerSearch}
                    onChange={(e) => setDockerSearch(e.target.value)}
                    className={cn(
                      "w-full pl-6 pr-2 py-0.8 text-[10px] outline-none rounded border",
                      colorMode === 'dark' ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200"
                    )}
                  />
                </div>
              </div>

              {/* Grid of Public Images */}
              <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 gap-3 self-stretch align-content-start">
                {filteredDockerImages.length === 0 ? (
                  <div className="col-span-2 text-center py-12 text-slate-500 text-xs">No images matched "{dockerSearch}"</div>
                ) : (
                  filteredDockerImages.map((img) => (
                    <DockerImageCard
                      key={img.name}
                      img={img}
                      colorMode={colorMode}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LOCAL & CUSTOM IMAGES */}
          {activeTab === 'local' && (
            <div className="flex-1 flex flex-col overflow-hidden space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Local & Private Images</h3>
                <p className="text-[10px] text-slate-500 leading-tight">Add your custom docker repositories, private enterprise images, or local builds.</p>
              </div>

              {/* Mini Custom Image Form */}
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
                  onClick={handleAddCustomImageSubmit}
                  disabled={!newCustomImage.trim()}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/10 transition-all"
                >
                  <Plus size={14} /> Add Image
                </button>
              </div>

              {/* Custom Image List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
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
          )}

        </div>
      </div>
    </Modal>
  );
};
