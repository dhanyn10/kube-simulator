import { describe, it, expect } from 'vitest';
import { getConnectionError } from '../../src/constants/connections';

describe('connections constants', () => {
  it('should return null for valid connections', () => {
    expect(getConnectionError('Internet', 'Ingress')).toBeNull();
    expect(getConnectionError('Service', 'Pod')).toBeNull();
    expect(getConnectionError('Deployment', 'PVC')).toBeNull();
  });

  it('should return error message for invalid connections', () => {
    const error = getConnectionError('Internet', 'Namespace');
    expect(error).toBe('Internet cannot be connected to Namespace.');
  });

  it('should return error for unrecognized source type', () => {
    const error = getConnectionError('Unknown', 'Pod');
    expect(error).toBe('Source type Unknown is not recognized.');
  });
});
