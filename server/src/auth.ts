import crypto from 'node:crypto';
import argon2 from 'argon2';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AVATAR_COLORS, type PublicUser } from '@triple-t/shared';
import type { DB } from './db';
import { sessions, users } from './db/schema';
import { HttpError } from './errors';

export const SESSION_COOKIE = 'ttt_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;

export type UserRow = typeof users.$inferSelect;

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarColor: u.avatarColor,
    isAdmin: u.isAdmin,
    isActive: u.isActive,
  };
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

// Verifying against a dummy hash when the user does not exist keeps response times uniform.
let dummyHash: Promise<string> | undefined;
export async function verifyPassword(hash: string | undefined, password: string): Promise<boolean> {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  try {
    return await argon2.verify(hash ?? (await dummyHash), password);
  } catch {
    return false;
  }
}

export function checkPasswordStrength(password: unknown): string {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > 256) throw new HttpError(400, 'Password is too long');
  return password;
}

export function randomAvatarColor(): string {
  return AVATAR_COLORS[crypto.randomInt(AVATAR_COLORS.length)];
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function createSession(db: DB, userId: number): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.insert(sessions).values({ id: hashToken(token), userId, createdAt: now, expiresAt: now + SESSION_TTL_MS }).run();
  return token;
}

export function deleteSession(db: DB, token: string): void {
  db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
}

export function deleteUserSessions(db: DB, userId: number, exceptToken?: string): void {
  const keep = exceptToken ? hashToken(exceptToken) : '';
  db.delete(sessions)
    .where(and(eq(sessions.userId, userId), sql`${sessions.id} != ${keep}`))
    .run();
}

/** Resolves a session token to an active user, sliding the expiry forward at most once a day. */
export function userForToken(db: DB, token: string): UserRow | null {
  const id = hashToken(token);
  const row = db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .get();
  const now = Date.now();
  if (!row || row.session.expiresAt < now || !row.user.isActive) return null;
  if (row.session.expiresAt - now < SESSION_TTL_MS - 24 * 60 * 60 * 1000) {
    db.update(sessions).set({ expiresAt: now + SESSION_TTL_MS }).where(eq(sessions.id, id)).run();
  }
  return row.user;
}

export function purgeExpiredSessions(db: DB): void {
  db.delete(sessions).where(lt(sessions.expiresAt, Date.now())).run();
}

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow | null;
    sessionToken: string | null;
  }
}

export function readSessionToken(req: FastifyRequest): string | null {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

export async function requireUser(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not signed in');
}

export async function requireAdmin(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Not signed in');
  if (!req.user.isAdmin) throw new HttpError(403, 'Admins only');
}

/** Creates the first admin from ADMIN_USERNAME / ADMIN_PASSWORD when the database has no users. */
export async function bootstrapAdmin(
  db: DB,
  username: string | undefined,
  password: string | undefined,
  log: { info: (m: string) => void },
): Promise<void> {
  const count = db.select({ n: sql<number>`count(*)` }).from(users).get()?.n ?? 0;
  if (count > 0) return;
  if (!username || !password) {
    throw new Error('No users exist yet: set ADMIN_USERNAME and ADMIN_PASSWORD to create the first admin');
  }
  checkPasswordStrength(password);
  db.insert(users)
    .values({
      username,
      displayName: username,
      passwordHash: await hashPassword(password),
      avatarColor: randomAvatarColor(),
      isAdmin: true,
    })
    .run();
  log.info(`Created admin user "${username}"`);
}
