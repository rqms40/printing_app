class DeliverySlot {
  const DeliverySlot({
    required this.templateId,
    required this.startTime,
    required this.endTime,
    required this.capacity,
    required this.bookedCount,
  });

  final int templateId;
  final String startTime;
  final String endTime;
  final int capacity;
  final int bookedCount;

  bool get isFull => bookedCount >= capacity;

  factory DeliverySlot.fromJson(Map<String, dynamic> json) => DeliverySlot(
        templateId: json['templateId'] as int,
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
        capacity: json['capacity'] as int,
        bookedCount: json['bookedCount'] as int,
      );

  DeliverySlot copyWith({int? bookedCount}) => DeliverySlot(
        templateId: templateId,
        startTime: startTime,
        endTime: endTime,
        capacity: capacity,
        bookedCount: bookedCount ?? this.bookedCount,
      );
}
