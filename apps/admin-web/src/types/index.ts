export type OrderStatus =
  | 'New'
  | 'Order Placed'
  | 'File Verified'
  | 'File Declined'
  | 'Printing in Progress'
  | 'Finishing & Mounting'
  | 'Quality Checked'
  | 'Ready for Dispatch'
  | 'Rider Assigned'
  | 'Picked Up'
  | 'On the Way'
  | 'Arrived at Destination'
  | 'Delivered'
  | 'Completed (Pickup)'
  | 'Cancelled';

export interface OrderSpecs {
  category: string;
  paperSize?: string;
  colorMode?: string;
  media?: string;
  sides?: string;
  binding?: string;
  fileFormat?: string;
  material?: string;
  color?: string;
  infill?: string;
  layerHeight?: string;
}

export interface Order {
  orderId: string;
  customerName: string;
  status: OrderStatus;
  date: string;
  price: number;
  deliveryFee: number;
  paymentLabel: string;
  fileName: string;
  fileMetadataId?: number;
  specs: OrderSpecs;
  quantity: number;
}

export interface RiderProfile {
  id: string;
  name: string;
  vehicleType: string;
  plateNumber: string;
  isAvailable: boolean;
  lastLatitude: number;
  lastLongitude: number;
}

export interface DeliveryAssignment {
  id: string;
  orderId: string;
  riderId: string;
  status: 'Assigned' | 'Accepted' | 'Picked Up' | 'On the Way' | 'Arrived' | 'Delivered' | 'Declined';
  earnings: number;
  date: string;
}
