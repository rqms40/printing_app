import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/providers/order_checkout_provider.dart';

void main() {
  test('addGroup creates a new destination group', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(orderCheckoutProvider.notifier);
    notifier.addGroup('Office');
    expect(container.read(orderCheckoutProvider).groups, hasLength(1));
    expect(container.read(orderCheckoutProvider).groups.first.label, 'Office');
  });

  test('togglePriority flips the flag', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(orderCheckoutProvider.notifier);
    expect(container.read(orderCheckoutProvider).priority, false);
    notifier.togglePriority();
    expect(container.read(orderCheckoutProvider).priority, true);
  });

  test('selectSlot saves templateId and date', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(orderCheckoutProvider.notifier);
    notifier.selectSlot(templateId: 2, date: '2026-04-30');
    final state = container.read(orderCheckoutProvider);
    expect(state.slotTemplateId, 2);
    expect(state.slotDate, '2026-04-30');
  });

  test('reset clears all fields', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(orderCheckoutProvider.notifier);
    notifier.addGroup('A');
    notifier.togglePriority();
    notifier.selectSlot(templateId: 1, date: '2026-04-30');
    notifier.reset();
    final state = container.read(orderCheckoutProvider);
    expect(state.groups, isEmpty);
    expect(state.priority, false);
    expect(state.slotTemplateId, isNull);
  });
}
