import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Secure JWT token storage.
///
/// On native (iOS/Android/desktop): uses flutter_secure_storage (encrypted keychain/keystore).
/// On web over plain HTTP: flutter_secure_storage_web requires Web Crypto API which is
/// only available on HTTPS/localhost. We fall back to SharedPreferences (localStorage)
/// so auth works on HTTP dev deployments.
class TokenStorage {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'auth_token';

  static Future<void> saveToken(String token) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token);
      return;
    }
    await _storage.write(key: _tokenKey, value: token);
  }

  static Future<String?> getToken() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      final val = prefs.getString(_tokenKey);
      return (val == null || val.isEmpty) ? null : val;
    }
    return _storage.read(key: _tokenKey);
  }

  static Future<void> clearToken() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_tokenKey);
      return;
    }
    await _storage.delete(key: _tokenKey);
  }

  static Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
