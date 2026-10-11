import path from 'node:path';

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  dbFile: string;
  thumbsDir: string;
  backgroundsDir: string;
  publicUrl: string;
  sessionSecret: string;
  adminUsername?: string;
  adminPassword?: string;
  tz: string;
  isProd: boolean;
  /** Built frontend to serve, if present. */
  webDist?: string;
  secureCookies: boolean;
  /** Id of the built frontend (from web/dist/version.json), announced to clients so stale tabs can update. */
  buildId?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const isProd = env.NODE_ENV === 'production';
  const dataDir = path.resolve(env.DATA_DIR ?? (isProd ? '/data' : './data-dev'));
  const publicUrl = (env.PUBLIC_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

  let sessionSecret = env.SESSION_SECRET ?? '';
  if (sessionSecret.length < 32) {
    if (isProd) throw new Error('SESSION_SECRET must be set to at least 32 random characters');
    sessionSecret = 'dev-only-session-secret-change-me-0123456789';
  }

  const tz = env.TZ || 'America/Chicago';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    throw new Error(`TZ "${tz}" is not a valid IANA time zone`);
  }

  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    dataDir,
    dbFile: path.join(dataDir, 'triple-t.db'),
    thumbsDir: path.join(dataDir, 'thumbnails'),
    backgroundsDir: path.join(dataDir, 'backgrounds'),
    publicUrl,
    sessionSecret,
    adminUsername: env.ADMIN_USERNAME || undefined,
    adminPassword: env.ADMIN_PASSWORD || undefined,
    tz,
    isProd,
    webDist: env.WEB_DIST ? path.resolve(env.WEB_DIST) : undefined,
    secureCookies: publicUrl.startsWith('https://'),
  };
}
