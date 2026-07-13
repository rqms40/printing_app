import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';

/// Static hero block for BetaSuccessWallScreen.
///
/// Near-black radial gradient background with a glowing printer badge
/// and "FOUNDING TESTER" pill centred.
class BetaHeroIllustration extends StatelessWidget {
  const BetaHeroIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 260,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Near-black base with faint amber radial warmth
          Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, 0.15),
                radius: 0.8,
                colors: [
                  Color(0xFF1C1300),
                  Color(0xFF0A0A0A),
                ],
              ),
            ),
          ),

          // Badge + label centred
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Glowing yellow badge with printer icon
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFFFDE58),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFFDE58).withValues(alpha: 0.35),
                      blurRadius: 28,
                      spreadRadius: 6,
                    ),
                  ],
                ),
                child: const Center(
                  child: ExcludeSemantics(
                    child: HugeIcon(
                      icon: HugeIcons.strokeRoundedPrinter,
                      size: 36,
                      color: Color(0xFF0A0A0A),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              // "FOUNDING TESTER" outlined pill
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: const Color(0xFFFFDE58).withValues(alpha: 0.45),
                  ),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'FOUNDING TESTER',
                  style: TextStyle(
                    fontFamily: 'Satoshi',
                    color: Color(0xFFFFDE58),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 3.5,
                  ),
                ),
              ),
            ],
          ),

          // Bottom fade into the page background
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: 72,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0xFF0A0A0A)],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
