String? riderMessageRouteForPayload(Map<String, dynamic> payload) {
  final nested = payload['metadata'];
  final metadata = nested is Map
      ? <String, dynamic>{...payload, ...Map<String, dynamic>.from(nested)}
      : payload;
  if (metadata['type'] != 'rider_message' ||
      metadata['conversationType'] != 'rider') {
    return null;
  }

  final rawConversationId = metadata['conversationId'];
  final conversationId = rawConversationId is int
      ? rawConversationId
      : int.tryParse(rawConversationId?.toString() ?? '');
  if (conversationId == null || conversationId <= 0) return null;

  return '/customer/chat/$conversationId?type=rider';
}
