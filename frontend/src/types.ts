export type K8sResourceType = 'Pod' | 'Service' | 'Deployment' | 'Namespace' | 'Internet' | 'Ingress' | 'HPA' | 'PVC' | 'ConfigMap' | 'Secret' | 'Role' | 'IAM';

export interface KubeIAMPolicy {
  name: string;
  type: 'Default' | 'Custom';
  description: string;
}

export interface KubeIAMUser {
  id: string;
  username: string;
  accessType: 'Full Access' | 'Managed Access';
  policies: KubeIAMPolicy[];
  createdAt: number;
}

export interface K8sDigitalCertificate {
  user: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  authType: 'X.509 Certificate' | 'ServiceAccount Token' | 'Bearer Token';
  tokenSignature: string;
  fingerprint: string;
  status: 'VERIFIED & VALID' | 'REVOKED' | 'EXPIRED';
}

export interface K8sRoleRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
}

export interface K8sRoleSubject {
  kind: 'User' | 'ServiceAccount' | 'Group';
  name: string;
  namespace?: string;
}

export interface K8sRoleBindingItem {
  id: string;
  name: string;
  roleRef: string; // References K8sRoleItem name or id
  subjects: Array<string | K8sRoleSubject>;
  namespace?: string;
}

export interface K8sRoleItem {
  id: string;
  name: string;
  roleKind?: 'Role' | 'ClusterRole';
  rules: K8sRoleRule[];
  assignedUsers?: string[];
  subjects?: K8sRoleSubject[];
}

export interface K8sConfigMapItem {
  id: string;
  name: string;
  configData: Array<{ key: string; value: string }>;
}

export interface K8sSecretItem {
  id: string;
  name: string;
  secretData: Array<{ key: string; value: string }>;
  type?: string;
}

export interface K8sHpaItem {
  id: string;
  name: string;
  minReplicas: number;
  maxReplicas: number;
  targetCPU: number;
  targetMemory?: number;
}

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
  durationUnit?: 'millisecond' | 'second' | 'minute';
  parentReplicas?: number;
  displaySettings?: Record<string, boolean>;
  yamlSettings?: Record<string, boolean>;

  // PVC specific fields
  storageCapacity?: string;
  accessMode?: 'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany';
  storageClass?: string;
  pvcStatus?: 'Pending' | 'Bound';

  // ConfigMap & Secret specific fields
  configData?: Array<{ key: string; value: string }>;

  // Role, ConfigMap, Secret & HPA specific attached fields
  rules?: K8sRoleRule[];
  roles?: K8sRoleItem[];
  roleBindings?: K8sRoleBindingItem[];
  configMaps?: K8sConfigMapItem[];
  secrets?: K8sSecretItem[];
  hpas?: K8sHpaItem[];
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

export interface Project {
  id: number;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryLog {
  index: number;
  actionName: string;
  timestamp: number;
}
