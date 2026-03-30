import type { DriverProfile, DeliveryAssignment } from '../types';

export const mockDrivers: DriverProfile[] = [
  {
    id: 'dr_001',
    name: 'Juan Reyes',
    vehicleType: 'Motorcycle',
    plateNumber: 'ABC 1234',
    isAvailable: true,
    lastLatitude: 7.1338,
    lastLongitude: 125.6120,
  },
  {
    id: 'dr_002',
    name: 'Carlos Santos',
    vehicleType: 'Car',
    plateNumber: 'XYZ 5678',
    isAvailable: false,
    lastLatitude: 7.1290,
    lastLongitude: 125.6030,
  },
];

export const mockDeliveries: DeliveryAssignment[] = [
  {
    id: 'da_001',
    orderId: 'ORD-10005',
    driverId: 'dr_001',
    status: 'On the Way',
    earnings: 120,
    date: 'Mar 27, 2026',
  },
  {
    id: 'da_002',
    orderId: 'ORD-10006',
    driverId: 'dr_001',
    status: 'Delivered',
    earnings: 150,
    date: 'Mar 26, 2026',
  },
  {
    id: 'da_005',
    orderId: 'ORD-10003',
    driverId: 'dr_001',
    status: 'Picked Up',
    earnings: 90,
    date: 'Mar 27, 2026',
  },
  {
    id: 'da_004',
    orderId: 'ORD-10004',
    driverId: 'dr_002',
    status: 'Declined',
    earnings: 0,
    date: 'Mar 27, 2026',
  }
];
