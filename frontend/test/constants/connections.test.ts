import { describe, it, expect } from 'vitest';
import { getConnectionError } from '@/constants/connections';

describe('connections constants', () => {
  it('should return null for valid connections', () => {
    expect(getConnectionError('Internet', 'Ingress')).toBeNull();
    expect(getConnectionError('Internet', 'Service')).toBeNull();
    expect(getConnectionError('Service', 'Pod')).toBeNull();
    expect(getConnectionError('Service', 'Pod', { serviceType: 'ClusterIP' })).toBeNull();
    expect(getConnectionError('Service', 'Pod', { serviceType: 'NodePort' })).toBeNull();
    expect(getConnectionError('Deployment', 'PVC')).toBeNull();
    expect(getConnectionError('Pod', 'Service')).toBeNull();
  });

  it('should return error message for invalid connections', () => {
    const error = getConnectionError('Internet', 'Namespace');
    expect(error).toBe('Internet cannot be connected to Namespace.');
  });

  it('should return error when connecting Internet directly to Pod, Deployment, or ReplicaSet', () => {
    expect(getConnectionError('Internet', 'Pod')).toBe('Internet cannot be connected to Pod.');
    expect(getConnectionError('Internet', 'Deployment')).toBe('Internet cannot be connected to Deployment.');
    expect(getConnectionError('Internet', 'ReplicaSet')).toBe('Internet cannot be connected to ReplicaSet.');
  });

  it('should return error when connecting Pod, Deployment, or ReplicaSet directly to another Pod or Deployment', () => {
    expect(getConnectionError('Pod', 'Pod')).toBe('Pod cannot be connected to Pod.');
    expect(getConnectionError('Pod', 'Deployment')).toBe('Pod cannot be connected to Deployment.');
    expect(getConnectionError('Deployment', 'Deployment')).toBe('Deployment cannot be connected to Deployment.');
    expect(getConnectionError('Deployment', 'Pod')).toBe('Deployment cannot be connected to Pod.');
  });

  it('should return error when connecting LoadBalancer Service directly to Pod, Deployment, or ReplicaSet', () => {
    const error = getConnectionError('Service', 'Pod', { serviceType: 'LoadBalancer' });
    expect(error).toBe('Service type "LoadBalancer" is not allowed to connect to Pod. Only ClusterIP or NodePort Services are permitted.');
  });

  it('should return error for unrecognized source type', () => {
    const error = getConnectionError('Unknown', 'Pod');
    expect(error).toBe('Source type Unknown is not recognized.');
  });
});
