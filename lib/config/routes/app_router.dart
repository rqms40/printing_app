import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/shared/widgets/app_bottom_nav.dart';
import 'package:printing_app/shared/widgets/scaffold_with_nav.dart';

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
    initialLocation: '/auth/login',
    debugLogDiagnostics: true,
    redirect: (context, state) {
      final isAuth = authState.status == AuthStatus.authenticated;
      final isProfileIncomplete =
          authState.status == AuthStatus.profileIncomplete;
      final isOnAuth = state.matchedLocation.startsWith('/auth');

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
      // Auth routes
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/auth/login',
        builder: (_, _) => const LoginScreen(),
      ),
      GoRoute(
        path: '/auth/register',
        builder: (_, _) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/auth/profile-setup',
        builder: (_, _) => const ProfileSetupScreen(),
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
              icon: Iconsax.home_2,
              activeIcon: Iconsax.home_1,
              label: 'Home',
            ),
            NavItem(
              icon: Iconsax.document_text,
              activeIcon: Iconsax.document_text_1,
              label: 'Orders',
            ),
            NavItem(
              icon: Iconsax.notification,
              activeIcon: Iconsax.notification_1,
              label: 'Alerts',
            ),
            NavItem(
              icon: Iconsax.user,
              activeIcon: Iconsax.user_tick,
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
                    builder: (_, state) => OrderDetailScreen(
                      orderId: state.pathParameters['id']!,
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
        builder: (_, _) => const CategoryScreen(),
      ),
      GoRoute(
        path: '/customer/order/paper-specs',
        builder: (_, _) => const PaperSpecsScreen(),
      ),
      GoRoute(
        path: '/customer/order/3d-specs',
        builder: (_, _) => const ThreeDSpecsScreen(),
      ),
      GoRoute(
        path: '/customer/order/upload',
        builder: (_, _) => const UploadScreen(),
      ),
      GoRoute(
        path: '/customer/order/summary',
        builder: (_, _) => const SummaryScreen(),
      ),
      GoRoute(
        path: '/customer/order/delivery',
        builder: (_, _) => const DeliveryDetailsScreen(),
      ),
      GoRoute(
        path: '/customer/order/payment',
        builder: (_, _) => const PaymentScreen(),
      ),
      GoRoute(
        path: '/customer/orders/:id/track',
        builder: (_, state) => const DeliveryTrackingScreen(),
      ),
      GoRoute(
        path: '/customer/addresses',
        builder: (_, _) => const AddressListScreen(),
      ),
      GoRoute(
        path: '/customer/addresses/new',
        builder: (_, _) => const AddressPickerScreen(),
      ),
      GoRoute(
        path: '/customer/profile/account',
        builder: (_, _) => const AccountDetailsScreen(),
      ),
      GoRoute(
        path: '/customer/profile/support',
        builder: (_, _) => const SupportScreen(),
      ),
      GoRoute(
        path: '/customer/profile/terms',
        builder: (_, _) => const TermsScreen(),
      ),
      GoRoute(
        path: '/customer/profile/privacy',
        builder: (_, _) => const PrivacyScreen(),
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
              icon: Iconsax.truck,
              activeIcon: Iconsax.truck_tick,
              label: 'Deliveries',
            ),
            NavItem(
              icon: Iconsax.clock,
              activeIcon: Iconsax.timer_1,
              label: 'History',
            ),
            NavItem(
              icon: Iconsax.user,
              activeIcon: Iconsax.user_tick,
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
        builder: (_, state) => DeliveryDetailScreen(
          assignmentId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/driver/deliveries/:id/active',
        builder: (_, state) => const ActiveDeliveryScreen(),
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
              icon: Iconsax.chart_2,
              activeIcon: Iconsax.chart_21,
              label: 'Dashboard',
            ),
            NavItem(
              icon: Iconsax.task_square,
              activeIcon: Iconsax.task,
              label: 'Queue',
            ),
            NavItem(
              icon: Iconsax.user,
              activeIcon: Iconsax.user_tick,
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
        builder: (_, state) => AdminOrderDetailScreen(
          orderId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/admin/drivers',
        builder: (_, _) => const DriverAssignmentScreen(),
      ),
    ],
  );
});
