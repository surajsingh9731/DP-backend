import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createApp } from './app.js';
async function main(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<number>('apiPort'), config.getOrThrow<string>('host'));
  new Logger('Bootstrap').log('Sahmati local API ready; external mail transport is absent.');
}
void main().catch(() => {
  new Logger('Bootstrap').error(
    'Local API startup failed. Check local configuration and database readiness.',
  );
  process.exitCode = 1;
});
