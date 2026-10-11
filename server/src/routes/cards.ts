import fs from 'node:fs';
import path from 'node:path';
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  LIMITS,
  POSITION_GAP,
  appendPosition,
  dayForColumn,
  dayRank,
  isMonth,
  isTikTokUrl,
  sortCards,
  validateCardInput,
  validateFieldValue,
  type CardInput,
  type SearchResult,
} from '@triple-t/shared';
import { requireUser } from '../auth';
import { commit, idParam, parseBody, type Ctx } from '../ctx';
import type { DB } from '../db';
import * as s from '../db/schema';
import { badRequest, forbidden, HttpError, notFound } from '../errors';
import { getBoard, getCardRow, getColumn, loadCard, loadCards, loadVideo, loadVideos, toComment } from '../serialize';
import { THUMB_FILE, fetchVideoMetadata } from '../services/tiktok';

function assertValid<T>(result: { ok: true; value: T } | { ok: false; errors: Record<string, string> }): T {
  if (!result.ok) throw badRequest(Object.values(result.errors)[0], { errors: result.errors });
  return result.value;
}

function activeCardsInColumn(db: DB, columnId: number, exceptId?: number) {
  return sortCards(
    loadCards(db, and(eq(s.cards.columnId, columnId), isNull(s.cards.archivedAt))).filter((c) => c.id !== exceptId),
  );
}

function assertLabelsOnBoard(db: DB, boardId: number, labelIds: number[] | undefined) {
  if (!labelIds?.length) return;
  const found = db
    .select({ id: s.labels.id })
    .from(s.labels)
    .where(and(eq(s.labels.boardId, boardId), inArray(s.labels.id, labelIds)))
    .all();
  if (found.length !== labelIds.length) throw badRequest('One or more labels are not on this board');
}

function setLabels(db: DB, cardId: number, labelIds: number[]) {
  db.delete(s.cardLabels).where(eq(s.cardLabels.cardId, cardId)).run();
  for (const labelId of labelIds) db.insert(s.cardLabels).values({ cardId, labelId }).run();
}

/**
 * Renumbers a column's positions when neighbours in a day group get too close
 * after repeated midpoint inserts. Returns the cards it changed.
 */
export function rebalanceIfNeeded(db: DB, columnId: number) {
  const cards = activeCardsInColumn(db, columnId);
  const crowded = cards.some(
    (c, i) =>
      i > 0 && dayRank(cards[i - 1].dayOfWeek) === dayRank(c.dayOfWeek) && Math.abs(c.position - cards[i - 1].position) < 1e-6,
  );
  if (!crowded) return [];
  db.transaction((tx) => {
    cards.forEach((c, i) =>
      tx
        .update(s.cards)
        .set({ position: (i + 1) * POSITION_GAP })
        .where(eq(s.cards.id, c.id))
        .run(),
    );
  });
  return loadCards(db, inArray(
    s.cards.id,
    cards.map((c) => c.id),
  ));
}

/** Server-side move. Moving into the Done column always clears the card's day of week. */
export function moveCard(db: DB, cardId: number, columnId: number, position: number, userId: number) {
  const card = getCardRow(db, cardId);
  const column = getColumn(db, columnId);
  if (column.boardId !== card.boardId) throw badRequest('That list is on a different board');
  db.update(s.cards)
    .set({
      columnId,
      position,
      dayOfWeek: dayForColumn(card.dayOfWeek, column.isDone),
      updatedAt: Date.now(),
      updatedBy: userId,
    })
    .where(eq(s.cards.id, cardId))
    .run();
  const rebalanced = rebalanceIfNeeded(db, columnId);
  return rebalanced.length ? rebalanced : [loadCard(db, cardId)];
}

