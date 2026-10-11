import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { sql } from 'drizzle-orm';
import { readSessionToken, userForToken } from './auth';
import type { Ctx } from './ctx';
import type { DB } from './db';
import type { Config } from './env';
import { HttpError } from './errors';
import { createRealtime, noopRealtime, type Realtime } from './realtime';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { boardRoutes } from './routes/boards';
import { cardRoutes } from './routes/cards';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function buildApp(db: DB, config: Config, opts: { realtime?: boolean; logger?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logger ?? false,
    // Traefik sits in front of us; trust its X-Forwarded-* so rate limits see the real client IP.
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(rateLimit, { global: false });
  await app.register(multipart);

  const publicHost = new URL(config.publicUrl).host;
  const rt: Realtime = opts.realtime === false ? noopRealtime() : createRealtime(app, db, config.buildId);
  const ctx: Ctx = { db, config, rt };

  app.decorateRequest('user', null);
  app.decorateRequest('sessionToken', null);

  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    // CSRF defence alongside SameSite=Lax: cross-site browsers send an Origin we can compare.
    if (!SAFE_METHODS.has(req.method)) {
      const origin = req.headers.origin;
      if (origin) {
        let host: string | null = null;
        try {
          host = new URL(origin).host;
        } catch {
          // fall through to the rejection below
        }
        if (host !== req.host && host !== publicHost) throw new HttpError(403, 'Cross-origin request blocked');
      }
    }
    const token = readSessionToken(req);
    if (token) {
      req.sessionToken = token;
      req.user = userForToken(db, token);
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.status).send({ error: err.message, ...err.details });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: (err as Error).message });
    req.log.error(err);
    return reply.code(500).send({ error: 'Something went wrong' });
  });

  app.get('/healthz', async () => {
    db.get(sql`select 1`);
    return { status: 'ok', build: config.buildId ?? null };
  });

  await app.register(async (api) => authRoutes(api, ctx));
  await app.register(async (api) => adminRoutes(api, ctx));
  await app.register(async (api) => boardRoutes(api, ctx));
  await app.register(async (api) => cardRoutes(api, ctx));

  if (config.webDist && fs.existsSync(path.join(config.webDist, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: config.webDist,
      wildcard: false,
      index: false,
      setHeaders(res, filePath) {
        const rel = path.relative(config.webDist!, filePath);
        if (rel.startsWith('assets')) res.header('cache-control', 'public, max-age=31536000, immutable');
        else res.header('cache-control', 'no-cache');
      },
    });
    app.get('/*', (req, reply) => {
      const file = (req.params as { '*': string })['*'];
      if (file && fs.existsSync(path.join(config.webDist!, file)) && !file.includes('..')) {
        return reply.sendFile(file);
      }
      if (/\.[a-z0-9]+$/i.test(file)) return reply.code(404).send({ error: 'Not found' });
      reply.header('cache-control', 'no-cache');
      return reply.sendFile('index.html');
    });
  }

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'Not found' }));

  return { app: app as FastifyInstance, ctx };
}
