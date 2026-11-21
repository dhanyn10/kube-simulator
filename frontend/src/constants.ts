import { K8sResourceType } from './types';

export { APP_VERSION, getNextMinorVersion } from './constants/config';

export const NODE_TYPES: Record<K8sResourceType, { color: string; icon: string }> = {
  Pod: { color: 'blue', icon: 'Box' },
  Service: { color: 'green', icon: 'Network' },
  Deployment: { color: 'purple', icon: 'Layers' },
  StatefulSet: { color: 'purple', icon: 'Layers' },
  Namespace: { color: 'orange', icon: 'Folder' },
  Internet: { color: 'blue', icon: 'Globe' },
  Ingress: { color: 'rose', icon: 'Route' },
  HPA: { color: 'fuchsia', icon: 'Activity' },
  ResourceLimit: { color: 'purple', icon: 'Gauge' },
  PVC: { color: 'orange', icon: 'HardDrive' },
  ConfigMap: { color: 'amber', icon: 'FileText' },
  Secret: { color: 'red', icon: 'Lock' },
  Role: { color: 'indigo', icon: 'ShieldCheck' },
  IAM: { color: 'indigo', icon: 'ShieldCheck' },
  Worker: { color: 'orange', icon: 'Server' },
};

export const INITIAL_NODES = [];
export const INITIAL_EDGES = [];
