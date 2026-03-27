import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/routes/page_transitions.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
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
// Navigation keys (keep shell state across navigations)
// ---------------------------------------------------------------------------
final _rootNavigatorKey = GlobalKey<NavigatorState>();

// ---------------------------------------------------------------------------
// Router provider
// ---------------------------------------------------------------------------
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/splash',
    debugLogDiagnostics: true,
    redirect: (context, state) {
      final isAuth = authState.status == AuthStatus.authenticated;
      final isProfileIncomplete =
          authState.status == AuthStatus.profileIncomplete;
      final isOnAuth = state.matchedLocation.startsWith('/auth');
      final isOnSplash = state.matchedLocation == '/splash';

      // Let the splash screen through without redirect
      if (isOnSplash) return null;

      // Unauthenticated users must go to login
      if (!isAuth && !isProfileIncomplete && !isOnAuth) {
        return '/auth/login';
      }

      // Incomplete profile users must complete profile
      if (isProfileIncomplete &&
          !state.matchedLocation.contains('profile-setup')) {
        return '/auth/profile-setup';
      }

      // Authenticated users on auth pages get redirected to their role home
      if (isAuth && isOnAuth) {
        switch (authState.user!.role) {
          case 'customer':
            return '/customer/home';
          case 'driver':
            return '/driver/deliveries';
          case 'admin':
            return '/admin/dashboard';
        }
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
        pageBuilder: (_, state) =>
            fadeTransition(const ProfileSetupScreen(), state),
      ),

      // -----------------------------------------------------------------------
      // Customer shell (4 tabs: Home, Orders, Notifications, Profile)
      // -----------------------------------------------------------------------
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => ScaffoldWithNav(
          currentIndex: navigationShell.currentIndex,
          onTap: (i) => navigationShell.goBranch(
            i,
            initialLocation: i == navigationShell.currentIndex,
          ),
          items: const [
            NavItem(
              icon: Icons.home_outlined,
              activeIcon: Icons.home_rounded,
              label: 'Home',
            ),
            NavItem(
              icon: Icons.receipt_long_outlined,
              activeIcon: Icons.receipt_long_rounded,
              label: 'Orders',
            ),
            NavItem(
              icon: Icons.notifications_none_rounded,
              activeIcon: Icons.notifications_rounded,
              label: 'Alerts',
            ),
            NavItem(
              icon: Icons.person_outline_rounded,
              activeIcon: Icons.person_rounded,
              label: 'Profile',
            ),
          ],
          child: navigationShell,
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

      // -----------------------------------------------------------------------
      // Driver shell (3 tabs: Deliveries, History, Profile)
      // -----------------------------------------------------------------------
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => ScaffoldWithNav(
          currentIndex: navigationShell.currentIndex,
          onTap: (i) => navigationShell.goBranch(
            i,
            initialLocation: i == navigationShell.currentIndex,
          ),
          items: const [
            NavItem(
              icon: Icons.local_shipping_outlined,
              activeIcon: Icons.local_shipping_rounded,
              label: 'Deliveries',
            ),
            NavItem(
              icon: Icons.history_rounded,
              activeIcon: Icons.history_rounded,
              label: 'History',
            ),
            NavItem(
              icon: Icons.person_outline_rounded,
              activeIcon: Icons.person_rounded,
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
          onTap: (i) => navigationShell.goBranch(
            i,
            initialLocation: i == navigationShell.currentIndex,
          ),
          items: const [
            NavItem(
              icon: Icons.dashboard_outlined,
              activeIcon: Icons.dashboard_rounded,
              label: 'Dashboard',
            ),
            NavItem(
              icon: Icons.list_alt_rounded,
              activeIcon: Icons.list_alt_rounded,
              label: 'Queue',
            ),
            NavItem(
              icon: Icons.person_outline_rounded,
              activeIcon: Icons.person_rounded,
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
