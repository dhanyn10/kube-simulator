import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_REGISTRY_IMAGES } from '@/constants/config';
import { FetchDockerHubPopular, SearchDockerHub } from '@wailsjs/go/main/App';
import { DockerImageCard, parseDockerResults } from './DockerImageRow';
import { TagsView } from './TagsView';

/** Props interface for the DockerRegistryTab subcomponent. */
export interface DockerRegistryTabProps {
  /** Live search input string for filtering Docker Hub images. */
  readonly dockerSearch: string;
  /** Callback to update the docker search state string. */
  readonly setDockerSearch: (val: string) => void;
  /** Active theme mode string. */
  readonly colorMode: 'dark' | 'light';
  /** Array of registered custom image strings. */
  readonly customImages: readonly string[];
  /** Callback to add a new custom image string. */
  readonly addCustomImage: (img: string) => void;
  /** Callback to delete a custom image string. */
  readonly deleteCustomImage: (img: string) => void;
}

/**
 * DockerRegistryTab renders the real-time Docker Hub search interface, allowing users
 * to search for enterprise libraries or popular Docker registry images.
 *
 * @param props - Subcomponent props.
 * @returns Renderable React element for the Docker Hub tab.
 */
export const DockerRegistryTab = ({
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
