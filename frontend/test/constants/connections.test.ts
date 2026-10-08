import { describe, it, expect } from 'vitest';
import { getConnectionError, VALID_CONNECTIONS } from '@/constants/connections';

describe('connections constants', () => {
  it('should return null for valid connections', () => {
    expect(getConnectionError('Internet', 'Service', {}, { serviceType: 'LoadBalancer' })).toBeNull();
    expect(getConnectionError('Internet', 'Service', {}, { serviceType: 'NodePort' })).toBeNull();
    expect(getConnectionError('Ingress', 'Service', {}, { serviceType: 'ClusterIP' })).toBeNull();
    expect(getConnectionError('Service', 'Pod')).toBeNull();
    expect(getConnectionError('Service', 'Pod', { serviceType: 'ClusterIP' })).toBeNull();
    expect(getConnectionError('Service', 'Pod', { serviceType: 'NodePort' })).toBeNull();
    expect(getConnectionError('Service', 'Pod', { serviceType: 'LoadBalancer' })).toBeNull();
    expect(getConnectionError('Service', 'Deployment', { serviceType: 'LoadBalancer' })).toBeNull();
    expect(getConnectionError('Pod', 'Ingress')).toBeNull();
    expect(getConnectionError('Deployment', 'Ingress')).toBeNull();
    expect(getConnectionError('Deployment', 'PVC')).toBeNull();
    expect(getConnectionError('Pod', 'Service')).toBeNull();
  });

  it('should return error message for invalid connections', () => {
    const error = getConnectionError('Internet', 'Namespace');
    expect(error).toBe('Internet cannot be connected to Namespace.');
  });

  it('should return error when connecting Internet directly to Ingress, ClusterIP Service, Pod, Deployment, or ReplicaSet', () => {
    expect(getConnectionError('Internet', 'Ingress')).toBe('Internet cannot be connected to Ingress.');
    expect(getConnectionError('Internet', 'Service', {}, { serviceType: 'ClusterIP' })).toBe(
      'Internet can only connect to LoadBalancer or NodePort Services. Cannot connect to ClusterIP Service.'
    );
    expect(getConnectionError('Internet', 'Pod')).toBe('Internet cannot be connected to Pod.');
    expect(getConnectionError('Internet', 'Deployment')).toBe('Internet cannot be connected to Deployment.');
    expect(getConnectionError('Internet', 'ReplicaSet')).toBe('Internet cannot be connected to ReplicaSet.');
  });

  it('should return null for valid Ingress incoming and outgoing connections', () => {
    // Service: LoadBalancer -> Ingress
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'LoadBalancer' })).toBeNull();
    // Service: NodePort -> Ingress
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'NodePort' })).toBeNull();
    // Pod / Deployment -> Ingress (Ingress Controller Pod)
    expect(getConnectionError('Pod', 'Ingress')).toBeNull();
    expect(getConnectionError('Deployment', 'Ingress')).toBeNull();
    // Ingress -> Service: ClusterIP
    expect(getConnectionError('Ingress', 'Service', {}, { serviceType: 'ClusterIP' })).toBeNull();
  });

  it('should return error for invalid incoming connections to Ingress', () => {
    // Internet -> Ingress
    expect(getConnectionError('Internet', 'Ingress')).toBe('Internet cannot be connected to Ingress.');

    // ClusterIP Service -> Ingress
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'ClusterIP' })).toBe(
      'ClusterIP Service cannot be connected to Ingress. Only LoadBalancer or NodePort Services can connect to Ingress.'
    );

    // PVC -> Ingress
    expect(getConnectionError('PVC', 'Ingress')).toBe('PVC cannot be connected to Ingress.');
  });

  it('should return error for invalid outgoing connections from Ingress', () => {
    // Ingress -> Service: NodePort / LoadBalancer
    expect(getConnectionError('Ingress', 'Service', {}, { serviceType: 'NodePort' })).toBe(
      'Ingress can only connect to ClusterIP Service. Cannot connect to NodePort Service.'
    );
    expect(getConnectionError('Ingress', 'Service', {}, { serviceType: 'LoadBalancer' })).toBe(
      'Ingress can only connect to ClusterIP Service. Cannot connect to LoadBalancer Service.'
    );

    // Ingress -> Pod / Deployment
    expect(getConnectionError('Ingress', 'Pod')).toBe('Ingress cannot be connected to Pod.');
    expect(getConnectionError('Ingress', 'Deployment')).toBe('Ingress cannot be connected to Deployment.');
  });

  it('should return error when connecting Pod, Deployment, or ReplicaSet directly to another Pod or Deployment', () => {
    expect(getConnectionError('Pod', 'Pod')).toBe('Pod cannot be connected to Pod.');
    expect(getConnectionError('Pod', 'Deployment')).toBe('Pod cannot be connected to Deployment.');
    expect(getConnectionError('Deployment', 'Deployment')).toBe('Deployment cannot be connected to Deployment.');
    expect(getConnectionError('Deployment', 'Pod')).toBe('Deployment cannot be connected to Pod.');
  });

  it('should return null for valid LoadBalancer incoming and outgoing connections', () => {
    // Internet -> Service: LoadBalancer
    expect(getConnectionError('Internet', 'Service', {}, { serviceType: 'LoadBalancer' })).toBeNull();

    // Service: LoadBalancer -> Ingress
    expect(getConnectionError('Service', 'Ingress', { serviceType: 'LoadBalancer' })).toBeNull();

    // Service: LoadBalancer -> Pod / Deployment (via spec.selector)
    expect(getConnectionError('Service', 'Pod', { serviceType: 'LoadBalancer' })).toBeNull();
    expect(getConnectionError('Service', 'Deployment', { serviceType: 'LoadBalancer' })).toBeNull();

    // Service: LoadBalancer -> Service: ClusterIP / NodePort
    expect(
      getConnectionError('Service', 'Service', { serviceType: 'LoadBalancer' }, { serviceType: 'ClusterIP' })
    ).toBeNull();
    expect(
      getConnectionError('Service', 'Service', { serviceType: 'LoadBalancer' }, { serviceType: 'NodePort' })
    ).toBeNull();
  });

  it('should return error for invalid incoming connections to LoadBalancer Service', () => {
    // ReplicaSet -> Service: LoadBalancer is forbidden (only Pod/Deployment/Internet/Service allowed)
    expect(getConnectionError('ReplicaSet', 'Service', {}, { serviceType: 'LoadBalancer' })).toBe(
      'ReplicaSet cannot be connected to LoadBalancer Service.'
    );

    // PVC / ConfigMap / Secret -> Service: LoadBalancer is forbidden
    expect(getConnectionError('PVC', 'Service', {}, { serviceType: 'LoadBalancer' })).toBe(
      'PVC cannot be connected to Service.'
    );
    expect(getConnectionError('ConfigMap', 'Service', {}, { serviceType: 'LoadBalancer' })).toBe(
      'ConfigMap cannot be connected to Service.'
    );
  });

  it('should return error when LoadBalancer Service connects to another LoadBalancer Service', () => {
    expect(
      getConnectionError('Service', 'Service', { serviceType: 'LoadBalancer' }, { serviceType: 'LoadBalancer' })
    ).toBe('LoadBalancer Service cannot connect to LoadBalancer Service.');
  });

  it('should return error for unrecognized source type', () => {
    const error = getConnectionError('Unknown', 'Pod');
    expect(error).toBe('Source type Unknown is not recognized.');
  });

  it('should return null when Ingress connects to Service with default ClusterIP targetData', () => {
    expect(getConnectionError('Ingress', 'Service')).toBeNull();
  });

  it('should evaluate checkIngressTargetRules fallback for non-workload source', () => {
    // Temporarily add Ingress to VALID_CONNECTIONS for Secret to test line 56
    const originalSecret = VALID_CONNECTIONS.Secret;
    (VALID_CONNECTIONS as any).Secret = ['Ingress'];

    const err = getConnectionError('Secret', 'Ingress');
    expect(err).toBe('Secret cannot be connected to Ingress. Only Services or Workloads can connect to Ingress.');

    // Cleanup
    (VALID_CONNECTIONS as any).Secret = originalSecret;
  });

  it('should evaluate checkIngressSourceRules fallback for non-Service target', () => {
    // Temporarily add Pod to VALID_CONNECTIONS for Ingress to test line 69
    (VALID_CONNECTIONS as any).Ingress = ['Service', 'Pod'];

    const err = getConnectionError('Ingress', 'Pod');
    expect(err).toBe('Ingress cannot be connected directly to Pod. Ingress routes traffic strictly through a ClusterIP Service (via backend.service.name).');

    // Cleanup
    (VALID_CONNECTIONS as any).Ingress = ['Service'];
  });
});
