import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/routes/page_transitions.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';
import 'package:printing_app/features/auth/models/registration_draft.dart';
import 'package:printing_app/features/customer/profile/models/account_state.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/models/address.dart';
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
import 'package:printing_app/features/auth/screens/beta_welcome_screen.dart';
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
import 'package:printing_app/features/customer/order/screens/product_screen.dart';
import 'package:printing_app/features/customer/order/navigation/legacy_order_route_guard.dart';
import 'package:printing_app/features/customer/order/screens/paper_specs_screen.dart';
import 'package:printing_app/features/customer/order/screens/three_d_specs_screen.dart';
import 'package:printing_app/features/customer/order/screens/upload_screen.dart';
import 'package:printing_app/features/customer/order/screens/catalog_requirements_screen.dart';
import 'package:printing_app/features/customer/order/screens/checkout_screen.dart';
import 'package:printing_app/features/customer/order/screens/order_success_screen.dart';
import 'package:printing_app/features/customer/tracking/screens/delivery_tracking_screen.dart';
import 'package:printing_app/features/customer/address/screens/address_list_screen.dart';
import 'package:printing_app/features/customer/address/screens/address_picker_screen.dart';
import 'package:printing_app/features/customer/profile/screens/account_details_screen.dart';
import 'package:printing_app/features/customer/profile/screens/support_screen.dart';
import 'package:printing_app/features/customer/profile/screens/terms_screen.dart';
import 'package:printing_app/features/customer/profile/screens/privacy_screen.dart';
import 'package:printing_app/features/customer/profile/screens/credits_screen.dart';
import 'package:printing_app/features/customer/profile/screens/tam_survey_screen.dart';
import 'package:printing_app/features/customer/profile/screens/required_tam_survey_screen.dart';
import 'package:printing_app/features/customer/profile/screens/storage_settings_screen.dart';
import 'package:printing_app/features/customer/uploads/screens/my_uploads_screen.dart';
import 'package:printing_app/features/customer/order/screens/product_preview_screen.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/features/customer/chat/screens/chat_list_screen.dart';
import 'package:printing_app/features/customer/chat/screens/chat_select_screen.dart';
import 'package:printing_app/features/customer/chat/screens/conversation_screen.dart';

// ---------------------------------------------------------------------------
// Rider screens
// ---------------------------------------------------------------------------
import 'package:printing_app/features/rider/chat/screens/rider_chat_list_screen.dart';
import 'package:printing_app/features/rider/deliveries/screens/deliveries_screen.dart';
import 'package:printing_app/features/rider/deliveries/screens/delivery_detail_screen.dart';
import 'package:printing_app/features/rider/active_delivery/screens/active_delivery_screen.dart';
import 'package:printing_app/features/rider/history/screens/delivery_history_screen.dart';
import 'package:printing_app/features/rider/home/screens/rider_home_screen.dart';
import 'package:printing_app/features/rider/profile/screens/rider_profile_screen.dart';

// ---------------------------------------------------------------------------
// Supplier screens
// ---------------------------------------------------------------------------
import 'package:printing_app/features/supplier/providers/supplier_access_provider.dart';
import 'package:printing_app/features/supplier/screens/supplier_job_detail_screen.dart';
import 'package:printing_app/features/supplier/screens/supplier_jobs_screen.dart';
import 'package:printing_app/features/supplier/screens/supplier_pending_verification_screen.dart';
import 'package:printing_app/features/supplier/screens/supplier_payouts_screen.dart';
import 'package:printing_app/features/supplier/screens/supplier_profile_edit_screen.dart';
import 'package:printing_app/features/supplier/screens/supplier_profile_screen.dart';
import 'package:printing_app/features/supplier/screens/supplier_service_focus_screen.dart';

