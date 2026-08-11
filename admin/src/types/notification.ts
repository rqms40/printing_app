export type NotificationType =
  | 'order_placed'
  | 'order_cancelled'
  | 'order_declined'
  | 'topup_request'
  | 'topup_approved'
  | 'topup_rejected'
  | 'new_user'
  | 'status_change';

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  orderRef: string | null;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface BadgeCounts {
  newOrders: number;
  pendingTopUps: number;
  pendingQrPayments?: number;
}
