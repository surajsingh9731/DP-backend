import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export interface RuntimeConfig {
  mode: 'local';
  host: string;
  apiPort: number;
  webOrigin: string;
  appUrl: string;
  workerUrl: string;
  adminUrl: string;
  authPepper: string;
  mailTransport: 'database-sink';
  pollMs: number;
}
export function loadConfig(): RuntimeConfig {
  const selected = process.env['SAHMATI_RUNTIME'] ?? '.local/runtime.json';
  if (!['.local/runtime.json', '.local/test-runtime.json'].includes(selected))
    throw new Error('Unsupported runtime config path');
  const config = JSON.parse(
    readFileSync(resolve(process.cwd(), '..', selected), 'utf8'),
  ) as RuntimeConfig;
  if (
    config.mode !== 'local' ||
    config.host !== '127.0.0.1' ||
    config.mailTransport !== 'database-sink'
  )
    throw new Error(
      'Only isolated local mode and database-sink transport are supported in this increment',
    );
  for (const key of ['appUrl', 'workerUrl', 'adminUrl'] as const) {
    const url = new URL(config[key]);
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '55432' ||
      !['/sahmati_local', '/sahmati_test'].includes(url.pathname)
    )
      throw new Error('Database must be the isolated local project database');
  }
  if (
    !/^[a-f0-9]{64}$/.test(config.authPepper) ||
    !Number.isInteger(config.apiPort) ||
    config.apiPort < 1024 ||
    config.apiPort > 65535 ||
    config.pollMs < 100
  )
    throw new Error('Invalid local runtime configuration');
  if (config.webOrigin !== 'http://127.0.0.1:4200') throw new Error('Unapproved local web origin');
  return config;
}
