import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/routes/page_transitions.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/models/registration_draft.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/widgets/app_bottom_nav.dart';
import 'package:printing_app/shared/widgets/scaffold_with_nav.dart';

// ---------------------------------------------------------------------------
// Splash screen
// ---------------------------------------------------------------------------
import 'package:printing_app/features/splash/screens/splash_screen.dart';

// ---------------------------------------------------------------------------
// Auth screens
// ---------------------------------------------------------------------------
import 'package:printing_app/features/auth/screens/login_screen.dart';
import 'package:printing_app/features/auth/screens/register_screen.dart';
import 'package:printing_app/features/auth/screens/profile_setup_screen.dart';

// ---------------------------------------------------------------------------
// Customer screens
// ---------------------------------------------------------------------------
import 'package:printing_app/features/customer/home/screens/home_screen.dart';
import 'package:printing_app/features/customer/home/widgets/next_batch_session_trigger.dart';
import 'package:printing_app/features/customer/orders/screens/orders_screen.dart';
import 'package:printing_app/features/customer/orders/screens/order_detail_screen.dart';
import 'package:printing_app/features/customer/notifications/providers/notifications_provider.dart';
import 'package:printing_app/features/customer/notifications/screens/notifications_screen.dart';
import 'package:printing_app/features/customer/profile/screens/profile_screen.dart';
import 'package:printing_app/features/customer/order/screens/category_screen.dart';
import 'package:printing_app/features/customer/order/screens/paper_specs_screen.dart';
import 'package:printing_app/features/customer/order/screens/three_d_specs_screen.dart';
import 'package:printing_app/features/customer/order/screens/upload_screen.dart';
import 'package:printing_app/features/customer/order/screens/checkout_screen.dart';
import 'package:printing_app/features/customer/order/screens/order_success_screen.dart';
import 'package:printing_app/features/customer/tracking/screens/delivery_tracking_screen.dart';
import 'package:printing_app/features/customer/address/screens/address_list_screen.dart';
import 'package:printing_app/features/customer/address/screens/address_picker_screen.dart';
import 'package:printing_app/features/customer/profile/screens/account_details_screen.dart';
import 'package:printing_app/features/customer/profile/screens/support_screen.dart';
import 'package:printing_app/features/customer/profile/screens/terms_screen.dart';
import 'package:printing_app/features/customer/profile/screens/privacy_screen.dart';
import 'package:printing_app/features/customer/profile/screens/top_up_screen.dart';
import 'package:printing_app/features/customer/profile/screens/tam_survey_screen.dart';
import 'package:printing_app/features/customer/profile/screens/required_tam_survey_screen.dart';
import 'package:printing_app/features/customer/profile/screens/storage_settings_screen.dart';
import 'package:printing_app/features/customer/uploads/screens/my_uploads_screen.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/features/customer/chat/screens/chat_list_screen.dart';
import 'package:printing_app/features/customer/chat/screens/chat_select_screen.dart';
import 'package:printing_app/features/customer/chat/screens/conversation_screen.dart';

// ---------------------------------------------------------------------------
// Driver screens
// ---------------------------------------------------------------------------
import 'package:printing_app/features/driver/deliveries/screens/deliveries_screen.dart';
import 'package:printing_app/features/driver/deliveries/screens/delivery_detail_screen.dart';
import 'package:printing_app/features/driver/active_delivery/screens/active_delivery_screen.dart';
import 'package:printing_app/features/driver/history/screens/delivery_history_screen.dart';
import 'package:printing_app/features/driver/profile/screens/driver_profile_screen.dart';

// ---------------------------------------------------------------------------
// Admin screens
// ---------------------------------------------------------------------------
import 'package:printing_app/features/admin/dashboard/screens/dashboard_screen.dart';
import 'package:printing_app/features/admin/queue/screens/queue_screen.dart';
import 'package:printing_app/features/admin/queue/screens/admin_order_detail_screen.dart';
import 'package:printing_app/features/admin/driver_management/screens/driver_assignment_screen.dart';
import 'package:printing_app/features/admin/profile/screens/admin_profile_screen.dart';

// ---------------------------------------------------------------------------
// Beta screens
// ---------------------------------------------------------------------------
import 'package:printing_app/features/customer/beta/screens/beta_success_wall_screen.dart';
import 'package:printing_app/features/customer/beta/screens/beta_locked_screen.dart';

