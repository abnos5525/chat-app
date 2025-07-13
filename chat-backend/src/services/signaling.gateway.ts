import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
})
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private rooms: Map<string, string[]> = new Map();
  private readonly logger = new Logger(SignalingGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.rooms.forEach((clients, roomId) => {
      if (clients.includes(client.id)) {
        const updatedClients = clients.filter((id) => id !== client.id);
        this.rooms.set(roomId, updatedClients);

        updatedClients.forEach((id) => {
          this.server.to(id).emit('peer-disconnected');
        });

        if (updatedClients.length === 0) {
          this.rooms.delete(roomId);
        }
      }
    });
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, roomId: string) {
    const roomClients = this.rooms.get(roomId) || [];

    // Prevent same client from joining twice
    if (roomClients.includes(client.id)) {
      client.emit('join-error', 'You are already in this room');
      return;
    }

    if (roomClients.length >= 2) {
      this.logger.warn(`Room ${roomId} is full`);
      client.emit('room-full', roomId);
      return;
    }

    roomClients.push(client.id);
    this.rooms.set(roomId, roomClients);
    client.join(roomId);
    client.emit('joined', { roomId, isInitiator: roomClients.length === 1 });

    this.logger.log(
      `Client ${client.id} joined room ${roomId}. Room now has ${roomClients.length} clients`,
    );

    if (roomClients.length === 2) {
      this.logger.log(`Room ${roomId} is full, initiating WebRTC handshake`);
      roomClients.forEach((clientId) => {
        this.server.to(clientId).emit('ready', roomId);
      });
    }
  }

  @SubscribeMessage('offer')
  handleOffer(
    client: Socket,
    payload: { roomId: string; offer: RTCSessionDescriptionInit },
  ) {
    const roomClients = this.rooms.get(payload.roomId) || [];
    roomClients.forEach((clientId) => {
      if (clientId !== client.id) {
        this.server.to(clientId).emit('offer', payload.offer);
      }
    });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    client: Socket,
    payload: { roomId: string; answer: RTCSessionDescriptionInit },
  ) {
    const roomClients = this.rooms.get(payload.roomId) || [];
    roomClients.forEach((clientId) => {
      if (clientId !== client.id) {
        this.server.to(clientId).emit('answer', payload.answer);
      }
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    client: Socket,
    payload: { roomId: string; candidate: RTCIceCandidate },
  ) {
    const roomClients = this.rooms.get(payload.roomId) || [];
    roomClients.forEach((clientId) => {
      if (clientId !== client.id) {
        this.server.to(clientId).emit('ice-candidate', payload.candidate);
      }
    });
  }
}
