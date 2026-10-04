import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import type { Patch } from '@triple-t/shared';
import type { DB } from './db';
import type { Config } from './env';
import { badRequest } from './errors';
import type { Realtime } from './realtime';

export interface Ctx {
  db: DB;
  config: Config;
  rt: Realtime;
}

/** Broadcasts a patch to other viewers of the board and returns it as the response body. */
export function commit(ctx: Ctx, req: FastifyRequest, patch: Patch): Patch {
  const socketId = req.headers['x-socket-id'];
  ctx.rt.emitPatch(patch, typeof socketId === 'string' ? socketId : undefined);
  return patch;
}

export function idParam(req: FastifyRequest, name = 'id'): number {
  const raw = (req.params as Record<string, string>)[name];
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`Invalid ${name}`);
  return id;
}

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) errors[issue.path.join('.') || 'body'] ??= issue.message;
    throw badRequest(Object.values(errors)[0] ?? 'Invalid request', { errors });
  }
  return result.data;
}

export const userId = (req: FastifyRequest) => req.user!.id;
