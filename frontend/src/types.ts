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
