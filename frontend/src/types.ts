export type K8sResourceType = 'Pod' | 'Service' | 'Deployment' | 'Namespace' | 'Internet';

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
  isHovered?: boolean;
  isDetaching?: boolean;
  width?: number;
  height?: number;
  
  // Application Stack fields
  status?: 'pending' | 'ready';
  webserver?: 'nginx' | 'apache' | 'none';
  runtime?: 'php' | 'nodejs' | 'java' | 'go' | 'python' | 'none';
  framework?: string;
  isAutoNamed?: boolean;

  // Internet specific fields
  traffic?: number;
  durationUnit?: 'second' | 'minute' | 'hour';
  parentReplicas?: number;
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
