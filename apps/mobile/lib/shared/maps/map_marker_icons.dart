import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Shared marker widget icons used by Google Maps bitmap encoding.
class MapMarkerIcons {
  MapMarkerIcons._();

  static Widget shop() {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: kRouteColor, width: 2.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x40000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: const Icon(
        Icons.store_rounded,
        color: kRouteBorderColor,
        size: 22,
      ),
    );
  }

  static Widget destination() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: kRouteColor,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: const [
              BoxShadow(
                color: Color(0x40000000),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(Icons.flag_rounded, color: Colors.white, size: 20),
        ),
        Container(
          width: 3,
          height: 8,
          decoration: BoxDecoration(
            color: kRouteColor,
            borderRadius: AppRadius.borderFull,
          ),
        ),
      ],
    );
  }

  static Widget rider({double? heading}) {
    return Transform.rotate(
      angle: heading == null ? 0 : heading * 3.1415926535 / 180,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: const Color(0xFFFFDE58),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFF141414), width: 2.5),
          boxShadow: const [
            BoxShadow(
              color: Color(0x40000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: const Icon(
          Icons.two_wheeler_rounded,
          color: Color(0xFF141414),
          size: 22,
        ),
      ),
    );
  }

  static Widget stopNumber(int n, {bool isCurrent = false}) {
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: isCurrent ? kRouteColor : const Color(0xFF2A2A2A),
        shape: BoxShape.circle,
        border: Border.all(
          color: isCurrent ? Colors.white : kRouteColor,
          width: 2,
        ),
      ),
      child: Text(
        '$n',
        style: TextStyle(
          color: isCurrent ? const Color(0xFF141414) : Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 13,
        ),
      ),
    );
  }
}