function likeEscape(q: string) {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

function snippet(text: string, q: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const i = flat.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return flat.slice(0, 120);
  const start = Math.max(0, i - 40);
  return (start > 0 ? '…' : '') + flat.slice(start, i + q.length + 80) + (i + q.length + 80 < flat.length ? '…' : '');
}

export async function cardRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, config, rt } = ctx;
  app.addHook('preHandler', requireUser);

  const touchBoard = (boardId: number) =>
    db.update(s.boards).set({ updatedAt: Date.now() }).where(eq(s.boards.id, boardId)).run();

  /** Fetches TikTok metadata in the background and broadcasts the result to everyone on the board. */
  function refreshVideo(videoId: number, boardId: number) {
    fetchVideoMetadata(db, config, videoId)
      .catch((err) => app.log.warn({ err, videoId }, 'video metadata fetch failed'))
      .finally(() => {
        try {
          rt.emitPatch({ boardId, videos: [loadVideo(db, videoId)] });
        } catch {
          // Video was deleted while fetching.
        }
      });
  }

  // ---- Cards ----

  app.post('/api/boards/:id/cards', async (req) => {
    const boardId = idParam(req);
    getBoard(db, boardId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input = assertValid(validateCardInput(body));
    const column = getColumn(db, Number(body.columnId));
    if (column.boardId !== boardId) throw badRequest('That list is on a different board');
    assertLabelsOnBoard(db, boardId, input.labelIds);

    const dayOfWeek = dayForColumn(input.dayOfWeek ?? null, column.isDone);
    const position = appendPosition(activeCardsInColumn(db, column.id), dayOfWeek);
    const now = Date.now();
    const card = db.transaction((tx) => {
      const row = tx
        .insert(s.cards)
        .values({
          boardId,
          columnId: column.id,
          title: input.title!,
          notes: input.notes ?? '',
          bannerColor: input.bannerColor ?? null,
          bannerText: input.bannerText ?? '',
          dayOfWeek,
          position,
          dueAt: input.dueAt ?? null,
          productUrl: input.productUrl ?? '',
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      setLabels(db, row.id, input.labelIds ?? []);
      return row;
    });
    touchBoard(boardId);
    return commit(ctx, req, { boardId, cards: [loadCard(db, card.id)] });
  });

  app.get('/api/cards/:id', async (req) => {
    const card = loadCard(db, idParam(req));
    return {
      card,
      videos: loadVideos(db, eq(s.videos.cardId, card.id)),
      comments: db.select().from(s.comments).where(eq(s.comments.cardId, card.id)).orderBy(asc(s.comments.createdAt)).all(),
    };
  });

  app.patch('/api/cards/:id', async (req) => {
    const id = idParam(req);
    const existing = getCardRow(db, id);
    const input: CardInput = assertValid(validateCardInput(req.body, { partial: true }));
    assertLabelsOnBoard(db, existing.boardId, input.labelIds);
    const { labelIds, ...fields } = input;

    if (fields.dayOfWeek !== undefined) {
      const column = getColumn(db, existing.columnId);
      fields.dayOfWeek = dayForColumn(fields.dayOfWeek, column.isDone);
    }
    const update: Partial<typeof s.cards.$inferInsert> = { ...fields, updatedAt: Date.now(), updatedBy: req.user!.id };
    // A new day sends the card to the bottom of that day's group.
    if (fields.dayOfWeek !== undefined && fields.dayOfWeek !== existing.dayOfWeek) {
      update.position = appendPosition(activeCardsInColumn(db, existing.columnId, id), fields.dayOfWeek);
    }
    db.transaction(() => {
      db.update(s.cards).set(update).where(eq(s.cards.id, id)).run();
      if (labelIds) setLabels(db, id, labelIds);
    });
    touchBoard(existing.boardId);
    return commit(ctx, req, { boardId: existing.boardId, cards: [loadCard(db, id)] });
  });

  app.post('/api/cards/:id/move', async (req) => {
    const id = idParam(req);
    const body = parseBody(z.object({ columnId: z.number().int(), position: z.number().finite() }), req.body);
    const existing = getCardRow(db, id);
    if (existing.archivedAt) throw badRequest('Restore this card before moving it');
    const cards = moveCard(db, id, body.columnId, body.position, req.user!.id);
    touchBoard(existing.boardId);
    return commit(ctx, req, { boardId: existing.boardId, cards });
  });

  app.post('/api/cards/:id/archive', async (req) => {
    const id = idParam(req);
    const card = getCardRow(db, id);
    db.update(s.cards)
      .set({ archivedAt: Date.now(), updatedAt: Date.now(), updatedBy: req.user!.id })
      .where(eq(s.cards.id, id))
      .run();
    const videoIds = db.select({ id: s.videos.id }).from(s.videos).where(eq(s.videos.cardId, id)).all().map((v) => v.id);
    const commentIds = db.select({ id: s.comments.id }).from(s.comments).where(eq(s.comments.cardId, id)).all().map((c) => c.id);
    touchBoard(card.boardId);
    return commit(ctx, req, {
      boardId: card.boardId,
      removed: { cards: [id], videos: videoIds, comments: commentIds },
      archivedChanged: true,
    });
  });

  app.post('/api/cards/:id/restore', async (req) => {
    const id = idParam(req);
    const existing = getCardRow(db, id);
    const column = getColumn(db, existing.columnId);
    db.update(s.cards)
      .set({
        archivedAt: null,
        dayOfWeek: dayForColumn(existing.dayOfWeek, column.isDone),
        updatedAt: Date.now(),
        updatedBy: req.user!.id,
      })
      .where(eq(s.cards.id, id))
      .run();
    touchBoard(existing.boardId);
    return commit(ctx, req, {
      boardId: existing.boardId,
      cards: [loadCard(db, id)],
      videos: loadVideos(db, eq(s.videos.cardId, id)),
      comments: db.select().from(s.comments).where(eq(s.comments.cardId, id)).all().map(toComment),
      archivedChanged: true,
    });
  });

  /** Permanent delete, only for archived cards. */
  app.delete('/api/cards/:id', async (req) => {
    const id = idParam(req);
    const card = getCardRow(db, id);
    if (!card.archivedAt) throw badRequest('Archive the card before deleting it');
    const thumbs = db
      .select({ file: s.videos.thumbnailFile })
      .from(s.videos)
      .where(and(eq(s.videos.cardId, id), isNotNull(s.videos.thumbnailFile)))
      .all();
    db.delete(s.cards).where(eq(s.cards.id, id)).run();
    for (const t of thumbs) fs.rm(path.join(config.thumbsDir, t.file!), { force: true }, () => {});
    return commit(ctx, req, { boardId: card.boardId, archivedChanged: true });
  });

  app.get('/api/boards/:id/archived', async (req) => {
    const boardId = idParam(req);
    getBoard(db, boardId);
    const cards = loadCards(db, and(eq(s.cards.boardId, boardId), isNotNull(s.cards.archivedAt)));
    cards.sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
    return { cards };
  });

  // ---- Comments ----

  const commentBody = z.object({
    body: z.string().trim().min(1, 'Comment is empty').max(LIMITS.comment),
  });

  app.post('/api/videos/:id/comments', async (req) => {
    const videoId = idParam(req);
    const video = db.select().from(s.videos).where(eq(s.videos.id, videoId)).get();
    if (!video) throw notFound('Video not found');
    const card = getCardRow(db, video.cardId);
    const { body } = parseBody(commentBody, req.body);
    const comment = db.insert(s.comments).values({ cardId: card.id, videoId, userId: req.user!.id, body }).returning().get();
    return commit(ctx, req, { boardId: card.boardId, comments: [toComment(comment)] });
  });

  function ownComment(id: number, userId: number) {
    const comment = db.select().from(s.comments).where(eq(s.comments.id, id)).get();
    if (!comment) throw notFound('Comment not found');
    if (comment.userId !== userId) throw forbidden('You can only change your own comments');
    return { comment, card: getCardRow(db, comment.cardId) };
  }

  app.patch('/api/comments/:id', async (req) => {
    const id = idParam(req);
    const { card } = ownComment(id, req.user!.id);
    const { body } = parseBody(commentBody, req.body);
    const comment = db.update(s.comments).set({ body, updatedAt: Date.now() }).where(eq(s.comments.id, id)).returning().get();
    return commit(ctx, req, { boardId: card.boardId, comments: [toComment(comment)] });
  });

  app.delete('/api/comments/:id', async (req) => {
    const id = idParam(req);
    const { card } = ownComment(id, req.user!.id);
    db.delete(s.comments).where(eq(s.comments.id, id)).run();
    return commit(ctx, req, { boardId: card.boardId, removed: { comments: [id] } });
  });

  // ---- Videos ----

  app.post('/api/cards/:id/videos', async (req) => {
    const cardId = idParam(req);
    const card = getCardRow(db, cardId);
    const { url } = parseBody(z.object({ url: z.string().trim().max(LIMITS.url) }), req.body);
    if (!isTikTokUrl(url)) throw badRequest('Enter a TikTok video link (tiktok.com or vm.tiktok.com)');
    const max = db
      .select({ max: sql<number | null>`max(${s.videos.position})` })
      .from(s.videos)
      .where(eq(s.videos.cardId, cardId))
      .get()?.max;
    const video = db
      .insert(s.videos)
      .values({ cardId, url, position: (max ?? 0) + POSITION_GAP, createdBy: req.user!.id })
      .returning()
      .get();
    db.update(s.cards).set({ updatedAt: Date.now(), updatedBy: req.user!.id }).where(eq(s.cards.id, cardId)).run();
    const patch = commit(ctx, req, { boardId: card.boardId, videos: [loadVideo(db, video.id)], cards: [loadCard(db, cardId)] });
    refreshVideo(video.id, card.boardId);
    return patch;
  });

  function videoWithCard(id: number) {
    const video = db.select().from(s.videos).where(eq(s.videos.id, id)).get();
    if (!video) throw notFound('Video not found');
    return { video, card: getCardRow(db, video.cardId) };
  }

  /** Updates metric values (fieldId -> raw string; empty string clears). */
  app.patch('/api/videos/:id', async (req) => {
    const id = idParam(req);
    const { card } = videoWithCard(id);
    const body = parseBody(
      z.object({
        month: z.string().refine((m) => isMonth(m), 'Month must look like 2026-10'),
        values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
      }),
      req.body,
    );
    const { month } = body;
    const boardFields = db.select().from(s.fields).where(eq(s.fields.boardId, card.boardId)).all();
    const cleaned: { fieldId: number; value: string }[] = [];
    for (const [key, raw] of Object.entries(body.values)) {
      const field = boardFields.find((f) => f.id === Number(key));
      if (!field) throw badRequest('Unknown field');
      const result = validateFieldValue(field.type, raw);
      if (!result.ok) throw badRequest(`${field.name}: ${result.errors.value}`);
      cleaned.push({ fieldId: field.id, value: result.value });
    }
    db.transaction((tx) => {
      for (const { fieldId, value } of cleaned) {
        if (value === '') {
          tx.delete(s.videoValues)
            .where(and(eq(s.videoValues.videoId, id), eq(s.videoValues.fieldId, fieldId), eq(s.videoValues.month, month)))
            .run();
        } else {
          tx.insert(s.videoValues)
            .values({ videoId: id, fieldId, month, value })
            .onConflictDoUpdate({ target: [s.videoValues.videoId, s.videoValues.fieldId, s.videoValues.month], set: { value } })
            .run();
        }
      }
      tx.update(s.videos).set({ updatedAt: Date.now() }).where(eq(s.videos.id, id)).run();
      tx.update(s.cards).set({ updatedAt: Date.now(), updatedBy: req.user!.id }).where(eq(s.cards.id, card.id)).run();
    });
    return commit(ctx, req, { boardId: card.boardId, videos: [loadVideo(db, id)], cards: [loadCard(db, card.id)] });
  });

  app.post('/api/videos/:id/refresh', async (req) => {
    const id = idParam(req);
    const { card } = videoWithCard(id);
    db.update(s.videos).set({ status: 'pending', error: null }).where(eq(s.videos.id, id)).run();
    const patch = commit(ctx, req, { boardId: card.boardId, videos: [loadVideo(db, id)] });
    refreshVideo(id, card.boardId);
    return patch;
  });

  app.delete('/api/videos/:id', async (req) => {
    const id = idParam(req);
    const { video, card } = videoWithCard(id);
    const commentIds = db.transaction((tx) => {
      const ids = tx
        .delete(s.comments)
        .where(eq(s.comments.videoId, id))
        .returning({ id: s.comments.id })
        .all()
        .map((c) => c.id);
      tx.delete(s.videos).where(eq(s.videos.id, id)).run();
      return ids;
    });
    db.update(s.cards).set({ updatedAt: Date.now(), updatedBy: req.user!.id }).where(eq(s.cards.id, card.id)).run();
    if (video.thumbnailFile) fs.rm(path.join(config.thumbsDir, video.thumbnailFile), { force: true }, () => {});
    return commit(ctx, req, {
      boardId: card.boardId,
      removed: { videos: [id], comments: commentIds },
      cards: [loadCard(db, card.id)],
    });
  });

  app.get('/api/thumbnails/:file', async (req, reply) => {
    const { file } = req.params as { file: string };
    if (!THUMB_FILE.test(file)) throw notFound();
    const full = path.join(config.thumbsDir, file);
    if (!fs.existsSync(full)) throw notFound();
    const ext = path.extname(file).slice(1);
    reply.header('content-type', ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
    reply.header('cache-control', 'private, max-age=31536000, immutable');
    reply.header('x-content-type-options', 'nosniff');
    return reply.send(fs.createReadStream(full));
  });

  // ---- Search across all boards ----

  app.get('/api/search', async (req) => {
    const q = String((req.query as { q?: string }).q ?? '').trim();
    if (q.length < 2) return { results: [] as SearchResult[] };
    if (q.length > 200) throw new HttpError(400, 'Search is too long');
    const like = likeEscape(q);
    const match = (col: unknown) => sql`${col} LIKE ${like} ESCAPE '\\'`;
    const commentHits = db
      .select({ cardId: s.comments.cardId, body: s.comments.body })
      .from(s.comments)
      .where(match(s.comments.body))
      .all();
    const commentByCard = new Map(commentHits.map((c) => [c.cardId, c.body]));
    const rows = db
      .select({ card: s.cards, boardName: s.boards.name, columnName: s.columns.name })
      .from(s.cards)
      .innerJoin(s.boards, eq(s.boards.id, s.cards.boardId))
      .innerJoin(s.columns, eq(s.columns.id, s.cards.columnId))
      .where(
        and(
          isNull(s.boards.archivedAt),
          isNull(s.cards.archivedAt),
          sql`(${match(s.cards.title)} OR ${match(s.cards.notes)} OR ${match(s.cards.bannerText)}${
            commentByCard.size ? sql` OR ${inArray(s.cards.id, [...commentByCard.keys()])}` : sql``
          })`,
        ),
      )
      .orderBy(desc(s.cards.updatedAt))
      .limit(30)
      .all();
    const results: SearchResult[] = rows.map(({ card, boardName, columnName }) => {
      const source = [card.title, card.bannerText, card.notes].find((t) => t.toLowerCase().includes(q.toLowerCase()));
      return {
        cardId: card.id,
        boardId: card.boardId,
        boardName,
        columnName,
        title: card.title,
        snippet: source && source !== card.title ? snippet(source, q) : commentByCard.has(card.id) ? `💬 ${snippet(commentByCard.get(card.id)!, q)}` : '',
        archived: false,
      };
    });
    return { results };
  });
}
