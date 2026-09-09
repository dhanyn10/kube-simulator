import { useState, useEffect } from 'react';
import { Box, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FetchDockerHubTags } from '@wailsjs/go/main/App';

/** Props interface for the TagsView subcomponent. */
export interface TagsViewProps {
  /** Docker repository name to fetch tags for (e.g. 'library/nginx'). */
  readonly repoName: string;
  /** Callback to navigate back to the main registry list view. */
  readonly onBack: () => void;
  /** Active application theme mode. */
  readonly colorMode: 'dark' | 'light';
  /** Array of currently registered custom docker image strings. */
  readonly customImages: readonly string[];
  /** Callback to add a new custom docker image. */
  readonly addCustomImage: (img: string) => void;
  /** Callback to delete an existing custom docker image. */
  readonly deleteCustomImage: (img: string) => void;
}

/**
 * TagsView component renders available image tags for a selected Docker Hub repository,
 * allowing users to selectively register specific container image tags into the simulator.
 *
 * @param props - Subcomponent props.
 * @returns Renderable React node element.
 */
export const TagsView = ({
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
