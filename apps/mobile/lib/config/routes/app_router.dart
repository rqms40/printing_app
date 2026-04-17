import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/routes/page_transitions.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/models/registration_draft.dart';
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
import 'package:printing_app/features/customer/orders/screens/orders_screen.dart';
import 'package:printing_app/features/customer/orders/screens/order_detail_screen.dart';
import 'package:printing_app/features/customer/notifications/providers/notifications_provider.dart';
import 'package:printing_app/features/customer/notifications/screens/notifications_screen.dart';
import 'package:printing_app/features/customer/profile/screens/profile_screen.dart';
import 'package:printing_app/features/customer/order/screens/category_screen.dart';
import 'package:printing_app/features/customer/order/screens/paper_specs_screen.dart';
import 'package:printing_app/features/customer/order/screens/three_d_specs_screen.dart';
import 'package:printing_app/features/customer/order/screens/upload_screen.dart';
import 'package:printing_app/features/customer/order/screens/summary_screen.dart';
import 'package:printing_app/features/customer/order/screens/delivery_details_screen.dart';
import 'package:printing_app/features/customer/order/screens/payment_screen.dart';
import 'package:printing_app/features/customer/tracking/screens/delivery_tracking_screen.dart';
import 'package:printing_app/features/customer/address/screens/address_list_screen.dart';
import 'package:printing_app/features/customer/address/screens/address_picker_screen.dart';
import 'package:printing_app/features/customer/profile/screens/account_details_screen.dart';
import 'package:printing_app/features/customer/profile/screens/support_screen.dart';
import 'package:printing_app/features/customer/profile/screens/terms_screen.dart';
import 'package:printing_app/features/customer/profile/screens/privacy_screen.dart';
import 'package:printing_app/features/customer/profile/screens/top_up_screen.dart';
import 'package:printing_app/features/customer/profile/screens/tam_survey_screen.dart';

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
// Onboarding screen
// ---------------------------------------------------------------------------
import 'package:printing_app/features/onboarding/screens/onboarding_screen.dart';

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

      // Authenticated users on auth pages go through onboarding first
      if (isAuth && isOnAuth) {
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
        pageBuilder: (_, state) =>
            fadeTransition(const SplashScreen(), state),
      ),

      // -----------------------------------------------------------------------
      // Auth routes
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/auth/login',
        pageBuilder: (_, state) =>
            fadeTransition(const LoginScreen(), state),
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
                        const Icon(Icons.notifications_rounded,
                            color: Colors.black, size: 16),
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
                    backgroundColor: const Color(0xFFFFDE58),
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                    duration: const Duration(seconds: 4),
                  ),
                );
            });

            return ScaffoldWithNav(
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
                      OrderDetailScreen(
                        orderId: state.pathParameters['id']!,
                      ),
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
        pageBuilder: (_, state) =>
            slideUpTransition(const CategoryScreen(), state),
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
        path: '/customer/order/summary',
        pageBuilder: (_, state) =>
            slideUpTransition(const SummaryScreen(), state),
      ),
      GoRoute(
        path: '/customer/order/delivery',
        pageBuilder: (_, state) =>
            slideUpTransition(const DeliveryDetailsScreen(), state),
      ),
      GoRoute(
        path: '/customer/order/payment',
        pageBuilder: (_, state) =>
            slideUpTransition(const PaymentScreen(), state),
      ),
      GoRoute(
        path: '/customer/orders/:id/track',
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
        pageBuilder: (_, state) =>
            slideTransition(const TermsScreen(), state),
      ),
      GoRoute(
        path: '/customer/profile/privacy',
        pageBuilder: (_, state) =>
            slideTransition(const PrivacyScreen(), state),
      ),
      GoRoute(
        path: '/customer/profile/top-up',
        pageBuilder: (_, state) =>
            slideTransition(const TopUpScreen(), state),
      ),
      GoRoute(
        path: '/customer/profile/survey',
        pageBuilder: (_, state) =>
            slideTransition(const TamSurveyScreen(), state),
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
          DeliveryDetailScreen(
            assignmentId: state.pathParameters['id']!,
          ),
          state,
        ),
      ),
      GoRoute(
        path: '/driver/deliveries/:id/active',
        pageBuilder: (_, state) =>
            slideTransition(const ActiveDeliveryScreen(), state),
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
          AdminOrderDetailScreen(
            orderId: state.pathParameters['id']!,
          ),
          state,
        ),
      ),
      GoRoute(
        path: '/admin/drivers',
        pageBuilder: (_, state) =>
            scaleTransition(const DriverAssignmentScreen(), state),
      ),
    ],
  );
});
