import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:4001';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  connect(token: string) {
    if (this.socket?.connected) return;
    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      transports: ['websocket'],
    });
    this.listeners.forEach((handlers, event) => {
      handlers.forEach((h) => this.socket?.on(event, h));
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  emit(event: string, data?: any, callback?: (r: any) => void) {
    if (callback) this.socket?.emit(event, data, callback);
    else this.socket?.emit(event, data);
  }

  on(event: string, handler: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    this.socket?.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void) {
    this.listeners.get(event)?.delete(handler);
    this.socket?.off(event, handler);
  }
}

export const socketService = new SocketService();
