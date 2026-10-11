import {
  appendPosition,
  dayForColumn,
  sortCards,
  type Board,
  type Card,
  type CardInput,
  type Column,
  type Field,
  type Label,
  type Patch,
  type Video,
} from '@triple-t/shared';
import { useBoard } from '../stores/board';
import { useSession } from '../stores/session';
import { del, patch, post, put, upload } from './api';

const board = () => useBoard.getState();
const me = () => useSession.getState().me!.id;

// ---- Cards ----

export async function createCard(boardId: number, columnId: number, input: CardInput): Promise<Card> {
  const res = await board().mutate(null, () => post<Patch>(`/api/boards/${boardId}/cards`, { columnId, ...input }));
  return res.cards![0];
}

export function updateCard(card: Card, changes: CardInput) {
  const s = board();
  const optimistic: Card = { ...card, ...changes, updatedAt: Date.now(), updatedBy: me() } as Card;
  if (changes.dayOfWeek !== undefined) {
    const col = s.columns[card.columnId];
    optimistic.dayOfWeek = dayForColumn(changes.dayOfWeek, !!col?.isDone);
    if (optimistic.dayOfWeek !== card.dayOfWeek) {
      const others = sortCards(Object.values(s.cards).filter((c) => c.columnId === card.columnId && c.id !== card.id));
      optimistic.position = appendPosition(others, optimistic.dayOfWeek);
    }
  }
  return s.mutate({ boardId: card.boardId, cards: [optimistic] }, () => patch<Patch>(`/api/cards/${card.id}`, changes));
}

/** Moving into the Done column clears the day locally too; the server enforces the same rule. */
export function moveCard(card: Card, column: Column, position: number) {
  const optimistic: Card = {
    ...card,
    columnId: column.id,
    position,
    dayOfWeek: dayForColumn(card.dayOfWeek, column.isDone),
    updatedAt: Date.now(),
    updatedBy: me(),
  };
  return board().mutate({ boardId: card.boardId, cards: [optimistic] }, () =>
    post<Patch>(`/api/cards/${card.id}/move`, { columnId: column.id, position }),
  );
}

export function archiveCard(card: Card) {
  return board().mutate({ boardId: card.boardId, removed: { cards: [card.id] } }, () =>
    post<Patch>(`/api/cards/${card.id}/archive`),
  );
}

export const restoreCard = (card: Card) => board().mutate(null, () => post<Patch>(`/api/cards/${card.id}/restore`));
export const deleteCard = (card: Card) => board().mutate(null, () => del<Patch>(`/api/cards/${card.id}`));

// ---- Boards & columns ----

export function updateBoard(b: Board, changes: Partial<Pick<Board, 'name' | 'color'>>) {
  return board().mutate({ boardId: b.id, board: { ...b, ...changes } }, () => patch<Patch>(`/api/boards/${b.id}`, changes));
}

export const uploadBoardBackground = (b: Board, file: File) =>
  board().mutate(null, () => upload<Patch>(`/api/boards/${b.id}/background`, file));

export const removeBoardBackground = (b: Board) =>
  board().mutate({ boardId: b.id, board: { ...b, backgroundImage: null } }, () => del<Patch>(`/api/boards/${b.id}/background`));

export const archiveBoard = (b: Board) => board().mutate(null, () => post<Patch>(`/api/boards/${b.id}/archive`));
export const restoreBoard = (b: Board) => board().mutate(null, () => post<Patch>(`/api/boards/${b.id}/restore`));

export function setDoneColumn(boardId: number, columnId: number) {
  const cols = Object.values(board().columns).map((c) => ({ ...c, isDone: c.id === columnId }));
  return board().mutate({ boardId, columns: cols }, () => put<Patch>(`/api/boards/${boardId}/done-column`, { columnId }));
}

export const createColumn = (boardId: number, name: string) =>
  board().mutate(null, () => post<Patch>(`/api/boards/${boardId}/columns`, { name }));

export function updateColumn(col: Column, changes: Partial<Pick<Column, 'name' | 'position' | 'color' | 'sort' | 'highlightDue'>>) {
  return board().mutate({ boardId: col.boardId, columns: [{ ...col, ...changes }] }, () =>
    patch<Patch>(`/api/columns/${col.id}`, changes),
  );
}

export function deleteColumn(col: Column, moveTo?: number) {
  return board().mutate(null, () => del<Patch>(`/api/columns/${col.id}`, { moveTo }));
}

// ---- Labels ----

export const createLabel = (boardId: number, name: string, color: string) =>
  board().mutate(null, () => post<Patch>(`/api/boards/${boardId}/labels`, { name, color }));

export const updateLabel = (label: Label, changes: Partial<Pick<Label, 'name' | 'color'>>) =>
  board().mutate({ boardId: label.boardId, labels: [{ ...label, ...changes }] }, () =>
    patch<Patch>(`/api/labels/${label.id}`, changes),
  );

export const deleteLabel = (label: Label) =>
  board().mutate({ boardId: label.boardId, removed: { labels: [label.id] } }, () => del<Patch>(`/api/labels/${label.id}`));

// ---- Fields ----

export const createField = (boardId: number, input: Pick<Field, 'name' | 'type' | 'showOnFront'>) =>
  board().mutate(null, () => post<Patch>(`/api/boards/${boardId}/fields`, input));

export const updateField = (field: Field, changes: Partial<Omit<Field, 'id' | 'boardId'>>) =>
  board().mutate({ boardId: field.boardId, fields: [{ ...field, ...changes }] }, () =>
    patch<Patch>(`/api/fields/${field.id}`, changes),
  );

export const deleteField = (field: Field) =>
  board().mutate({ boardId: field.boardId, removed: { fields: [field.id] } }, () => del<Patch>(`/api/fields/${field.id}`));

// ---- Comments ----

export const addVideoComment = (video: Video, body: string) =>
  board().mutate(null, () => post<Patch>(`/api/videos/${video.id}/comments`, { body }));

export function editComment(boardId: number, comment: { id: number; body: string }, body: string) {
  const existing = board().comments[comment.id];
  return board().mutate(existing ? { boardId, comments: [{ ...existing, body, updatedAt: Date.now() }] } : null, () =>
    patch<Patch>(`/api/comments/${comment.id}`, { body }),
  );
}

export const deleteComment = (boardId: number, id: number) =>
  board().mutate({ boardId, removed: { comments: [id] } }, () => del<Patch>(`/api/comments/${id}`));

// ---- Videos ----

export const addVideo = (card: Card, url: string) =>
  board().mutate(null, () => post<Patch>(`/api/cards/${card.id}/videos`, { url }));

/** Saves one metric for one month of a video. An empty value clears it. */
export function setVideoValue(boardId: number, video: Video, month: string, fieldId: number, value: string) {
  const values = { ...(video.months[month] ?? {}) };
  if (value.trim() === '') delete values[fieldId];
  else values[fieldId] = value;
  return board().mutate({ boardId, videos: [{ ...video, months: { ...video.months, [month]: values } }] }, () =>
    patch<Patch>(`/api/videos/${video.id}`, { month, values: { [fieldId]: value } }),
  );
}

export const refreshVideo = (boardId: number, video: Video) =>
  board().mutate({ boardId, videos: [{ ...video, status: 'pending', error: null }] }, () =>
    post<Patch>(`/api/videos/${video.id}/refresh`),
  );

export const deleteVideo = (boardId: number, video: Video) =>
  board().mutate({ boardId, removed: { videos: [video.id] } }, () => del<Patch>(`/api/videos/${video.id}`));