// ---------------------------------------------------------------------------
// Admin screens
// ---------------------------------------------------------------------------
import 'package:printing_app/features/admin/dashboard/screens/dashboard_screen.dart';
import 'package:printing_app/features/admin/queue/screens/queue_screen.dart';
import 'package:printing_app/features/admin/queue/screens/admin_order_detail_screen.dart';
import 'package:printing_app/features/admin/rider_management/screens/rider_assignment_screen.dart';
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
import 'package:printing_app/shared/services/notification_service.dart';

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
    _ref.listen(betaStatusProvider, (_, _) => notifyListeners());
    _ref.listen(supplierAccessProvider, (_, _) => notifyListeners());
  }
  final Ref _ref;
}

String _roleHome(String? role) => switch (_effectiveRole(role)) {
  'rider' => '/rider/home',
  // Unverified suppliers are redirected to /supplier/pending by router logic.
  'supplier' => '/supplier/jobs',
  'admin' => '/admin/dashboard',
  _ => '/customer/home',
};

/// Map marketplace + legacy API role strings onto shell buckets.
String _effectiveRole(String? role) => switch (role) {
  'rider' => 'rider',
  'supplier' => 'supplier',
  'admin' || 'ops_admin' || 'super_admin' => 'admin',
  // clients (and legacy customers) use the customer shell.
  'client' || 'customer' => 'customer',
  _ => 'customer',
};

bool _isProtectedPathOwnedByRole(String path, String? role) {
  final owner = switch (path) {
    final value when value.startsWith('/customer/') => 'customer',
    final value when value.startsWith('/rider/') => 'rider',
    final value when value.startsWith('/supplier/') => 'supplier',
    final value when value.startsWith('/admin/') => 'admin',
    _ => null,
  };
  return owner == null || owner == _effectiveRole(role);
}

bool _isSafeRoleDeepLink(String? rawLocation, String? role) {
  if (rawLocation == null || rawLocation.isEmpty) return false;
  final target = Uri.tryParse(rawLocation);
  if (target == null || target.hasScheme || target.hasAuthority) return false;
  final path = target.path;
  if (path == '/customer/beta/success-wall' ||
      path == '/customer/beta/locked' ||
      path == '/customer/survey/required') {
    return false;
  }
  return switch (_effectiveRole(role)) {
    'customer' => path.startsWith('/customer/'),
    'rider' => path.startsWith('/rider/'),
    'supplier' => path.startsWith('/supplier/'),
    'admin' => path.startsWith('/admin/'),
    _ => false,
  };
}

bool _isPotentialProtectedDeepLink(Uri uri) {
  final path = uri.path;
  if (path == '/customer/beta/success-wall' ||
      path == '/customer/beta/locked' ||
      path == '/customer/survey/required') {
    return false;
  }
  return path.startsWith('/customer/') ||
      path.startsWith('/rider/') ||
      path.startsWith('/supplier/') ||
      path.startsWith('/admin/');
}

