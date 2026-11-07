import { IBackendGateway } from './IBackendGateway';
import { WailsBackendGateway } from './WailsBackendGateway';

export * from './IBackendGateway';
export * from './WailsBackendGateway';
export * from './MockBackendGateway';

let activeGateway: IBackendGateway = new WailsBackendGateway();

/**
 * Returns the currently active IBackendGateway instance.
 */
export function getBackendGateway(): IBackendGateway {
  return activeGateway;
}

/**
 * Replaces the active IBackendGateway instance (e.g. with a MockBackendGateway in tests).
 */
export function setBackendGateway(gateway: IBackendGateway): void {
  activeGateway = gateway;
}

/**
 * Resets the backend gateway back to the default WailsBackendGateway.
 */
export function resetBackendGateway(): void {
  activeGateway = new WailsBackendGateway();
}
