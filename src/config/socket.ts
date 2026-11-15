import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Cliente conectado a tiempo real: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io no ha sido inicializado');
  }
  return io;
};

// Helper seguro para emitir sin romper controladores si el socket aún no inicia
export const emitEvent = (evento: string, payload: unknown): void => {
  if (io) {
    io.emit(evento, payload);
  }
};