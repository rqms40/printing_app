import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('chat_settings')
export class ChatSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'is_file_sending_enabled', type: 'boolean', default: true })
  isFileSendingEnabled: boolean;

  @Column({ name: 'filtered_words', type: 'text', array: true, default: '{}' })
  filteredWords: string[];
}
