import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AVATAR_COLORS, isHexColor } from '@triple-t/shared';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  checkPasswordStrength,
  createSession,
  deleteSession,
  deleteUserSessions,
  hashPassword,
  requireUser,
  toPublicUser,
  verifyPassword,
} from '../auth';
import { parseBody, type Ctx } from '../ctx';
import { users } from '../db/schema';
import { HttpError } from '../errors';

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_USERNAME = 10;

export async function authRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, config } = ctx;
  /** Failed attempts per username, so spreading guesses across IPs still gets throttled. */
  const failures = new Map<string, { count: number; first: number }>();

  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.secureCookies,
    signed: true,
  };

  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const body = parseBody(z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(256) }), req.body);
      const key = body.username.trim().toLowerCase();
      const now = Date.now();
      const f = failures.get(key);
      if (f && now - f.first < FAILURE_WINDOW_MS && f.count >= MAX_FAILURES_PER_USERNAME) {
        throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.');
      }

      const user = db
        .select()
        .from(users)
        .where(eq(sql`lower(${users.username})`, key))
        .get();
      const ok = await verifyPassword(user?.passwordHash, body.password);
      if (!user || !ok || !user.isActive) {
        if (!f || now - f.first >= FAILURE_WINDOW_MS) failures.set(key, { count: 1, first: now });
        else f.count++;
        throw new HttpError(401, 'Incorrect username or password');
      }
      failures.delete(key);

      const token = createSession(db, user.id);
      reply.setCookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_MS / 1000 });
      return { user: toPublicUser(user) };
    },
  );

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.sessionToken) deleteSession(db, req.sessionToken);
    reply.clearCookie(SESSION_COOKIE, cookieOptions);
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireUser }, async (req) => ({
    user: toPublicUser(req.user!),
    config: { tz: config.tz },
  }));

  app.patch('/api/me', { preHandler: requireUser }, async (req) => {
    const body = parseBody(
      z.object({
        displayName: z.string().trim().min(1, 'Display name is required').max(60).optional(),
        avatarColor: z.string().refine((c) => isHexColor(c), 'Pick a color').optional(),
      }),
      req.body,
    );
    db.update(users)
      .set({ ...body, updatedAt: Date.now() })
      .where(eq(users.id, req.user!.id))
      .run();
    ctx.rt.emitUsersChanged();
    const user = db.select().from(users).where(eq(users.id, req.user!.id)).get()!;
    return { user: toPublicUser(user) };
  });

  app.post(
    '/api/me/password',
    { preHandler: requireUser, config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req) => {
      const body = parseBody(z.object({ currentPassword: z.string(), newPassword: z.string() }), req.body);
      if (!(await verifyPassword(req.user!.passwordHash, body.currentPassword))) {
        throw new HttpError(400, 'Current password is incorrect');
      }
      const next = checkPasswordStrength(body.newPassword);
      db.update(users)
        .set({ passwordHash: await hashPassword(next), updatedAt: Date.now() })
        .where(eq(users.id, req.user!.id))
        .run();
      deleteUserSessions(db, req.user!.id, req.sessionToken ?? undefined);
      return { ok: true };
    },
  );

  app.get('/api/users', { preHandler: requireUser }, async () => ({
    users: db.select().from(users).all().map(toPublicUser),
    avatarColors: AVATAR_COLORS,
  }));
}
