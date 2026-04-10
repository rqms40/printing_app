import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter/foundation.dart';
import 'token_storage.dart';

/// Centralized WebSocket service for real-time order and location updates.
class WebSocketService {
  static final instance = WebSocketService._();
  WebSocketService._();

  io.Socket? _ordersSocket;
  io.Socket? _locationSocket;

  String get _baseUrl {
    const String kServerUrl = String.fromEnvironment('SERVER_URL', defaultValue: '');
    if (kServerUrl.isNotEmpty) return kServerUrl;
    if (kIsWeb) return 'http://192.168.40.201:3000';
    final isAndroid = !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
    return isAndroid ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }

  Future<void> connectOrders(
      {required Function(dynamic) onOrderUpdate}) async {
    final token = await TokenStorage.getToken();
    _ordersSocket = io.io(
      '$_baseUrl/ws/orders',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token ?? ''})
          .build(),
    );
    _ordersSocket!.on('orderUpdate', onOrderUpdate);
    _ordersSocket!
        .on('connect', (_) => debugPrint('WS Orders connected'));
    _ordersSocket!
        .on('connect_error', (e) => debugPrint('WS Orders error: $e'));
  }

  void subscribeToOrder(String orderId) {
    _ordersSocket?.emit('subscribe', orderId);
  }

  Future<void> connectLocation(
      {required Function(dynamic) onLocationUpdate}) async {
    final token = await TokenStorage.getToken();
    _locationSocket = io.io(
      '$_baseUrl/ws/location',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token ?? ''})
          .build(),
    );
    _locationSocket!.on('locationUpdate', onLocationUpdate);
    _locationSocket!
        .on('connect', (_) => debugPrint('WS Location connected'));
    _locationSocket!
        .on('connect_error', (e) => debugPrint('WS Location error: $e'));
  }

  void subscribeToDelivery(String assignmentId) {
    _locationSocket?.emit('subscribe', assignmentId);
  }

  void sendDriverLocation(Map<String, dynamic> location) {
    _locationSocket?.emit('updateLocation', location);
  }

  void disconnect() {
    _ordersSocket?.disconnect();
    _locationSocket?.disconnect();
  }
}
