import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  BOARD_THEMES,
  FIELD_TYPES,
  POSITION_GAP,
  appendPosition,
  defaultTotalMode,
  isHexColor,
  isNumericType,
  sortCards,
  type FieldType,
  type TotalMode,
} from '@triple-t/shared';
import { requireUser } from '../auth';
import { commit, idParam, parseBody, type Ctx } from '../ctx';
import type { DB } from '../db';
import * as s from '../db/schema';
import { badRequest, HttpError, notFound } from '../errors';
import { getBoard, getColumn, loadBoardState, loadCards, toBoard, toColumn, toField, toLabel } from '../serialize';

const boardColor = z
  .string()
  .refine((c) => isHexColor(c) || BOARD_THEMES.some((t) => t.id === c), 'Unknown board color');
const name = (what: string) => z.string().trim().min(1, `${what} is required`).max(80);
const labelColor = z.string().refine((c) => isHexColor(c), 'Pick a label color');
const fieldType = z.enum(FIELD_TYPES as [FieldType, ...FieldType[]]);
const totalMode = z.enum(['sum', 'avg', 'none']);

export const SEED_COLUMNS = [
  { name: 'To Do', isDone: false },
  { name: 'In Progress', isDone: false },
  { name: 'Done', isDone: true },
];

export const SEED_FIELDS: { name: string; type: FieldType; showOnFront: boolean }[] = [
  { name: 'Views', type: 'number', showOnFront: true },
  { name: 'CTR', type: 'percent', showOnFront: false },
  { name: 'Sales', type: 'number', showOnFront: true },
  { name: 'GMV', type: 'currency', showOnFront: true },
];

/** Totals only make sense for numeric fields. */
function effectiveTotalMode(type: FieldType, mode: TotalMode | undefined): TotalMode {
  if (!isNumericType(type)) return 'none';
  return mode ?? defaultTotalMode(type);
}

export function createBoard(db: DB, input: { name: string; color: string; createdBy: number | null }) {
  return db.transaction((tx) => {
    const board = tx.insert(s.boards).values(input).returning().get();
    SEED_COLUMNS.forEach((c, i) =>
      tx.insert(s.columns).values({ boardId: board.id, name: c.name, isDone: c.isDone, position: (i + 1) * POSITION_GAP }).run(),
    );
    SEED_FIELDS.forEach((f, i) =>
      tx
        .insert(s.fields)
        .values({ boardId: board.id, ...f, totalMode: defaultTotalMode(f.type), position: (i + 1) * POSITION_GAP })
        .run(),
    );
    return board;
  });
}

function activeCardsInColumn(db: DB, columnId: number) {
  return sortCards(loadCards(db, and(eq(s.cards.columnId, columnId), isNull(s.cards.archivedAt))));
}

