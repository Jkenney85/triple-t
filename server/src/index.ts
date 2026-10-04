import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootstrapAdmin, purgeExpiredSessions } from './auth';
import { buildApp } from './app';
import { openDb } from './db';
import { loadConfig } from './env';

const config = loadConfig();
if (!config.webDist) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const guess = path.resolve(here, '../../web/dist');
  if (fs.existsSync(guess)) config.webDist = guess;
}

const db = openDb(config.dbFile);
const { app } = await buildApp(db, config, {
  logger: true,
});

await bootstrapAdmin(db, config.adminUsername, config.adminPassword, app.log);
purgeExpiredSessions(db);
setInterval(() => purgeExpiredSessions(db), 6 * 60 * 60 * 1000).unref();

await app.listen({ port: config.port, host: config.host });
app.log.info(`Triple T running at ${config.publicUrl} (TZ ${config.tz}, data in ${config.dataDir})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    db.$client.close();
    process.exit(0);
  });
}
