import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';

export enum SenderRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  RIDER = 'rider',
  BOT = 'bot',
  SUPPLIER = 'supplier',
}

@Entity('chat_messages')
@Index('idx_chat_msg_conv_created', ['conversationId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'conversation_id' })
  conversationId: number;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ name: 'sender_id', type: 'int', nullable: true })
  senderId: number | null;

  @Column({ name: 'sender_role', type: 'enum', enum: SenderRole })
  senderRole: SenderRole;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'attachment_file_id', type: 'int', nullable: true })
  attachmentFileId: number | null;

  @Column({
    name: 'attachment_mime_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  attachmentMimeType: string | null;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
