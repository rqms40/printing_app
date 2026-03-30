importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBo0cT2CVQzrZjkwXffimq1P6_Ou336lvs',
  appId: '1:3582834609:web:2665e1502aedf42e862f90',
  messagingSenderId: '3582834609',
  projectId: 'grid-print-85681',
  authDomain: 'grid-print-85681.firebaseapp.com',
  storageBucket: 'grid-print-85681.firebasestorage.app',
  measurementId: 'G-X5M3XNCKYV',
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'GRID';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icons/Icon-192.png',
    badge: '/icons/Icon-192.png',
  };
  return self.registration.showNotification(title, options);
});
