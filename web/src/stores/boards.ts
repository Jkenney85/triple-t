import { create } from 'zustand';
import type { Board } from '@triple-t/shared';
import { get } from '../lib/api';
import { getSocket } from '../lib/socket';

let bound = false;

export const useBoards = create<{ boards: Board[]; loaded: boolean; load(): Promise<void> }>((set, getState) => ({
  boards: [],
  loaded: false,
  async load() {
    if (!bound) {
      bound = true;
      const socket = getSocket();
      socket.on('boards:changed', () => void getState().load());
      socket.on('connect', () => void getState().load());
    }
    try {
      const { boards } = await get<{ boards: Board[] }>('/api/boards');
      set({ boards, loaded: true });
    } catch {
      // keep the last list; reconnect will retry
    }
  },
}));
