import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/maps/grid_map_view.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

void main() {
  testWidgets('GridMapView renders placeholder when forced', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            height: 200,
            child: GridMapView(
              forcePlaceholder: true,
              initialCamera: MapHelpers.camera(MapHelpers.davaoCenter),
              markers: [MapHelpers.shopMarker()],
              placeholderMessage: 'Test placeholder',
            ),
          ),
        ),
      ),
    );

    expect(find.text('Test placeholder'), findsOneWidget);
    expect(find.textContaining('1 pin'), findsOneWidget);
  });
}
