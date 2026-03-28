import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'shared/services/draft_storage_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DraftStorageService.init();
  runApp(const ProviderScope(child: App()));
}
