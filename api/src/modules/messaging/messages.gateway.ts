import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingAccessService } from './messaging-access.service';
import { MessageResponseDto } from './dto/message-response.dto';

// Live message delivery. The socket authenticates with the SAME JWT as REST
// (handshake auth.token) via connection middleware — unauthenticated sockets are
// REFUSED at the handshake, never connected. A client may only join a job room
// after the same server-side participant check REST uses (no subscribe gap).
@WebSocketGateway({ cors: { origin: '*' } })
export class MessagesGateway implements OnGatewayInit {
  private readonly logger = new Logger('MessagesGateway');
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: MessagingAccessService,
  ) {}

  afterInit(server: Server) {
    server.use((socket: Socket, next) => {
      const token =
        socket.handshake.auth?.token ??
        (socket.handshake.query?.token as string | undefined);
      try {
        const payload = this.jwt.verify(token as string, {
          secret: this.config.get<string>('jwt.accessSecret'),
        });
        socket.data.userId = payload.sub;
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  @SubscribeMessage('join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { jobId?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const jobId = body?.jobId;
    if (!userId || !jobId) return { ok: false };
    try {
      await this.access.assertParticipant(userId, jobId);
      client.join(this.room(jobId));
      return { ok: true };
    } catch {
      return { ok: false, error: 'not a participant' };
    }
  }

  @SubscribeMessage('leave')
  onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { jobId?: string },
  ) {
    if (body?.jobId) client.leave(this.room(body.jobId));
    return { ok: true };
  }

  // Called by MessagesService after a message is persisted.
  broadcast(jobId: string, message: MessageResponseDto) {
    this.server?.to(this.room(jobId)).emit('message', message);
  }

  private room(jobId: string): string {
    return `job:${jobId}`;
  }
}
