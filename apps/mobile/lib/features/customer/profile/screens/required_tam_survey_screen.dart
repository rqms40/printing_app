import 'package:flutter/material.dart';
import 'package:printing_app/features/customer/profile/screens/tam_survey_screen.dart';

class RequiredTamSurveyScreen extends StatelessWidget {
  const RequiredTamSurveyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const TamSurveyScreen(isRequired: true);
  }
}
