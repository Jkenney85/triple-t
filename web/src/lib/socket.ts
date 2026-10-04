import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

export const useConnection = create<{ status: ConnectionStatus }>(() => ({ status: 'connecting' }));

let socket: Socket | null = null;

export function getSocketId(): string | undefined {
  return socket?.connected ? socket.id : undefined;
}

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io({ path: '/socket.io/', transports: ['websocket', 'polling'], withCredentials: true });
  const set = (status: ConnectionStatus) => useConnection.setState({ status });
  socket.on('connect', () => set('online'));
  socket.on('disconnect', () => set(navigator.onLine ? 'reconnecting' : 'offline'));
  socket.io.on('reconnect_attempt', () => set(navigator.onLine ? 'reconnecting' : 'offline'));
  socket.on('connect_error', () => set(navigator.onLine ? 'reconnecting' : 'offline'));
  window.addEventListener('offline', () => set('offline'));
  window.addEventListener('online', () => {
    if (!socket?.connected) {
      set('reconnecting');
      socket?.connect();
    }
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
  useConnection.setState({ status: 'connecting' });
}
