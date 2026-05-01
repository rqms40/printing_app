import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive/hive.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  late ProviderContainer container;
  late OrderFlowNotifier notifier;
  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_test_');
    Hive.init(tempDir.path);
    await Hive.openBox('draft_orders');

    container = ProviderContainer();
    notifier = container.read(orderFlowProvider.notifier);
    notifier.reset();
  });

  tearDown(() async {
    container.dispose();
    await Hive.close();
    await tempDir.delete(recursive: true);
  });

  group('setPaperSpecsFromMap', () {
    test('sets all known paper fields from map', () {
      notifier.setCategory('paper');
      notifier.setPaperSpecsFromMap({
        'paperSize': 'a4',
        'colorMode': 'blackAndWhite',
        'mediaType': 'glossy',
        'printSides': 'frontOnly',
        'binding': 'none',
      });
      final specs = container.read(orderFlowProvider).paperSpecs!;
      expect(specs.paperSize, PaperSize.a4);
      expect(specs.colorMode, ColorMode.blackAndWhite);
      expect(specs.mediaType, MediaType.glossy);
      expect(specs.printSides, PrintSides.frontOnly);
      expect(specs.binding, Binding.none);
    });

    test('uses defaults for missing fields', () {
      notifier.setCategory('paper');
      notifier.setPaperSpecsFromMap({'paperSize': 'a3'});
      final specs = container.read(orderFlowProvider).paperSpecs!;
      expect(specs.paperSize, PaperSize.a3);
      expect(specs.colorMode, ColorMode.blackAndWhite);
    });

    test('ignores unknown keys without throwing', () {
      notifier.setCategory('paper');
      notifier.setPaperSpecsFromMap({'paperSize': 'a4', 'unknownKey': 'x'});
      final specs = container.read(orderFlowProvider).paperSpecs!;
      expect(specs.paperSize, PaperSize.a4);
    });

    test('does not set specs when map is empty', () {
      notifier.setCategory('paper');
      notifier.setPaperSpecsFromMap({});
      expect(container.read(orderFlowProvider).paperSpecs, isNull);
    });

    test('uses PaperSize.a4 default for invalid enum value', () {
      notifier.setCategory('paper');
      notifier.setPaperSpecsFromMap({'paperSize': 'INVALIDSIZE'});
      final specs = container.read(orderFlowProvider).paperSpecs!;
      expect(specs.paperSize, PaperSize.a4);
    });
  });

  group('setPrintMode', () {
    test('setPrintMode updates printMode in state', () {
      final notifier = container.read(orderFlowProvider.notifier);
      notifier.setPrintMode('actualSize');
      expect(notifier.state.printMode, 'actualSize');
    });
  });

  group('setThreeDSpecsFromMap', () {
    test('sets all known 3D fields from map', () {
      notifier.setCategory('3d');
      notifier.setThreeDSpecsFromMap({
        'fileFormat': 'stl',
        'material': 'pla',
        'color': 'White',
        'infillPercentage': 20,
        'layerHeight': 0.2,
        'supports': true,
        'notes': 'Test notes',
      });
      final specs = container.read(orderFlowProvider).threeDSpecs!;
      expect(specs.fileFormat, FileFormat3D.stl);
      expect(specs.material, Material3D.pla);
      expect(specs.color, 'White');
      expect(specs.infillPercentage, 20);
      expect(specs.layerHeight, 0.2);
      expect(specs.supports, true);
      expect(specs.notes, 'Test notes');
    });

    test('does not set specs when map is empty', () {
      notifier.setCategory('3d');
      notifier.setThreeDSpecsFromMap({});
      expect(container.read(orderFlowProvider).threeDSpecs, isNull);
    });

    test('uses defaults for missing fields', () {
      notifier.setCategory('3d');
      notifier.setThreeDSpecsFromMap({'material': 'abs'});
      final specs = container.read(orderFlowProvider).threeDSpecs!;
      expect(specs.material, Material3D.abs);
      expect(specs.fileFormat, FileFormat3D.stl);
      expect(specs.infillPercentage, 20);
      expect(specs.layerHeight, 0.2);
      expect(specs.supports, false);
    });
  });
}