export async function boardRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, rt } = ctx;
  app.addHook('preHandler', requireUser);

  const touchBoard = (boardId: number) =>
    db.update(s.boards).set({ updatedAt: Date.now() }).where(eq(s.boards.id, boardId)).run();

  // ---- Boards ----

  app.get('/api/boards', async () => ({
    boards: db.select().from(s.boards).orderBy(asc(s.boards.name)).all().map(toBoard),
  }));

  app.post('/api/boards', async (req) => {
    const body = parseBody(z.object({ name: name('Board name'), color: boardColor.default('ocean') }), req.body);
    const board = createBoard(db, { ...body, createdBy: req.user!.id });
    rt.emitBoardsChanged();
    return { board: toBoard(board) };
  });

  app.get('/api/boards/:id', async (req) => loadBoardState(db, idParam(req)));

  app.patch('/api/boards/:id', async (req) => {
    const id = idParam(req);
    getBoard(db, id);
    const body = parseBody(z.object({ name: name('Board name').optional(), color: boardColor.optional() }), req.body);
    const board = db
      .update(s.boards)
      .set({ ...body, updatedAt: Date.now() })
      .where(eq(s.boards.id, id))
      .returning()
      .get();
    rt.emitBoardsChanged();
    return commit(ctx, req, { boardId: id, board: toBoard(board) });
  });

  for (const action of ['archive', 'restore'] as const) {
    app.post(`/api/boards/:id/${action}`, async (req) => {
      const id = idParam(req);
      getBoard(db, id);
      const board = db
        .update(s.boards)
        .set({ archivedAt: action === 'archive' ? Date.now() : null, updatedAt: Date.now() })
        .where(eq(s.boards.id, id))
        .returning()
        .get();
      rt.emitBoardsChanged();
      return commit(ctx, req, { boardId: id, board: toBoard(board) });
    });
  }

  /** Marks a column as the board's single Done column. Cards already in it lose their day. */
  app.put('/api/boards/:id/done-column', async (req) => {
    const boardId = idParam(req);
    const { columnId } = parseBody(z.object({ columnId: z.number().int() }), req.body);
    const column = getColumn(db, columnId);
    if (column.boardId !== boardId) throw badRequest('Column is not on this board');
    const now = Date.now();
    const changedCardIds = db.transaction((tx) => {
      tx.update(s.columns).set({ isDone: false }).where(eq(s.columns.boardId, boardId)).run();
      tx.update(s.columns).set({ isDone: true }).where(eq(s.columns.id, columnId)).run();
      return tx
        .update(s.cards)
        .set({ dayOfWeek: null, updatedAt: now, updatedBy: req.user!.id })
        .where(and(eq(s.cards.columnId, columnId), isNotNull(s.cards.dayOfWeek)))
        .returning({ id: s.cards.id })
        .all()
        .map((r) => r.id);
    });
    touchBoard(boardId);
    const columns = db.select().from(s.columns).where(eq(s.columns.boardId, boardId)).all().map(toColumn);
    const cards = changedCardIds.length ? loadCards(db, inArray(s.cards.id, changedCardIds)) : [];
    return commit(ctx, req, { boardId, columns, cards: cards.filter((c) => !c.archivedAt) });
  });

  // ---- Columns ----

  app.post('/api/boards/:id/columns', async (req) => {
    const boardId = idParam(req);
    getBoard(db, boardId);
    const body = parseBody(z.object({ name: name('List name') }), req.body);
    const max = db
      .select({ max: sql<number | null>`max(${s.columns.position})` })
      .from(s.columns)
      .where(eq(s.columns.boardId, boardId))
      .get()?.max;
    const column = db
      .insert(s.columns)
      .values({ boardId, name: body.name, position: (max ?? 0) + POSITION_GAP })
      .returning()
      .get();
    touchBoard(boardId);
    return commit(ctx, req, { boardId, columns: [toColumn(column)] });
  });

  app.patch('/api/columns/:id', async (req) => {
    const id = idParam(req);
    const existing = getColumn(db, id);
    const body = parseBody(
      z.object({ name: name('List name').optional(), position: z.number().finite().optional() }),
      req.body,
    );
    const column = db.update(s.columns).set(body).where(eq(s.columns.id, id)).returning().get();
    touchBoard(existing.boardId);
    return commit(ctx, req, { boardId: existing.boardId, columns: [toColumn(column)] });
  });

  /**
   * Deletes a list. If it still has cards, `moveTo` must name the list that
   * receives them (archived cards move along too, so they can be restored).
   */
  app.delete('/api/columns/:id', async (req) => {
    const id = idParam(req);
    const column = getColumn(db, id);
    const { moveTo } = parseBody(z.object({ moveTo: z.number().int().optional() }), req.body);
    if (column.isDone) throw badRequest('This is the Done list. Mark another list as Done before deleting it.');

    const allCards = sortCards(loadCards(db, eq(s.cards.columnId, id)));
    const activeCount = allCards.filter((c) => !c.archivedAt).length;
    if (activeCount > 0 && moveTo == null) {
      throw new HttpError(409, 'This list has cards. Choose where to move them.', { cardCount: activeCount });
    }

    let target: typeof s.columns.$inferSelect | undefined;
    if (allCards.length > 0) {
      target =
        moveTo != null
          ? getColumn(db, moveTo)
          : db
              .select()
              .from(s.columns)
              .where(and(eq(s.columns.boardId, column.boardId), sql`${s.columns.id} != ${id}`))
              .orderBy(asc(s.columns.position))
              .get();
      if (!target || target.boardId !== column.boardId || target.id === id) throw badRequest('Choose another list on this board');
    }

    const movedIds: number[] = [];
    db.transaction((tx) => {
      if (target) {
        const targetCards = activeCardsInColumn(db, target.id);
        const now = Date.now();
        for (const card of allCards) {
          const day = target.isDone ? null : card.dayOfWeek;
          const position = appendPosition(sortCards(targetCards), day);
          tx.update(s.cards)
            .set({ columnId: target.id, dayOfWeek: day, position, updatedAt: now, updatedBy: req.user!.id })
            .where(eq(s.cards.id, card.id))
            .run();
          if (!card.archivedAt) targetCards.push({ ...card, dayOfWeek: day, position });
          movedIds.push(card.id);
        }
      }
      tx.delete(s.columns).where(eq(s.columns.id, id)).run();
    });
    touchBoard(column.boardId);
    const cards = movedIds.length ? loadCards(db, and(inArray(s.cards.id, movedIds), isNull(s.cards.archivedAt))) : [];
    return commit(ctx, req, { boardId: column.boardId, cards, removed: { columns: [id] } });
  });

  // ---- Labels ----

  app.post('/api/boards/:id/labels', async (req) => {
    const boardId = idParam(req);
    getBoard(db, boardId);
    const body = parseBody(z.object({ name: z.string().trim().max(40).default(''), color: labelColor }), req.body);
    const label = db.insert(s.labels).values({ boardId, ...body }).returning().get();
    return commit(ctx, req, { boardId, labels: [toLabel(label)] });
  });

  app.patch('/api/labels/:id', async (req) => {
    const id = idParam(req);
    const body = parseBody(z.object({ name: z.string().trim().max(40).optional(), color: labelColor.optional() }), req.body);
    const label = db.update(s.labels).set(body).where(eq(s.labels.id, id)).returning().get();
    if (!label) throw notFound('Label not found');
    return commit(ctx, req, { boardId: label.boardId, labels: [toLabel(label)] });
  });

  app.delete('/api/labels/:id', async (req) => {
    const id = idParam(req);
    const label = db.select().from(s.labels).where(eq(s.labels.id, id)).get();
    if (!label) throw notFound('Label not found');
    const cardIds = db
      .select({ id: s.cardLabels.cardId })
      .from(s.cardLabels)
      .where(eq(s.cardLabels.labelId, id))
      .all()
      .map((r) => r.id);
    db.delete(s.labels).where(eq(s.labels.id, id)).run();
    const cards = cardIds.length ? loadCards(db, and(inArray(s.cards.id, cardIds), isNull(s.cards.archivedAt))) : [];
    return commit(ctx, req, { boardId: label.boardId, cards, removed: { labels: [id] } });
  });

  // ---- Custom metric fields ----

  app.post('/api/boards/:id/fields', async (req) => {
    const boardId = idParam(req);
    getBoard(db, boardId);
    const body = parseBody(
      z.object({
        name: name('Field name'),
        type: fieldType,
        showOnFront: z.boolean().default(false),
        totalMode: totalMode.optional(),
      }),
      req.body,
    );
    const max = db
      .select({ max: sql<number | null>`max(${s.fields.position})` })
      .from(s.fields)
      .where(eq(s.fields.boardId, boardId))
      .get()?.max;
    const field = db
      .insert(s.fields)
      .values({
        boardId,
        name: body.name,
        type: body.type,
        showOnFront: body.showOnFront,
        totalMode: effectiveTotalMode(body.type, body.totalMode),
        position: (max ?? 0) + POSITION_GAP,
      })
      .returning()
      .get();
    return commit(ctx, req, { boardId, fields: [toField(field)] });
  });

  app.patch('/api/fields/:id', async (req) => {
    const id = idParam(req);
    const existing = db.select().from(s.fields).where(eq(s.fields.id, id)).get();
    if (!existing) throw notFound('Field not found');
    const body = parseBody(
      z.object({
        name: name('Field name').optional(),
        type: fieldType.optional(),
        showOnFront: z.boolean().optional(),
        totalMode: totalMode.optional(),
        position: z.number().finite().optional(),
      }),
      req.body,
    );
    const type = body.type ?? existing.type;
    // Changing type resets the total mode to that type's default unless one was given.
    const mode = body.totalMode ?? (body.type && body.type !== existing.type ? undefined : existing.totalMode);
    const field = db
      .update(s.fields)
      .set({ ...body, totalMode: effectiveTotalMode(type, mode) })
      .where(eq(s.fields.id, id))
      .returning()
      .get();
    return commit(ctx, req, { boardId: field.boardId, fields: [toField(field)] });
  });

  app.delete('/api/fields/:id', async (req) => {
    const id = idParam(req);
    const field = db.select().from(s.fields).where(eq(s.fields.id, id)).get();
    if (!field) throw notFound('Field not found');
    db.delete(s.fields).where(eq(s.fields.id, id)).run();
    // Clients drop the field's values from their videos when they see the field removed.
    return commit(ctx, req, { boardId: field.boardId, removed: { fields: [id] } });
  });
}
