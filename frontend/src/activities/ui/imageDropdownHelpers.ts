import { DEFAULT_REGISTRY_IMAGES } from '@/constants/config';

export interface ImageOption {
  name: string;
  source: 'docker' | 'local';
}

/**
 * Calculates CSS class names for image option buttons based on selection status and color mode.
 */
export const getOptionClasses = (
  imgName: string,
  value: string,
  colorMode: 'dark' | 'light'
): string => {
  const isSelected = value === imgName;
  if (isSelected) {
    return colorMode === 'dark' ? 'bg-slate-900 text-blue-400' : 'bg-blue-50/50 text-blue-600';
  }
  return colorMode === 'dark' ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-50 text-slate-700';
};

/**
 * Filters docker hub and custom local images based on user search query.
 */
export const filterImageOptions = (
  search: string,
  customImages: string[]
): { dockerHub: ImageOption[]; local: ImageOption[] } => {
  const query = search.toLowerCase();
  const dockerHub = DEFAULT_REGISTRY_IMAGES.filter((img) =>
    img.name.toLowerCase().includes(query)
  ).map((img) => ({ name: img.name, source: 'docker' as const }));

  const local = customImages
    .filter((img) => img.toLowerCase().includes(query))
    .map((img) => ({ name: img, source: 'local' as const }));

  return { dockerHub, local };
};
