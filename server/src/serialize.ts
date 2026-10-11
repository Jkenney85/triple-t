import { and, asc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import type { Board, BoardState, Card, Column, Comment, Field, Label, Video } from '@triple-t/shared';
import type { DB } from './db';
import * as s from './db/schema';
import { notFound } from './errors';

type BoardRow = typeof s.boards.$inferSelect;
type CardRow = typeof s.cards.$inferSelect;
type VideoRow = typeof s.videos.$inferSelect;

export const toBoard = (b: BoardRow): Board => ({
  id: b.id,
  name: b.name,
  color: b.color,
  backgroundImage: b.backgroundImage ? `/api/backgrounds/${b.backgroundImage}` : null,
  archivedAt: b.archivedAt,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
});

export const toColumn = (c: typeof s.columns.$inferSelect): Column => ({ ...c });
export const toLabel = (l: typeof s.labels.$inferSelect): Label => ({ ...l });
export const toField = (f: typeof s.fields.$inferSelect): Field => ({ ...f });
export const toComment = (c: typeof s.comments.$inferSelect): Comment => ({ ...c });

export function getBoard(db: DB, id: number): BoardRow {
  const row = db.select().from(s.boards).where(eq(s.boards.id, id)).get();
  if (!row) throw notFound('Board not found');
  return row;
}

export function getColumn(db: DB, id: number) {
  const row = db.select().from(s.columns).where(eq(s.columns.id, id)).get();
  if (!row) throw notFound('Column not found');
  return row;
}

export function getCardRow(db: DB, id: number): CardRow {
  const row = db.select().from(s.cards).where(eq(s.cards.id, id)).get();
  if (!row) throw notFound('Card not found');
  return row;
}

export function loadCards(db: DB, where: SQL | undefined): Card[] {
  const rows = db.select().from(s.cards).where(where).all();
  return attachLabels(db, rows);
}

function attachLabels(db: DB, rows: CardRow[]): Card[] {
  if (rows.length === 0) return [];
  const links = db
    .select()
    .from(s.cardLabels)
    .where(
      inArray(
        s.cardLabels.cardId,
        rows.map((r) => r.id),
      ),
    )
    .all();
  const byCard = new Map<number, number[]>();
  for (const l of links) {
    const list = byCard.get(l.cardId) ?? [];
    list.push(l.labelId);
    byCard.set(l.cardId, list);
  }
  return rows.map((r) => ({ ...r, labelIds: byCard.get(r.id) ?? [] }));
}

export const loadCard = (db: DB, id: number): Card => {
  const [card] = attachLabels(db, [getCardRow(db, id)]);
  return card;
};

export function loadVideos(db: DB, where: SQL | undefined): Video[] {
  const rows = db.select().from(s.videos).where(where).orderBy(asc(s.videos.position), asc(s.videos.id)).all();
  if (rows.length === 0) return [];
  const values = db
    .select()
    .from(s.videoValues)
    .where(
      inArray(
        s.videoValues.videoId,
        rows.map((r) => r.id),
      ),
    )
    .all();
  const byVideo = new Map<number, Record<string, Record<string, string>>>();
  for (const v of values) {
    const months = byVideo.get(v.videoId) ?? {};
    (months[v.month] ??= {})[String(v.fieldId)] = v.value;
    byVideo.set(v.videoId, months);
  }
  return rows.map((r) => toVideo(r, byVideo.get(r.id) ?? {}));
}

export function toVideo(r: VideoRow, months: Record<string, Record<string, string>>): Video {
  return {
    id: r.id,
    cardId: r.cardId,
    url: r.url,
    title: r.title,
    author: r.author,
    thumbnail: r.thumbnailFile ? `/api/thumbnails/${r.thumbnailFile}` : null,
    status: r.status,
    error: r.error,
    position: r.position,
    months,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export const loadVideo = (db: DB, id: number): Video => {
  const [video] = loadVideos(db, eq(s.videos.id, id));
  if (!video) throw notFound('Video not found');
  return video;
};

/** Everything a client needs to render a board. Archived cards (and their videos/comments) are left out. */
export function loadBoardState(db: DB, boardId: number): BoardState {
  const board = toBoard(getBoard(db, boardId));
  const columns = db.select().from(s.columns).where(eq(s.columns.boardId, boardId)).orderBy(asc(s.columns.position)).all();
  const labels = db.select().from(s.labels).where(eq(s.labels.boardId, boardId)).orderBy(asc(s.labels.id)).all();
  const fields = db.select().from(s.fields).where(eq(s.fields.boardId, boardId)).orderBy(asc(s.fields.position)).all();
  const cards = loadCards(db, and(eq(s.cards.boardId, boardId), isNull(s.cards.archivedAt)));
  const cardIds = cards.map((c) => c.id);
  const videos = cardIds.length ? loadVideos(db, inArray(s.videos.cardId, cardIds)) : [];
  const comments = cardIds.length
    ? db.select().from(s.comments).where(inArray(s.comments.cardId, cardIds)).orderBy(asc(s.comments.createdAt)).all()
    : [];
  return {
    board,
    columns: columns.map(toColumn),
    labels: labels.map(toLabel),
    fields: fields.map(toField),
    cards,
    videos,
    comments: comments.map(toComment),
  };
}
