import { LOCAL_WEB_HOST_ALIAS } from '../constants/local.constants.js';

/** Keep the configured origin authoritative; local mode additionally accepts its loopback alias. */
export function allowedWebOrigin(
  origin: string | undefined,
  configuredOrigin: string,
  mode: string,
): boolean {
  if (!origin || origin === configuredOrigin) return true;
  if (mode !== 'local') return false;
  const alias = new URL(configuredOrigin);
  if (alias.protocol !== 'http:' || alias.hostname !== '127.0.0.1') return false;
  alias.hostname = LOCAL_WEB_HOST_ALIAS;
  return origin === alias.origin;
}
