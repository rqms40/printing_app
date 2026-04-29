import { getMetadataArgsStorage } from 'typeorm';
import { ChatMessage } from './chat-message.entity';
import { Conversation } from './conversation.entity';

function columnType(
  target: Function,
  propertyName: string,
): string | Function | undefined {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options.type;
}

describe('chat entity metadata', () => {
  it('declares database types for nullable numeric columns', () => {
    expect(columnType(Conversation, 'orderId')).toBe('int');
    expect(columnType(Conversation, 'assignedAdminId')).toBe('int');
    expect(columnType(Conversation, 'assignedRiderId')).toBe('int');
    expect(columnType(ChatMessage, 'senderId')).toBe('int');
  });
});
