import type { Order } from '../types';

export const mockOrders: Order[] = [
  {
    orderId: 'ORD-10001',
    customerName: 'Customer usr_001',
    status: 'New',
    date: 'Mar 27, 2026',
    price: 750.00,
    deliveryFee: 80.00,
    paymentLabel: 'GCash • Paid',
    fileName: 'poster_design.pdf',
    quantity: 5,
    specs: {
      category: 'Poster',
      paperSize: 'A3',
      colorMode: 'Full Color',
      media: 'Glossy',
      sides: 'Front Only',
      binding: 'None'
    }
  },
  {
    orderId: 'ORD-10002',
    customerName: 'Customer usr_001',
    status: 'New',
    date: 'Mar 27, 2026',
    price: 450.00,
    deliveryFee: 80.00,
    paymentLabel: 'Maya • Paid',
    fileName: 'thesis_final.pdf',
    quantity: 3,
    specs: {
      category: 'Document',
      paperSize: 'A4',
      colorMode: 'Black & White',
      media: 'Matte',
      sides: 'Back-to-Back',
      binding: 'Spiral'
    }
  },
  {
    orderId: 'ORD-10003',
    customerName: 'Customer usr_001',
    status: 'Printing in Progress',
    date: 'Mar 26, 2026',
    price: 1500.00,
    deliveryFee: 100.00,
    paymentLabel: 'GCash • Paid',
    fileName: 'annual_report.pdf',
    quantity: 10,
    specs: {
      category: 'Report',
      paperSize: 'A4',
      colorMode: 'Full Color',
      media: 'Matte',
      sides: 'Back-to-Back',
      binding: 'Staple'
    }
  },
  {
    orderId: 'ORD-10004',
    customerName: 'Customer usr_001',
    status: 'Ready for Dispatch',
    date: 'Mar 25, 2026',
    price: 2400.00,
    deliveryFee: 150.00,
    paymentLabel: 'COD • Pending',
    fileName: 'event_banner.pdf',
    quantity: 2,
    specs: {
      category: 'Banner',
      paperSize: 'A1',
      colorMode: 'Full Color',
      media: 'Glossy',
      sides: 'Front Only',
      binding: 'None'
    }
  },
  {
    orderId: 'ORD-10005',
    customerName: 'Customer usr_001',
    status: 'On the Way',
    date: 'Mar 24, 2026',
    price: 3000.00,
    deliveryFee: 100.00,
    paymentLabel: 'GCash • Paid',
    fileName: 'marketing_poster.pdf',
    quantity: 20,
    specs: {
      category: 'Poster',
      paperSize: 'A3',
      colorMode: 'Full Color',
      media: 'Glossy',
      sides: 'Front Only',
      binding: 'None'
    }
  },
  {
    orderId: 'ORD-10006',
    customerName: 'Customer usr_001',
    status: 'Delivered',
    date: 'Mar 20, 2026',
    price: 200.00,
    deliveryFee: 80.00,
    paymentLabel: 'Maya • Paid',
    fileName: 'contract.pdf',
    quantity: 2,
    specs: {
      category: 'Document',
      paperSize: 'A4',
      colorMode: 'Black & White',
      media: 'Matte',
      sides: 'Back-to-Back',
      binding: 'Spiral'
    }
  },
  {
    orderId: 'ORD-10007',
    customerName: 'Customer usr_001',
    status: 'Quality Checked',
    date: 'Mar 23, 2026',
    price: 1200.00,
    deliveryFee: 80.00,
    paymentLabel: 'GCash • Paid',
    fileName: 'keychain.stl',
    quantity: 10,
    specs: {
      category: '3D Print',
      fileFormat: 'STL',
      material: 'PLA',
      color: 'Red',
      infill: '80%',
      layerHeight: '0.2mm'
    }
  }
];
