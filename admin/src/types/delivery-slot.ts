export interface DeliverySlotTemplate {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive: boolean;
}

export interface DeliverySlotBooking {
  id: number;
  slotTemplateId: number;
  date: string;
  batchOrderId: number;
  priority: boolean;
  priorityRank: number | null;
  bookedAt: string;
}

export interface DeliverySettings {
  id: number;
  serviceCenterLat: number;
  serviceCenterLng: number;
  serviceRadiusKm: number;
  priorityFeeAmount: number;
  extraDestinationSurcharge: number;
}

export interface ExternalDelivery {
  id: number;
  batchRef: string;
  externalDeliveryStatus: 'pending_admin' | 'booked' | 'delivered';
  user: { fullName: string | null; email: string };
  createdAt: string;
}
