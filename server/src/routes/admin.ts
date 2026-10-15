import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  checkPasswordStrength,
  deleteUserSessions,
  hashPassword,
  randomAvatarColor,
  requireAdmin,
  toPublicUser,
} from '../auth';
import { idParam, parseBody, type Ctx } from '../ctx';
import * as s from '../db/schema';
import { badRequest, HttpError, notFound } from '../errors';

export async function adminRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  app.get('/api/admin/users', { preHandler: requireAdmin }, async () => ({
    users: db.select().from(s.users).all().map(toPublicUser),
  }));

  app.post('/api/admin/users', { preHandler: requireAdmin }, async (req) => {
    const body = parseBody(
      z.object({
        username: z
          .string()
          .trim()
          .min(2, 'Username must be at least 2 characters')
          .max(40)
          .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only use letters, numbers, dots, dashes and underscores'),
        displayName: z.string().trim().max(60).optional(),
        password: z.string(),
        isAdmin: z.boolean().optional(),
      }),
      req.body,
    );
    const exists = db
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(sql`lower(${s.users.username})`, body.username.toLowerCase()))
      .get();
    if (exists) throw badRequest('That username is taken');
    const password = checkPasswordStrength(body.password);
    const user = db
      .insert(s.users)
      .values({
        username: body.username,
        displayName: body.displayName || body.username,
        passwordHash: await hashPassword(password),
        avatarColor: randomAvatarColor(),
        isAdmin: body.isAdmin ?? false,
      })
      .returning()
      .get();
    ctx.rt.emitUsersChanged();
    return { user: toPublicUser(user) };
  });

  app.patch('/api/admin/users/:id', { preHandler: requireAdmin }, async (req) => {
    const id = idParam(req);
    const body = parseBody(
      z.object({
        displayName: z.string().trim().min(1).max(60).optional(),
        isAdmin: z.boolean().optional(),
        isActive: z.boolean().optional(),
        password: z.string().optional(),
      }),
      req.body,
    );
    const target = db.select().from(s.users).where(eq(s.users.id, id)).get();
    if (!target) throw notFound('User not found');
    if (id === req.user!.id && (body.isActive === false || body.isAdmin === false)) {
      throw new HttpError(400, "You can't deactivate or demote yourself");
    }

    const update: Partial<typeof s.users.$inferInsert> = { updatedAt: Date.now() };
    if (body.displayName !== undefined) update.displayName = body.displayName;
    if (body.isAdmin !== undefined) update.isAdmin = body.isAdmin;
    if (body.isActive !== undefined) update.isActive = body.isActive;
    if (body.password !== undefined) update.passwordHash = await hashPassword(checkPasswordStrength(body.password));
    db.update(s.users).set(update).where(eq(s.users.id, id)).run();

    if (body.isActive === false || body.password !== undefined) {
      deleteUserSessions(db, id);
      ctx.rt.disconnectUser(id);
    }
    ctx.rt.emitUsersChanged();
    return { user: toPublicUser(db.select().from(s.users).where(eq(s.users.id, id)).get()!) };
  });

  app.get('/api/admin/export', { preHandler: requireAdmin }, async (_req, reply) => {
    const data = {
      app: 'triple-t',
      exportedAt: new Date().toISOString(),
      users: db.select().from(s.users).all().map(toPublicUser),
      boards: db.select().from(s.boards).all(),
      columns: db.select().from(s.columns).all(),
      labels: db.select().from(s.labels).all(),
      fields: db.select().from(s.fields).all(),
      cards: db.select().from(s.cards).all(),
      cardLabels: db.select().from(s.cardLabels).all(),
      comments: db.select().from(s.comments).all(),
      videos: db.select().from(s.videos).all(),
      videoValues: db.select().from(s.videoValues).all(),
      bannerPresets: db.select().from(s.bannerPresets).all(),
    };
    const stamp = new Date().toISOString().slice(0, 10);
    reply.header('content-disposition', `attachment; filename="triple-t-export-${stamp}.json"`);
    return data;
  });
}
