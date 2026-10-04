import { create } from 'zustand';
import type { Board, BoardState, Card, Column, Comment, Field, Label, Patch, PresenceUser, Video } from '@triple-t/shared';
import { ApiError, get } from '../lib/api';
import { getSocket } from '../lib/socket';
import { toast } from './ui';

type Kind = 'columns' | 'labels' | 'fields' | 'cards' | 'videos' | 'comments';
const KINDS: Kind[] = ['columns', 'labels', 'fields', 'cards', 'videos', 'comments'];

interface Entities {
  columns: Record<number, Column>;
  labels: Record<number, Label>;
  fields: Record<number, Field>;
  cards: Record<number, Card>;
  videos: Record<number, Video>;
  comments: Record<number, Comment>;
}

interface BoardStore extends Entities {
  boardId: number | null;
  board: Board | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  presence: PresenceUser[];
  /** Bumped whenever the archived-items list changes, so the archive view can refetch. */
  archivedVersion: number;
  open(boardId: number): Promise<void>;
  close(): void;
  reload(): Promise<void>;
  applyPatch(patch: Patch): void;
  /**
   * Applies `optimistic` immediately, then the server's patch. If the request
   * fails, the touched entities roll back, the board resyncs, and the error is shown.
   */
  mutate(optimistic: Patch | null, request: () => Promise<Patch>): Promise<Patch>;
}

const emptyEntities = (): Entities => ({ columns: {}, labels: {}, fields: {}, cards: {}, videos: {}, comments: {} });

function index<T extends { id: number }>(items: T[]): Record<number, T> {
  const out: Record<number, T> = {};
  for (const item of items) out[item.id] = item;
  return out;
}

function fromState(s: BoardState): Entities & { board: Board } {
  return {
    board: s.board,
    columns: index(s.columns),
    labels: index(s.labels),
    fields: index(s.fields),
    cards: index(s.cards),
    videos: index(s.videos),
    comments: index(s.comments),
  };
}

/** Pure patch application, returning only the slices that changed. */
function patchEntities(state: Entities, p: Patch): Partial<Entities> {
  const out: Partial<Entities> = {};
  const slice = <K extends Kind>(k: K): Entities[K] => (out[k] ??= { ...state[k] }) as Entities[K];

  for (const k of KINDS) {
    const items = p[k] as { id: number }[] | undefined;
    if (items?.length) {
      const map = slice(k) as Record<number, unknown>;
      for (const item of items) map[item.id] = item;
    }
    const removed = p.removed?.[k];
    if (removed?.length) {
      const map = slice(k) as Record<number, unknown>;
      for (const id of removed) delete map[id];
    }
  }

  // Cascades the server leaves implicit.
  if (p.removed?.cards?.length) {
    const gone = new Set(p.removed.cards);
    const videos = slice('videos');
    for (const v of Object.values(videos)) if (gone.has(v.cardId)) delete videos[v.id];
    const comments = slice('comments');
    for (const c of Object.values(comments)) if (gone.has(c.cardId)) delete comments[c.id];
  }
  if (p.removed?.fields?.length) {
    const videos = slice('videos');
    for (const v of Object.values(videos)) {
      const values = { ...v.values };
      for (const id of p.removed.fields) delete values[id];
      videos[v.id] = { ...v, values };
    }
  }
  if (p.removed?.labels?.length) {
    const gone = new Set(p.removed.labels);
    const cards = slice('cards');
    for (const c of Object.values(cards)) {
      if (c.labelIds.some((id) => gone.has(id))) cards[c.id] = { ...c, labelIds: c.labelIds.filter((id) => !gone.has(id)) };
    }
  }
  return out;
}

/** Snapshot of the entities a patch is about to touch, so they can be put back. */
function capture(state: Entities, p: Patch): Partial<Record<Kind, Record<number, unknown>>> {
  const snap: Partial<Record<Kind, Record<number, unknown>>> = {};
  for (const k of KINDS) {
    const ids = [...((p[k] as { id: number }[] | undefined) ?? []).map((i) => i.id), ...(p.removed?.[k] ?? [])];
    if (!ids.length) continue;
    snap[k] = {};
    for (const id of ids) snap[k]![id] = (state[k] as Record<number, unknown>)[id];
  }
  return snap;
}

let socketBound = false;

export const useBoard = create<BoardStore>((set, getState) => {
  function bindSocket() {
    if (socketBound) return;
    socketBound = true;
    const socket = getSocket();
    socket.on('patch', (p: Patch) => getState().applyPatch(p));
    socket.on('presence', (msg: { boardId: number; users: PresenceUser[] }) => {
      if (msg.boardId === getState().boardId) set({ presence: msg.users });
    });
    socket.on('connect', () => {
      // Fresh connection or reconnect: rejoin the room and resync anything missed.
      const id = getState().boardId;
      if (id != null) {
        socket.emit('board:join', id);
        if (getState().status === 'ready') void getState().reload();
      }
    });
  }

  return {
    ...emptyEntities(),
    boardId: null,
    board: null,
    status: 'idle',
    error: null,
    presence: [],
    archivedVersion: 0,

    async open(boardId) {
      bindSocket();
      const prev = getState().boardId;
      if (prev === boardId && getState().status !== 'error') return;
      const socket = getSocket();
      if (prev != null && prev !== boardId) socket.emit('board:leave', prev);
      set({ ...emptyEntities(), boardId, board: null, status: 'loading', error: null, presence: [] });
      if (socket.connected) socket.emit('board:join', boardId);
      await getState().reload();
    },

    close() {
      const prev = getState().boardId;
      if (prev != null) getSocket().emit('board:leave', prev);
      set({ ...emptyEntities(), boardId: null, board: null, status: 'idle', presence: [] });
    },

    async reload() {
      const boardId = getState().boardId;
      if (boardId == null) return;
      try {
        const state = await get<BoardState>(`/api/boards/${boardId}`);
        if (getState().boardId !== boardId) return;
        set({ ...fromState(state), status: 'ready', error: null });
      } catch (err) {
        if (getState().boardId !== boardId) return;
        if (getState().status === 'ready') return; // keep showing what we have; socket reconnect will retry
        set({ status: 'error', error: err instanceof ApiError ? err.message : 'Could not load board' });
      }
    },

    applyPatch(p) {
      if (p.boardId !== getState().boardId) return;
      set((s) => ({
        ...patchEntities(s, p),
        ...(p.board ? { board: p.board } : {}),
        ...(p.archivedChanged ? { archivedVersion: s.archivedVersion + 1 } : {}),
      }));
    },

    async mutate(optimistic, request) {
      const snap = optimistic ? capture(getState(), optimistic) : null;
      if (optimistic) getState().applyPatch(optimistic);
      try {
        const res = await request();
        getState().applyPatch(res);
        return res;
      } catch (err) {
        if (snap) {
          set((s) => {
            const out: Partial<Entities> = {};
            for (const k of Object.keys(snap) as Kind[]) {
              const map = { ...(s[k] as Record<number, unknown>) };
              for (const [id, value] of Object.entries(snap[k]!)) {
                if (value === undefined) delete map[Number(id)];
                else map[Number(id)] = value;
              }
              (out as Record<Kind, unknown>)[k] = map;
            }
            return out;
          });
          void getState().reload();
        }
        toast(err instanceof ApiError ? err.message : 'Something went wrong');
        throw err;
      }
    },
  };
});

export { patchEntities };
