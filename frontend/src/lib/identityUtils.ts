import { K8sDigitalCertificate, KubeIAMUser } from '../types';

/**
 * Generates a formatted random hex serial number string (e.g., "7F:3A:91:02:4B:88:E1:90").
 */
export function generateHexSerial(): string {
  const uuidHex = crypto.randomUUID().replaceAll('-', '').substring(0, 16).toUpperCase();
  const parts: string[] = [];
  for (let i = 0; i < uuidHex.length; i += 2) {
    parts.push(uuidHex.substring(i, i + 2));
  }
  return parts.join(':');
}

/**
 * Generates a mock x509 digital certificate or service account token passport for a given identity username.
 *
 * @param username The identity name (e.g., 'system:admin', 'budi', 'dev-user')
 * @param userObj Optional KubeIAMUser object if available
 * @returns K8sDigitalCertificate details object
 */
export function generateDigitalCertificate(username: string, userObj?: KubeIAMUser): K8sDigitalCertificate {
  const cleanName = username.trim() || 'system:admin';
  const isAdmin = cleanName === 'system:admin' || cleanName === 'kubernetes-admin';

  if (isAdmin) {
    return {
      user: 'system:admin',
      subject: 'CN=kubernetes-admin, O=system:masters',
      issuer: 'CN=kubernetes-ca, O=Kubernetes Cluster CA',
      serialNumber: generateHexSerial(),
      validFrom: '2024-01-01T00:00:00Z',
      validTo: '2034-01-01T00:00:00Z',
      authType: 'X.509 Certificate',
      tokenSignature: 'sha256/RSA-4096 [SIGNED BY CLUSTER CA]',
      fingerprint: 'E3:91:20:FA:8B:11:43:89:C0:00:12:9A:FF:76:D2:18',
      status: 'VERIFIED & VALID',
    };
  }

  const isManaged = userObj?.accessType === 'Managed Access';
  const authType = isManaged ? 'Bearer Token' : 'X.509 Certificate';
  const groupOrg = isManaged ? 'O=kube-sim-developers' : 'O=kube-sim-users';

  return {
    user: cleanName,
    subject: `CN=${cleanName}, ${groupOrg}`,
    issuer: 'CN=kubernetes-ca, O=Kubernetes Cluster CA',
    serialNumber: `4A:${cleanName.length}B:88:19:${cleanName.substring(0, 2).toUpperCase()}:00`,
    validFrom: userObj ? new Date(userObj.createdAt).toISOString() : '2024-01-01T00:00:00Z',
    validTo: '2026-01-01T00:00:00Z',
    authType,
    tokenSignature: `sha256/${authType === 'Bearer Token' ? 'JWT-HS256' : 'RSA-2048'} [SIGNED BY CLUSTER CA]`,
    fingerprint: `A1:88:${cleanName.length}2:FF:90:34:11:00:22:78:AB:CD:EF:00`,
    status: 'VERIFIED & VALID',
  };
}