/// Pure redirect policy shared by GoRouter and route-guard regression tests.
String? resolveAppRedirect({
  required Uri uri,
  required AuthState authState,
  required AccountState accountState,
  required bool seenOnboarding,
  bool betaGloballyEnabled = false,
}) {
  final path = uri.path;
  final isAuth = authState.status == AuthStatus.authenticated;
  final isProfileIncomplete = authState.status == AuthStatus.profileIncomplete;
  final isOnAuth = path.startsWith('/auth');
  final isOnSplash = path == '/splash';
  final isOnOnboarding = path == '/onboarding';
  final isOnBetaLocked = path == '/customer/beta/locked';
  final isOnBetaSuccess = path == '/customer/beta/success-wall';

  if (authState.betaLocked != null) {
    return isOnBetaLocked ? null : '/customer/beta/locked';
  }

  if (isOnSplash) {
    final requested = uri.queryParameters['redirect'];
    if (isAuth && _isSafeRoleDeepLink(requested, authState.user?.role)) {
      return requested;
    }
    return null;
  }

  if (isOnBetaSuccess) {
    if (isAuth && authState.betaCompletionJustSubmitted) return null;
    return isAuth ? _roleHome(authState.user?.role) : '/auth/login';
  }
  if (isOnBetaLocked) {
    return isAuth ? _roleHome(authState.user?.role) : '/auth/login';
  }

  // The post-signup beta reveal is shown to freshly-authenticated testers
  // before onboarding; allow it through like /onboarding.
  if (path == '/auth/beta-welcome') {
    return isAuth ? null : '/auth/login';
  }

  final isForcedSurvey = path == '/customer/survey/required';
  if (isForcedSurvey && !isAuth) return '/auth/login';
  if (isAuth &&
      _effectiveRole(authState.user?.role) == 'customer' &&
      accountState.status == AccountGateStatus.surveyRequired) {
    return isForcedSurvey ? null : '/customer/survey/required';
  }
  if (isAuth && !_isProtectedPathOwnedByRole(path, authState.user?.role)) {
    return _roleHome(authState.user?.role);
  }
  if (isForcedSurvey &&
      isAuth &&
      accountState.status != AccountGateStatus.surveyRequired) {
    return '/customer/home';
  }

  if (isOnOnboarding && isAuth) return null;

  if (!isAuth && !isProfileIncomplete && !isOnAuth) {
    if (_isPotentialProtectedDeepLink(uri)) {
      return Uri(
        path: '/auth/login',
        queryParameters: {'redirect': uri.toString()},
      ).toString();
    }
    return '/auth/login';
  }

  if (isProfileIncomplete && !path.contains('profile-setup')) {
    return '/auth/profile-setup';
  }

  if (isAuth && isOnAuth) {
    final requested = uri.queryParameters['redirect'];
    if (_isSafeRoleDeepLink(requested, authState.user?.role)) {
      return requested;
    }
    if (seenOnboarding) return _roleHome(authState.user?.role);
    // A freshly-registered customer in an active beta gets the press-proof
    // reveal instead of the generic onboarding carousel. Routing this here
    // (not via a post-register context.go) makes it deterministic rather than
    // racing the auth-change redirect.
    if (betaGloballyEnabled &&
        _effectiveRole(authState.user?.role) == 'customer') {
      return '/auth/beta-welcome';
    }
    return '/onboarding';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Router provider — created ONCE, refreshes on auth changes
// ---------------------------------------------------------------------------
final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = _AuthChangeNotifier(ref);

  late final GoRouter router;
  router = GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/splash',
    debugLogDiagnostics: true,
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final accountState = ref.read(accountStateProvider);
      final seenOnboarding = ref.read(
        tutorialSeenProvider(TutorialKey.onboarding),
      );
      final betaGloballyEnabled =
          ref.read(betaStatusProvider).valueOrNull?.globallyEnabled ?? false;
      final baseRedirect = resolveAppRedirect(
        uri: state.uri,
        authState: authState,
        accountState: accountState,
        seenOnboarding: seenOnboarding,
        betaGloballyEnabled: betaGloballyEnabled,
      );
      if (baseRedirect != null) return baseRedirect;

      // Supplier access + service-focus onboarding gate.
      if (authState.status == AuthStatus.authenticated &&
          _effectiveRole(authState.user?.role) == 'supplier') {
        final access = ref.read(supplierAccessProvider);
        final path = state.uri.path;
        final onPending = path == '/supplier/pending';
        final onServiceFocus = path == '/supplier/service-focus';
        final onOnboarding = path == '/onboarding';
        if (access.isLoading) {
          if (!onPending &&
              !access.canAccess &&
              !onServiceFocus &&
              !onOnboarding) {
            return '/supplier/pending';
          }
          return null;
        }
        // Service-focus ranking is allowed even while pending verification.
        if (access.needsServiceFocusSetup &&
            !onServiceFocus &&
            !onOnboarding) {
          return '/supplier/service-focus?setup=1';
        }
        if (!access.canAccess && !onPending && !onServiceFocus) {
          return '/supplier/pending';
        }
        if (access.canAccess && onPending) {
          return '/supplier/jobs';
        }
      }
      return null;
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
        path: '/auth/beta-welcome',
        pageBuilder: (_, state) =>
            fadeTransition(const BetaWelcomeScreen(), state),
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
                onTap: (i) {
                  if (i == 2) {
                    ref
                        .read(notificationsProvider.notifier)
                        .refreshNotifications();
                  }
                  navigationShell.goBranch(
                    i,
                    initialLocation: i == navigationShell.currentIndex,
                  );
                },
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
        path: '/customer/order/groups/:groupSlug',
        pageBuilder: (_, state) => slideUpTransition(
          ProductScreen(groupSlug: state.pathParameters['groupSlug'] ?? ''),
          state,
        ),
      ),
      GoRoute(
        path: '/customer/order/products/:productSlug/requirements',
        pageBuilder: (_, state) => slideUpTransition(
          CatalogRequirementsScreen(
            productSlug: state.pathParameters['productSlug'] ?? '',
          ),
          state,
        ),
      ),
      GoRoute(
        path: '/customer/order/paper-specs',
        redirect: (_, _) => resolveLegacyOrderDraftRedirect(
          requestedCategory: 'paper',
          savedDraftCategory: loadSavedLegacyDraftCategory(),
        ),
        pageBuilder: (_, state) =>
            slideUpTransition(const PaperSpecsScreen(), state),
      ),
      GoRoute(
        path: '/customer/order/3d-specs',
        redirect: (_, _) => resolveLegacyOrderDraftRedirect(
          requestedCategory: '3d',
          savedDraftCategory: loadSavedLegacyDraftCategory(),
        ),
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
        path: '/customer/order/preview',
        pageBuilder: (_, state) {
          final extra = (state.extra as Map?) ?? const {};
          final artworkFileId =
              (extra['artworkFileId'] as num?)?.toInt() ?? 0;
          final productType =
              (extra['productType'] as String?) ?? 'flyer';
          final orderId = (extra['orderId'] as num?)?.toInt();
          final categoryHint = extra['categoryHint'] as String?;
          return slideUpTransition(
            ProductPreviewScreen(
              artworkFileId: artworkFileId,
              productType: productType,
              orderId: orderId,
              categoryHint: categoryHint,
            ),
            state,
          );
        },
      ),
      GoRoute(
        path: '/customer/order/success',
        pageBuilder: (_, state) {
          return slideUpTransition(
            OrderSuccessScreen(
              payload: state.extra is OrderSuccessPayload
                  ? state.extra as OrderSuccessPayload
                  : null,
            ),
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
        pageBuilder: (_, state) {
          final existingAddress = state.extra is Address
              ? state.extra as Address
              : null;
          return slideTransition(
            AddressPickerScreen(existingAddress: existingAddress),
            state,
          );
        },
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
        path: '/customer/profile/credits',
        pageBuilder: (_, state) =>
            slideTransition(const CreditsScreen(), state),
      ),
      // Legacy top-up path redirects to Pilot Credits balance/history.
      GoRoute(
        path: '/customer/profile/top-up',
        redirect: (_, __) => '/customer/profile/credits',
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
      // Rider shell (Home, Deliveries, + FAB, Notifications, Profile)
      // -----------------------------------------------------------------------
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => ScaffoldWithNav(
          currentIndex: navigationShell.currentIndex,
          showFab: true,
          navStyle: AppBottomNavStyle.standard,
          quickActions: kRiderQuickActions,
          onTap: (i) => navigationShell.goBranch(
            i,
            initialLocation: i == navigationShell.currentIndex,
          ),
          items: const [
            NavItem(
              icon: HugeIcons.strokeRoundedHome01,
              activeIcon: HugeIcons.strokeRoundedHome01,
              label: 'Home',
            ),
            NavItem(
              icon: HugeIcons.strokeRoundedLeftToRightListDash,
              activeIcon: HugeIcons.strokeRoundedLeftToRightListDash,
              label: 'Deliveries',
            ),
            NavItem(
              icon: HugeIcons.strokeRoundedNotification02,
              activeIcon: HugeIcons.strokeRoundedNotification02,
              label: 'Notifications',
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
                path: '/rider/home',
                builder: (_, _) => const RiderHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/rider/deliveries',
                builder: (_, _) => const DeliveriesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/rider/notifications',
                builder: (_, _) => const NotificationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/rider/profile',
                builder: (_, _) => const RiderProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // -----------------------------------------------------------------------
      // Rider stack routes
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/rider/chat',
        pageBuilder: (_, state) =>
            slideTransition(const RiderChatListScreen(), state),
      ),
      GoRoute(
        path: '/rider/deliveries/:id',
        pageBuilder: (_, state) => slideTransition(
          DeliveryDetailScreen(assignmentId: state.pathParameters['id']!),
          state,
        ),
      ),
      GoRoute(
        path: '/rider/deliveries/:id/active',
        pageBuilder: (_, state) => slideTransition(
          ActiveDeliveryScreen(assignmentId: state.pathParameters['id']),
          state,
        ),
      ),
      GoRoute(
        path: '/rider/history',
        pageBuilder: (_, state) =>
            slideTransition(const DeliveryHistoryScreen(), state),
      ),
      GoRoute(
        path: '/rider/chat/:id',
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
                  : 'Client · $orderStatus',
              backFallback: '/rider/home',
            ),
            state,
          );
        },
      ),

      // -----------------------------------------------------------------------
      // Supplier shell (Jobs + Profile)
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
              icon: HugeIcons.strokeRoundedPackage,
              activeIcon: HugeIcons.strokeRoundedPackage,
              label: 'Jobs',
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
                path: '/supplier/jobs',
                builder: (_, _) => const SupplierJobsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/supplier/profile',
                builder: (_, _) => const SupplierProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // -----------------------------------------------------------------------
      // Supplier stack routes
      // -----------------------------------------------------------------------
      GoRoute(
        path: '/supplier/pending',
        pageBuilder: (_, state) =>
            fadeTransition(const SupplierPendingVerificationScreen(), state),
      ),
      GoRoute(
        path: '/supplier/jobs/:id',
        pageBuilder: (_, state) {
          final raw = state.pathParameters['id'] ?? '';
          final jobId = int.tryParse(raw) ?? 0;
          return slideTransition(
            SupplierJobDetailScreen(jobId: jobId),
            state,
          );
        },
      ),
      GoRoute(
        path: '/supplier/payouts',
        pageBuilder: (_, state) =>
            slideTransition(const SupplierPayoutsScreen(), state),
      ),
      GoRoute(
        path: '/supplier/profile/edit',
        pageBuilder: (_, state) =>
            slideTransition(const SupplierProfileEditScreen(), state),
      ),
      GoRoute(
        path: '/supplier/service-focus',
        pageBuilder: (_, state) {
          final setup = state.uri.queryParameters['setup'] == '1';
          return slideTransition(
            SupplierServiceFocusScreen(requiredSetup: setup),
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
        path: '/admin/riders',
        pageBuilder: (_, state) =>
            scaleTransition(const RiderAssignmentScreen(), state),
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
  void openNotificationRoute(String route) {
    if (ref.read(authProvider).status == AuthStatus.authenticated) {
      router.go(route);
    } else {
      NotificationService.retainPendingRoute(route);
    }
  }

  final routeSubscription = NotificationService.routeStream.listen(
    openNotificationRoute,
  );
  ref.onDispose(routeSubscription.cancel);
  ref.listen(authProvider, (_, next) {
    if (next.status != AuthStatus.authenticated) return;
    final pendingRoute = NotificationService.takePendingRoute();
    if (pendingRoute != null) router.go(pendingRoute);
  });
  return router;
});
