import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LocalImageRow } from './DockerImageRow';

/** Props interface for the LocalImagesTab subcomponent. */
export interface LocalImagesTabProps {
  /** Form text value for adding a new custom local docker image tag. */
  readonly newCustomImage: string;
  /** Callback to update the custom image input state string. */
  readonly setNewCustomImage: (val: string) => void;
  /** Callback to process form submission for adding a custom image. */
  readonly handleAddCustomImageSubmit: () => void;
  /** Array of currently registered custom local image strings. */
  readonly customImages: readonly string[];
  /** Callback to delete an existing custom image tag string. */
  readonly deleteCustomImage: (img: string) => void;
  /** Active theme mode string. */
  readonly colorMode: 'dark' | 'light';
}

/**
 * LocalImagesTab renders the custom local & enterprise private docker image management panel.
 *
 * @param props - Subcomponent props.
 * @returns Renderable React element for local image registration.
 */
export const LocalImagesTab = ({
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
        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5 shadow-md shadow-blue-900/10 transition-all cursor-pointer"
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
