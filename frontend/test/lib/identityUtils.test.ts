import { describe, it, expect } from 'vitest';
import { generateDigitalCertificate } from '../../src/lib/identityUtils';
import { KubeIAMUser } from '../../src/types';

describe('identityUtils', () => {
  it('generates system:admin certificate correctly', () => {
    const cert = generateDigitalCertificate('system:admin');

    expect(cert.user).toBe('system:admin');
    expect(cert.subject).toBe('CN=kubernetes-admin, O=system:masters');
    expect(cert.status).toBe('VERIFIED & VALID');
    expect(cert.authType).toBe('X.509 Certificate');
  });

  it('generates certificate for standard IAM user with Managed Access', () => {
    const mockUser: KubeIAMUser = {
      id: 'user-1',
      username: 'budi',
      accessType: 'Managed Access',
      policies: [{ name: 'ReadOnlyAccess', type: 'Default', description: 'Read only' }],
      createdAt: 1700000000000,
    };

    const cert = generateDigitalCertificate('budi', mockUser);

    expect(cert.user).toBe('budi');
    expect(cert.subject).toBe('CN=budi, O=kube-sim-developers');
    expect(cert.authType).toBe('Bearer Token');
    expect(cert.status).toBe('VERIFIED & VALID');
  });

  it('generates certificate for user with Full Access', () => {
    const mockUser: KubeIAMUser = {
      id: 'user-2',
      username: 'admin-dev',
      accessType: 'Full Access',
      policies: [{ name: 'AdministratorAccess', type: 'Default', description: 'Full access' }],
      createdAt: 1700000000000,
    };

    const cert = generateDigitalCertificate('admin-dev', mockUser);

    expect(cert.user).toBe('admin-dev');
    expect(cert.subject).toBe('CN=admin-dev, O=kube-sim-users');
    expect(cert.authType).toBe('X.509 Certificate');
  });
});
