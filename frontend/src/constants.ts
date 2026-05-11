import { K8sResourceType } from './types';

export const NODE_TYPES: Record<K8sResourceType, { color: string; icon: string }> = {
  Pod: { color: 'blue', icon: 'Box' },
  Service: { color: 'green', icon: 'Network' },
  Deployment: { color: 'purple', icon: 'Layers' },
  Namespace: { color: 'orange', icon: 'Anchor' },
  Internet: { color: 'blue', icon: 'Globe' },
  Ingress: { color: 'rose', icon: 'Globe' },
  HPA: { color: 'fuchsia', icon: 'Activity' },
  PVC: { color: 'orange', icon: 'Database' },
  ConfigMap: { color: 'amber', icon: 'FileText' },
  Secret: { color: 'red', icon: 'Lock' },
};

export const INITIAL_NODES = [];
export const INITIAL_EDGES = [];
