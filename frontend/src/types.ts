export type K8sResourceType = 'Pod' | 'Service' | 'Deployment' | 'Namespace';

export interface K8sNodeData {
  label: string;
  type: K8sResourceType;
  replicas?: number;
  image?: string;
  port?: number;
  targetPort?: number;
  selector?: string;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
  isHovered?: boolean; // For when a Pod is dragged over it
  isDetaching?: boolean; // For when a Pod is dragged out of it
  width?: number; // Added for resizing
  height?: number; // Added for resizing
}

export interface K8sManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    labels?: Record<string, string>;
  };
  spec?: any;
}
