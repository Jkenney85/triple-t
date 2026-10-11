import type { FastifyInstance } from 'fastify';
import { Server, type Socket } from 'socket.io';
import type { Patch, PresenceUser } from '@triple-t/shared';
import { SESSION_COOKIE, userForToken } from './auth';
import type { DB } from './db';

export interface Realtime {
  io: Server | null;
  /** Broadcast a board patch to everyone viewing it, optionally skipping the socket that caused it. */
  emitPatch(patch: Patch, exceptSocketId?: string): void;
  /** Tell every signed-in client that the board list changed. */
  emitBoardsChanged(): void;
  emitUsersChanged(): void;
  disconnectUser(userId: number): void;
}

const room = (boardId: number) => `board:${boardId}`;

export function noopRealtime(): Realtime {
  return { io: null, emitPatch() {}, emitBoardsChanged() {}, emitUsersChanged() {}, disconnectUser() {} };
}

export function createRealtime(app: FastifyInstance, db: DB, buildId?: string): Realtime {
  const io = new Server(app.server, { path: '/socket.io/', serveClient: false, cors: { origin: false } });
  // Close websockets before Fastify waits for open connections, or shutdown hangs.
  app.addHook('preClose', (done) => {
    io.local.disconnectSockets(true);
    io.close(() => done());
  });

  /** boardId -> socketId -> viewer */
  const presence = new Map<number, Map<string, PresenceUser>>();

  io.use((socket, next) => {
    try {
      const cookies = app.parseCookie(socket.handshake.headers.cookie ?? '');
      const raw = cookies[SESSION_COOKIE];
      const unsigned = raw ? app.unsignCookie(raw) : null;
      const user = unsigned?.valid && unsigned.value ? userForToken(db, unsigned.value) : null;
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = { id: user.id, displayName: user.displayName, avatarColor: user.avatarColor } satisfies PresenceUser;
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  function broadcastPresence(boardId: number) {
    const viewers = presence.get(boardId);
    const unique = new Map<number, PresenceUser>();
    for (const u of viewers?.values() ?? []) unique.set(u.id, u);
    io.to(room(boardId)).emit('presence', { boardId, users: [...unique.values()] });
  }

  function leave(socket: Socket, boardId: number) {
    socket.leave(room(boardId));
    const viewers = presence.get(boardId);
    if (viewers?.delete(socket.id)) {
      if (viewers.size === 0) presence.delete(boardId);
      broadcastPresence(boardId);
    }
  }

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.user.id}`);
    // Lets clients running an older cached build know a new one is deployed.
    if (buildId) socket.emit('version', buildId);

    socket.on('board:join', (boardId: unknown) => {
      if (!Number.isInteger(boardId)) return;
      for (const r of socket.rooms) {
        if (r.startsWith('board:')) leave(socket, Number(r.slice(6)));
      }
      const id = boardId as number;
      socket.join(room(id));
      if (!presence.has(id)) presence.set(id, new Map());
      presence.get(id)!.set(socket.id, socket.data.user);
      broadcastPresence(id);
    });

    socket.on('board:leave', (boardId: unknown) => {
      if (Number.isInteger(boardId)) leave(socket, boardId as number);
    });

    socket.on('disconnecting', () => {
      for (const r of socket.rooms) {
        if (r.startsWith('board:')) leave(socket, Number(r.slice(6)));
      }
    });
  });

  return {
    io,
    emitPatch(patch, exceptSocketId) {
      const target = exceptSocketId ? io.to(room(patch.boardId)).except(exceptSocketId) : io.to(room(patch.boardId));
      target.emit('patch', patch);
    },
    emitBoardsChanged() {
      io.emit('boards:changed');
    },
    emitUsersChanged() {
      io.emit('users:changed');
    },
    disconnectUser(userId) {
      io.in(`user:${userId}`).disconnectSockets(true);
    },
  };
}
