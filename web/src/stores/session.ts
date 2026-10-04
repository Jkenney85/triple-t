import { create } from 'zustand';
import type { PublicUser } from '@triple-t/shared';
import { ApiError, get, post } from '../lib/api';
import { closeSocket, getSocket } from '../lib/socket';

interface SessionState {
  status: 'loading' | 'signedOut' | 'signedIn';
  me: PublicUser | null;
  tz: string;
  users: Record<number, PublicUser>;
  init(): Promise<void>;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  loadUsers(): Promise<void>;
  setMe(user: PublicUser): void;
  signedOut(): void;
}

export const useSession = create<SessionState>((set, getState) => ({
  status: 'loading',
  me: null,
  tz: 'America/Chicago',
  users: {},

  async init() {
    try {
      const { user, config } = await get<{ user: PublicUser; config: { tz: string } }>('/api/auth/me');
      set({ me: user, tz: config.tz, status: 'signedIn' });
      await getState().loadUsers();
      const socket = getSocket();
      socket.off('users:changed').on('users:changed', () => void getState().loadUsers());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) set({ status: 'signedOut', me: null });
      else {
        // Offline at launch: retry shortly rather than bouncing to the login screen.
        setTimeout(() => void getState().init(), 3000);
      }
    }
  },

  async login(username, password) {
    await post('/api/auth/login', { username, password });
    await getState().init();
  },

  async logout() {
    try {
      await post('/api/auth/logout');
    } finally {
      getState().signedOut();
    }
  },

  async loadUsers() {
    const { users } = await get<{ users: PublicUser[] }>('/api/users');
    const map: Record<number, PublicUser> = {};
    for (const u of users) map[u.id] = u;
    const me = getState().me;
    set({ users: map, me: me && map[me.id] ? map[me.id] : me });
  },

  setMe(user) {
    set((s) => ({ me: user, users: { ...s.users, [user.id]: user } }));
  },

  signedOut() {
    closeSocket();
    set({ status: 'signedOut', me: null, users: {} });
  },
}));
