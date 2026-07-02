import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Message } from '../entities/message.entity';

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class MessageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() jobId: string;
  @ApiProperty() senderId: string;
  @ApiProperty() receiverId: string;
  @ApiProperty() content: string;
  @ApiProperty() sentAt: Date;

  static from(m: Message): MessageResponseDto {
    return {
      id: m.id,
      jobId: m.jobId,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      sentAt: m.sentAt,
    };
  }
}
