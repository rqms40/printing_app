/// Data model for a single onboarding page and role-specific page content.
class OnboardingPageData {
  const OnboardingPageData({
    required this.overline,
    required this.heading,
    required this.body,
    required this.illustrationType,
  });

  /// Uppercase label displayed above the heading (e.g. "PRINT WITH EASE").
  final String overline;

  /// Bold heading text.
  final String heading;

  /// Supporting body text.
  final String body;

  /// Which illustration to render. Mapped to widgets in the screen.
  final OnboardingIllustration illustrationType;

  // ---------------------------------------------------------------------------
  // Role-specific page lists
  // ---------------------------------------------------------------------------

  /// Customer onboarding: order → track → batch delivery → pay → notifications.
  static const List<OnboardingPageData> customer = [
    OnboardingPageData(
      overline: 'PRINT WITH EASE',
      heading: 'Place your order\nin minutes',
      body:
          'Choose paper or 3D printing, set your specs, '
          'upload your file — and we handle the rest.',
      illustrationType: OnboardingIllustration.printer,
    ),
    OnboardingPageData(
      overline: 'REAL-TIME TRACKING',
      heading: 'Know exactly where\nyour print is',
      body:
          'Track your order from production to your doorstep '
          'with live driver GPS tracking.',
      illustrationType: OnboardingIllustration.delivery,
    ),
    OnboardingPageData(
      overline: 'BATCH DELIVERY',
      heading: 'One order,\nmultiple stops',
      body:
          'Send your prints to different addresses in a single '
          'order — one driver handles all deliveries.',
      illustrationType: OnboardingIllustration.multiStop,
    ),
    OnboardingPageData(
      overline: 'FLEXIBLE PAYMENTS',
      heading: 'Pay your way',
      body:
          'GCash, Maya, Cash on Delivery, or GRID Credits '
          '— choose what works for you.',
      illustrationType: OnboardingIllustration.payment,
    ),
    OnboardingPageData(
      overline: 'STAY UPDATED',
      heading: 'Never miss\nan update',
      body:
          'Enable notifications to get real-time alerts '
          'on your order status, delivery, and promos.',
      illustrationType: OnboardingIllustration.notification,
    ),
  ];

  /// Driver onboarding: deliveries → checkpoints → location → earnings → notifications.
  static const List<OnboardingPageData> driver = [
    OnboardingPageData(
      overline: 'DELIVERIES',
      heading: 'Manage your\nassigned pickups',
      body:
          'View order details, customer info, and delivery '
          'addresses — all in one place.',
      illustrationType: OnboardingIllustration.delivery,
    ),
    OnboardingPageData(
      overline: 'NAVIGATE & UPDATE',
      heading: 'Update status at\nevery checkpoint',
      body:
          'Picked up, on the way, arrived, delivered '
          '— keep customers informed with one tap.',
      illustrationType: OnboardingIllustration.locationPin,
    ),
    OnboardingPageData(
      overline: 'ENABLE LOCATION',
      heading: 'Let customers\nsee you coming',
      body:
          'Turn on location services so customers can track '
          'your live position during delivery.',
      illustrationType: OnboardingIllustration.gpsLocation,
    ),
    OnboardingPageData(
      overline: 'EARN & TRACK',
      heading: 'Track your\nearnings',
      body:
          'View your delivery history, daily totals, '
          'and earnings breakdown.',
      illustrationType: OnboardingIllustration.payment,
    ),
    OnboardingPageData(
      overline: 'STAY CONNECTED',
      heading: 'Get notified\ninstantly',
      body:
          'Enable notifications to receive new delivery '
          'assignments and important updates.',
      illustrationType: OnboardingIllustration.notification,
    ),
  ];

  /// Admin onboarding: dashboard → queue → dispatch.
  static const List<OnboardingPageData> admin = [
    OnboardingPageData(
      overline: 'DASHBOARD',
      heading: 'Your business\nat a glance',
      body:
          'Monitor KPIs, revenue trends, and order volume '
          '— all updated in real-time.',
      illustrationType: OnboardingIllustration.printer,
    ),
    OnboardingPageData(
      overline: 'ORDER MANAGEMENT',
      heading: 'Process orders\nefficiently',
      body:
          'Review files, update statuses, and manage the '
          'production queue with filters.',
      illustrationType: OnboardingIllustration.cube3D,
    ),
    OnboardingPageData(
      overline: 'DRIVER DISPATCH',
      heading: 'Assign drivers\nwith one tap',
      body:
          'View available drivers, assign deliveries, '
          'and track them on the map.',
      illustrationType: OnboardingIllustration.delivery,
    ),
  ];

  /// Returns the correct page list for the given [role].
  static List<OnboardingPageData> forRole(String role) {
    switch (role) {
      case 'driver':
        return driver;
      case 'admin':
        return admin;
      default:
        return customer;
    }
  }
}

/// Identifies which CustomPaint illustration to render on the page.
enum OnboardingIllustration {
  printer,
  delivery,
  payment,
  locationPin,
  cube3D,
  multiStop,
  notification,
  gpsLocation,
}