// ---------------------------------------------------------------------------
// Onboarding screen
// ---------------------------------------------------------------------------
import 'package:printing_app/features/onboarding/screens/onboarding_screen.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';

// ---------------------------------------------------------------------------
// Navigation keys (keep shell state across navigations)
// ---------------------------------------------------------------------------
final _rootNavigatorKey = GlobalKey<NavigatorState>();

// ---------------------------------------------------------------------------
// Listenable that notifies GoRouter when auth state changes
// ---------------------------------------------------------------------------
class _AuthChangeNotifier extends ChangeNotifier {
  _AuthChangeNotifier(this._ref) {
    _ref.listen(authProvider, (_, _) => notifyListeners());
    _ref.listen(accountStateProvider, (_, _) => notifyListeners());
  }
  final Ref _ref;
}

// ---------------------------------------------------------------------------
// Router provider — created ONCE, refreshes on auth changes
// ---------------------------------------------------------------------------
final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = _AuthChangeNotifier(ref);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/splash',
    debugLogDiagnostics: true,
    refreshListenable: authNotifier,
    redirect: (context, state) {
      // Read (not watch!) current auth state at redirect time
      final authState = ref.read(authProvider);
      final isAuth = authState.status == AuthStatus.authenticated;
      final isProfileIncomplete =
          authState.status == AuthStatus.profileIncomplete;
      final isOnAuth = state.matchedLocation.startsWith('/auth');
      final isOnSplash = state.matchedLocation == '/splash';
      final isOnOnboarding = state.matchedLocation == '/onboarding';

      // Let the splash screen and onboarding through without redirect
      if (isOnSplash) return null;

      // Beta-locked: redirect to locked screen when on any auth route
      final isBetaLocked = authState.betaLocked != null;
      final isOnBetaLocked = state.matchedLocation == '/customer/beta/locked';
      final isOnBetaSuccess =
          state.matchedLocation == '/customer/beta/success-wall';
      if (isBetaLocked && isOnAuth && !isOnBetaLocked) {
        return '/customer/beta/locked';
      }
      // Allow beta screens to pass through
      if (isOnBetaLocked || isOnBetaSuccess) return null;

      final accountState = ref.read(accountStateProvider);
      final isForcedSurvey =
          state.matchedLocation == '/customer/survey/required';
      if (isForcedSurvey && !isAuth) {
        return '/auth/login';
      }
      if (isAuth && accountState.status == AccountGateStatus.surveyRequired) {
        return isForcedSurvey ? null : '/customer/survey/required';
      }
      if (isForcedSurvey &&
          isAuth &&
          accountState.status != AccountGateStatus.surveyRequired) {
        return '/customer/home';
      }

      if (isOnOnboarding && isAuth) return null;

      // Unauthenticated users must go to login
      if (!isAuth && !isProfileIncomplete && !isOnAuth) {
        return '/auth/login';
      }

      // Incomplete profile users must complete profile
      if (isProfileIncomplete &&
          !state.matchedLocation.contains('profile-setup')) {
        return '/auth/profile-setup';
      }

      // Authenticated users on auth pages go through onboarding first (first login only)
      if (isAuth && isOnAuth) {
        final seenOnboarding = ref.read(
          tutorialSeenProvider(TutorialKey.onboarding),
        );
        if (seenOnboarding) {
          final role = ref.read(authProvider).user?.role ?? 'customer';
          return switch (role) {
            'driver' => '/driver/deliveries',
            'admin' => '/admin/dashboard',
            _ => '/customer/home',
          };
        }
        return '/onboarding';
      }

      return null; // no redirect
    },
    routes: [
      // -----------------------------------------------------------------------
      // Splash screen
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/splash',
        pageBuilder: (_, state) => fadeTransition(const SplashScreen(), state),
      ),

      // -----------------------------------------------------------------------
      // Auth routes
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/auth/login',
        pageBuilder: (_, state) => fadeTransition(const LoginScreen(), state),
      ),
      GoRoute(
        path: '/auth/register',
        pageBuilder: (_, state) =>
            fadeTransition(const RegisterScreen(), state),
      ),
      GoRoute(
        path: '/auth/profile-setup',
        pageBuilder: (_, state) {
          final draft = state.extra is RegistrationDraft
              ? state.extra as RegistrationDraft
              : null;
          return fadeTransition(ProfileSetupScreen(draft: draft), state);
        },
      ),

      // -----------------------------------------------------------------------
      // Onboarding (shown every login, before role home)
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/onboarding',
        pageBuilder: (_, state) =>
            fadeTransition(const OnboardingScreen(), state),
      ),

      // -----------------------------------------------------------------------
      // Customer shell (4 tabs: Home, Orders, Notifications, Profile)
      // -----------------------------------------------------------------------
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => Consumer(
          builder: (context, ref, _) {
            final unreadCount = ref.watch(unreadNotificationsCountProvider);

            // Show a real-time toast when a single new notification arrives
            // via WebSocket (diff > 3 = bulk fetch on startup, skip).
            ref.listen(notificationsProvider, (prev, next) {
              final prevLen = prev?.length ?? -1;
              final diff = next.length - prevLen;
              if (prevLen < 0 || diff <= 0 || diff > 3) return;
              final newest = next.first;
              ScaffoldMessenger.of(context)
                ..clearSnackBars()
                ..showSnackBar(
                  SnackBar(
                    content: Row(
                      children: [
                        const Icon(
                          Icons.notifications_rounded,
                          color: Colors.black,
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                newest.title,
                                style: const TextStyle(
                                  color: Colors.black,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (newest.message.isNotEmpty)
                                Text(
                                  newest.message,
                                  style: const TextStyle(
                                    color: Color(0xFF444444),
                                    fontSize: 11,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    backgroundColor:
                        (Theme.of(context).brightness == Brightness.dark
                                ? AppColors.dark
                                : AppColors.light)
                            .brand,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                    duration: const Duration(seconds: 4),
                  ),
                );
            });

            return NextBatchSessionTrigger(
              child: ScaffoldWithNav(
                currentIndex: navigationShell.currentIndex,
                showFab: true,
                onTap: (i) => navigationShell.goBranch(
                  i,
                  initialLocation: i == navigationShell.currentIndex,
                ),
                items: [
                  const NavItem(
                    icon: HugeIcons.strokeRoundedHome01,
                    activeIcon: HugeIcons.strokeRoundedHome01,
                    label: 'Home',
                  ),
                  const NavItem(
                    icon: HugeIcons.strokeRoundedPackage,
                    activeIcon: HugeIcons.strokeRoundedPackage,
                    label: 'Orders',
                  ),
                  NavItem(
                    icon: HugeIcons.strokeRoundedNotification02,
                    activeIcon: HugeIcons.strokeRoundedNotification02,
                    label: 'Notifications',
                    badge: unreadCount,
                  ),
                  const NavItem(
                    icon: HugeIcons.strokeRoundedUser,
                    activeIcon: HugeIcons.strokeRoundedUser,
                    label: 'Profile',
                  ),
                ],
                child: navigationShell,
              ),
            );
          },
        ),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/customer/home',
                builder: (_, _) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/customer/orders',
                builder: (_, _) => const OrdersScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    pageBuilder: (_, state) => slideTransition(
                      OrderDetailScreen(orderId: state.pathParameters['id']!),
                      state,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/customer/notifications',
                builder: (_, _) => const NotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/customer/profile',
                builder: (_, _) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // -----------------------------------------------------------------------
      // Customer stack routes (pushed over tabs)
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/customer/order/new',
        pageBuilder: (_, state) => slideUpTransition(
          CategoryScreen(addMode: state.uri.queryParameters['mode'] == 'add'),
          state,
        ),
      ),
      GoRoute(
        path: '/customer/order/paper-specs',
        pageBuilder: (_, state) =>
            slideUpTransition(const PaperSpecsScreen(), state),
      ),
      GoRoute(
        path: '/customer/order/3d-specs',
        pageBuilder: (_, state) =>
            slideUpTransition(const ThreeDSpecsScreen(), state),
      ),
      GoRoute(
        path: '/customer/order/upload',
        pageBuilder: (_, state) =>
            slideUpTransition(const UploadScreen(), state),
      ),
      GoRoute(
        path: '/customer/order/checkout',
        pageBuilder: (_, state) =>
            slideUpTransition(const CheckoutScreen(), state),
      ),
      GoRoute(
        path: '/customer/order/success',
        pageBuilder: (_, state) {
          final extra = (state.extra as Map?) ?? const {};
          final refs =
              (extra['orderRefs'] as List?)?.cast<String>() ?? const <String>[];
          final firstId = extra['firstOrderId'] as int?;
          return slideUpTransition(
            OrderSuccessScreen(orderRefs: refs, firstOrderId: firstId),
            state,
          );
        },
      ),
      GoRoute(
        path: '/customer/orders/:id/track',
        pageBuilder: (_, state) => slideTransition(
          DeliveryTrackingScreen(orderId: state.pathParameters['id']),
          state,
        ),
      ),
      GoRoute(
        path: '/customer/tracking',
        pageBuilder: (_, state) =>
            slideTransition(const DeliveryTrackingScreen(), state),
      ),
      GoRoute(
        path: '/customer/addresses',
        pageBuilder: (_, state) =>
            slideTransition(const AddressListScreen(), state),
      ),
      GoRoute(
        path: '/customer/addresses/new',
        pageBuilder: (_, state) =>
            slideTransition(const AddressPickerScreen(), state),
      ),
      GoRoute(
        path: '/customer/profile/account',
        pageBuilder: (_, state) =>
            slideTransition(const AccountDetailsScreen(), state),
      ),
      GoRoute(
        path: '/customer/profile/support',
        pageBuilder: (_, state) =>
            slideTransition(const SupportScreen(), state),
      ),
      GoRoute(
        path: '/customer/profile/terms',
        pageBuilder: (_, state) => slideTransition(const TermsScreen(), state),
      ),
      GoRoute(
        path: '/customer/profile/privacy',
        pageBuilder: (_, state) =>
            slideTransition(const PrivacyScreen(), state),
      ),
      GoRoute(
        path: '/customer/profile/top-up',
        pageBuilder: (_, state) => slideTransition(const TopUpScreen(), state),
      ),
      GoRoute(
        path: '/customer/profile/survey',
        pageBuilder: (_, state) =>
            slideTransition(const TamSurveyScreen(), state),
      ),
      GoRoute(
        path: '/customer/survey/required',
        pageBuilder: (_, state) =>
            fadeTransition(const RequiredTamSurveyScreen(), state),
      ),
      GoRoute(
        path: StorageSettingsScreen.routeName,
        pageBuilder: (_, state) =>
            slideTransition(const StorageSettingsScreen(), state),
      ),
      GoRoute(
        path: '/customer/uploads',
        pageBuilder: (_, state) =>
            slideTransition(const MyUploadsScreen(), state),
      ),
      GoRoute(
        path: '/customer/chat',
        pageBuilder: (_, state) =>
            slideTransition(const ChatListScreen(), state),
      ),
      GoRoute(
        path: '/customer/chat/new',
        pageBuilder: (_, state) {
          final orderIdStr = state.uri.queryParameters['orderId'];
          final orderId = orderIdStr != null ? int.tryParse(orderIdStr) : null;
          return slideUpTransition(
            ChatSelectScreen(
              orderId: orderId,
              draftMessage: state.uri.queryParameters['draft'],
            ),
            state,
          );
        },
      ),
      GoRoute(
        path: '/customer/chat/:id',
        pageBuilder: (_, state) {
          final id = int.parse(state.pathParameters['id']!);
          final typeStr = state.uri.queryParameters['type'] ?? 'admin';
          final type = ConversationType.values.firstWhere(
            (t) => t.name == typeStr,
            orElse: () => ConversationType.admin,
          );
          final orderRef = state.uri.queryParameters['orderRef'];
          final orderStatus = state.uri.queryParameters['orderStatus'];
          return slideTransition(
            ConversationScreen(
              conversationId: id,
              conversationType: type,
              titleOverride: orderRef == null ? null : 'Order $orderRef',
              subtitleOverride: orderStatus == null
                  ? null
                  : '${type == ConversationType.rider ? 'Rider' : 'Support'} · $orderStatus',
            ),
            state,
          );
        },
      ),
      // -----------------------------------------------------------------------
      // Driver shell (3 tabs: Deliveries, History, Profile)
      // -----------------------------------------------------------------------
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => ScaffoldWithNav(
          currentIndex: navigationShell.currentIndex,
          showFab: false,
          onTap: (i) => navigationShell.goBranch(
            i,
            initialLocation: i == navigationShell.currentIndex,
          ),
          items: const [
            NavItem(
              icon: HugeIcons.strokeRoundedDeliveryTruck02,
              activeIcon: HugeIcons.strokeRoundedDeliveryTruck02,
              label: 'Deliveries',
            ),
            NavItem(
              icon: HugeIcons.strokeRoundedClock01,
              activeIcon: HugeIcons.strokeRoundedClock01,
              label: 'History',
            ),
            NavItem(
              icon: HugeIcons.strokeRoundedUser,
              activeIcon: HugeIcons.strokeRoundedUser,
              label: 'Profile',
            ),
          ],
          child: navigationShell,
        ),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/driver/deliveries',
                builder: (_, _) => const DeliveriesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/driver/history',
                builder: (_, _) => const DeliveryHistoryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/driver/profile',
                builder: (_, _) => const DriverProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // -----------------------------------------------------------------------
      // Driver stack routes
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/driver/deliveries/:id',
        pageBuilder: (_, state) => slideTransition(
          DeliveryDetailScreen(assignmentId: state.pathParameters['id']!),
          state,
        ),
      ),
      GoRoute(
        path: '/driver/deliveries/:id/active',
        pageBuilder: (_, state) =>
            slideTransition(const ActiveDeliveryScreen(), state),
      ),
      GoRoute(
        path: '/driver/chat/:id',
        pageBuilder: (_, state) {
          final id = int.parse(state.pathParameters['id']!);
          final typeStr = state.uri.queryParameters['type'] ?? 'rider';
          final type = ConversationType.values.firstWhere(
            (t) => t.name == typeStr,
            orElse: () => ConversationType.rider,
          );
          final orderRef = state.uri.queryParameters['orderRef'];
          final orderStatus = state.uri.queryParameters['orderStatus'];
          return slideTransition(
            ConversationScreen(
              conversationId: id,
              conversationType: type,
              currentUserRole: SenderRole.rider,
              titleOverride: orderRef == null ? null : 'Order $orderRef',
              subtitleOverride: orderStatus == null
                  ? null
                  : 'Customer · $orderStatus',
              backFallback: '/driver/deliveries',
            ),
            state,
          );
        },
      ),

      // -----------------------------------------------------------------------
      // Admin shell (3 tabs: Dashboard, Queue, Profile)
      // -----------------------------------------------------------------------
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => ScaffoldWithNav(
          currentIndex: navigationShell.currentIndex,
          showFab: false,
          onTap: (i) => navigationShell.goBranch(
            i,
            initialLocation: i == navigationShell.currentIndex,
          ),
          items: const [
            NavItem(
              icon: HugeIcons.strokeRoundedDashboardSquare01,
              activeIcon: HugeIcons.strokeRoundedDashboardSquare01,
              label: 'Dashboard',
            ),
            NavItem(
              icon: HugeIcons.strokeRoundedFile02,
              activeIcon: HugeIcons.strokeRoundedFile02,
              label: 'Queue',
            ),
            NavItem(
              icon: HugeIcons.strokeRoundedUser,
              activeIcon: HugeIcons.strokeRoundedUser,
              label: 'Profile',
            ),
          ],
          child: navigationShell,
        ),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/dashboard',
                builder: (_, _) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/queue',
                builder: (_, _) => const QueueScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/profile',
                builder: (_, _) => const AdminProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // -----------------------------------------------------------------------
      // Admin stack routes
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/admin/queue/:id',
        pageBuilder: (_, state) => scaleTransition(
          AdminOrderDetailScreen(orderId: state.pathParameters['id']!),
          state,
        ),
      ),
      GoRoute(
        path: '/admin/drivers',
        pageBuilder: (_, state) =>
            scaleTransition(const DriverAssignmentScreen(), state),
      ),

      // -----------------------------------------------------------------------
      // Beta completion screens
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/customer/beta/success-wall',
        pageBuilder: (_, state) =>
            fadeTransition(const BetaSuccessWallScreen(), state),
      ),
      GoRoute(
        path: '/customer/beta/locked',
        pageBuilder: (_, state) =>
            fadeTransition(const BetaLockedScreen(), state),
      ),
    ],
  );
});
