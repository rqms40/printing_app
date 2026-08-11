export type ConversationType = "ai" | "admin" | "rider";
export type ConversationStatus = "open" | "assigned" | "closed";
export type SenderRole = "customer" | "admin" | "rider" | "bot";
/** Account role of the non-admin participant (customer_id user). */
export type ParticipantRole =
  | "client"
  | "supplier"
  | "rider"
  | "ops_admin"
  | "super_admin"
  | string;

export interface Conversation {
  id: number;
  customerId: number;
  customer?: {
    id: number;
    name?: string;
    fullName?: string;
    nickname?: string;
    email: string;
    role?: ParticipantRole;
  };
  /** Role of the user in `customerId` — e.g. supplier vs client. */
  participantRole?: ParticipantRole | null;
  type: ConversationType;
  orderId: number | null;
  assignedAdminId: number | null;
  assignedRiderId: number | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface NewConversationEvent {
  conversationId: number;
  customerId: number;
  customerName: string;
  participantRole?: ParticipantRole | null;
  type: ConversationType;
  orderId: number | null;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number | null;
  senderRole: SenderRole;
  content: string | null;
  attachmentFileId: number | null;
  attachmentMimeType: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
