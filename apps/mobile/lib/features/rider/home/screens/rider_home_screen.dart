import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:intl/intl.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/home/widgets/rider_active_stop_card.dart';
import 'package:printing_app/features/rider/home/widgets/rider_branding_banner.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_panel.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';
import 'package:url_launcher/url_launcher.dart';

/// Rider home cockpit — visual target: screenshots-for-agents/rider-UI.png
class RiderHomeScreen extends ConsumerWidget {
  const RiderHomeScreen({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  Future<void> _openChat(
    BuildContext context,
    WidgetRef ref,
    RiderAssignmentView view,
  ) async {
    final order = view.order;
    final apiOrderRef = int.tryParse(order.orderInternalId) == null
        ? order.orderRef
        : order.orderInternalId;
    final conv = await ref
        .read(chatProvider.notifier)
        .openOrderConversation(apiOrderRef);
    if (!context.mounted || conv == null) return;
    context.push(
      '/rider/chat/${conv.id}?type=${conv.type.name}&orderRef=${order.orderRef}',
    );
  }

  Future<void> _call(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final state = ref.watch(deliveriesProvider);
    final firstName = (auth.user?.fullName ?? 'Rider').split(' ').first;

    final routeStops = state.routeStops;

    final active = state.activeDelivery;
    final dateLine = DateFormat(
      'EEEE, MMMM d',
    ).format(DateTime.now()).toUpperCase();

    return ColoredBox(
      color: RiderTheme.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 14, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 13),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            dateLine,
                            style: AppTypography.overline.copyWith(
                              color: RiderTheme.textPrimary,
                              letterSpacing: 0,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          RichText(
                            text: TextSpan(
                              style: AppTypography.h2.copyWith(
                                color: RiderTheme.textPrimary,
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0,
                              ),
                              children: [
                                TextSpan(text: '${_greeting()}, '),
                                TextSpan(
                                  text: firstName,
                                  style: const TextStyle(
                                    color: RiderTheme.yellow,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  _HeaderIconButton(
                    icon: HugeIcons.strokeRoundedNotification02,
                    onTap: () => context.go('/rider/alerts'),
                  ),
                  const SizedBox(width: 4),
                  _HeaderIconButton(
                    icon: HugeIcons.strokeRoundedSettings01,
                    onTap: () => context.go('/rider/profile'),
                  ),
                ],
              ),
            ),

            const RiderBrandingBanner(),
            const SizedBox(height: 10),

            RiderRouteMapPanel(stops: routeStops, activeStop: active),

            if (active != null)
              RiderActiveStopCard(
                view: active,
                onTap: () =>
                    context.push('/rider/deliveries/${active.id}/active'),
                onCall: () => _call(active.order.customerPhone),
                onMessage: () => _openChat(context, ref, active),
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                child: Text(
                  'No active stop — check Orders for new assignments.',
                  style: AppTypography.caption.copyWith(
                    color: RiderTheme.textMuted,
                  ),
                ),
              ),

            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({required this.icon, required this.onTap});

  final dynamic icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 22,
          height: 22,
          child: Center(
            child: HugeIcon(icon: icon, color: Colors.black, size: 14),
          ),
        ),
      ),
    );
  }
}
