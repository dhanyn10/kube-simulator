export type K8sResourceType = 'Pod' | 'Service' | 'Deployment' | 'Namespace' | 'Internet' | 'Ingress' | 'HPA' | 'PVC' | 'ConfigMap' | 'Secret';

export interface K8sNodeData {
  [key: string]: any;
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
  status?: 'pending' | 'ready' | 'crashing';
  webserver?: string;
  runtime?: string;
  framework?: string;
  isAutoNamed?: boolean;

  // Resource Limits
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;

  // HPA specific fields
  minReplicas?: number;
  maxReplicas?: number;
  targetCPU?: number;
  targetMemory?: number;

  // Ingress specific fields
  ingressHost?: string;
  ingressPath?: string;

  // Internet specific fields
  traffic?: number;
  durationUnit?: 'second' | 'minute' | 'hour';
  parentReplicas?: number;
  displaySettings?: Record<string, boolean>;

  // PVC specific fields
  storageCapacity?: string;
  accessMode?: 'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany';
  storageClass?: string;
  pvcStatus?: 'Pending' | 'Bound';

  // ConfigMap & Secret specific fields
  configData?: Array<{ key: string; value: string }>;
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
