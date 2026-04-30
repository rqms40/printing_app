import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/shared/models/enums.dart';

/// Branded round glyph for each PaymentMethod.
/// GCash → blue with "G", Maya → green with "M", COD → bill icon, GRID Credits → brand yellow with coin icon.
class PaymentMethodGlyph extends StatelessWidget {
  const PaymentMethodGlyph({super.key, required this.method, this.size = 36});

  final PaymentMethod method;
  final double size;

  @override
  Widget build(BuildContext context) {
    switch (method) {
      case PaymentMethod.gcash:
        return _Glyph.letter(size: size, bg: const Color(0xFF007DFE), letter: 'G');
      case PaymentMethod.maya:
        return _Glyph.letter(size: size, bg: const Color(0xFF00C685), letter: 'M');
      case PaymentMethod.cod:
        return _Glyph.icon(
          size: size,
          bg: const Color(0xFF2A2A2A),
          icon: HugeIcons.strokeRoundedMoneyBag02,
          iconColor: const Color(0xFF7CD992),
        );
      case PaymentMethod.gridCredits:
        return _Glyph.icon(
          size: size,
          bg: const Color(0xFFFFDE58),
          icon: HugeIcons.strokeRoundedCoins01,
          iconColor: Colors.black,
        );
    }
  }
}

class _Glyph extends StatelessWidget {
  const _Glyph._({
    required this.size,
    required this.bg,
    this.letter,
    this.icon,
    this.iconColor,
  });

  factory _Glyph.letter({
    required double size,
    required Color bg,
    required String letter,
  }) =>
      _Glyph._(size: size, bg: bg, letter: letter);

  factory _Glyph.icon({
    required double size,
    required Color bg,
    required List<List<dynamic>> icon,
    required Color iconColor,
  }) =>
      _Glyph._(size: size, bg: bg, icon: icon, iconColor: iconColor);

  final double size;
  final Color bg;
  final String? letter;
  final List<List<dynamic>>? icon;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: letter != null
            ? Text(
                letter!,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: size * 0.46,
                  fontWeight: FontWeight.w800,
                  height: 1.0,
                ),
              )
            : HugeIcon(icon: icon!, size: size * 0.5, color: iconColor!),
      ),
    );
  }
}
