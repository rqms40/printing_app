export type ConversationType = 'ai' | 'admin' | 'rider';
export type ConversationStatus = 'open' | 'assigned' | 'closed';
export type SenderRole = 'customer' | 'admin' | 'rider' | 'bot';

export interface Conversation {
  id: number;
  customerId: number;
  customer?: { id: number; name: string; email: string };
  type: ConversationType;
  orderId: number | null;
  assignedAdminId: number | null;
  assignedRiderId: number | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface NewConversationEvent extends Conversation {
  customerName: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number | null;
  senderRole: SenderRole;
  content: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
