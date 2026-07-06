# Architect Scale Ruler Audit

Issue: #8

## Comparable Implementations

- [arconsis `measurements`](https://github.com/arconsis/measurements): measures distances on PDF/image content by converting on-screen pixel distances into useful units, which reinforces that measurement should be calibrated to the document content rather than the device screen.
- [Appriva-labs `flutter_scale_ruler`](https://github.com/Appriva-labs/flutter_scale_ruler): a simple Flutter scale ruler focused on feet/inches, useful as a reference for touch-friendly ruler controls, but too narrow for our document preview overlay.
- [theshivamlko `rulers`](https://github.com/theshivamlko/rulers): a selectable-value ruler widget, useful for picker-style inputs but not calibrated document measurement.
- [`ruler_scale_indicator`](https://pub.dev/documentation/ruler_scale_indicator/latest/): a scrollable scale indicator package. It is GPL-3.0 and published by an unverified uploader, so it is not a good dependency fit for this app.
- [Xatpy `pdf-ruler`](https://github.com/Xatpy/pdf-ruler): emphasizes calibrated paper sizes, orientation handling, magnification, draggable measurement points, and mobile touch support.
- [Stirling-PDF issue #6121](https://github.com/Stirling-Tools/Stirling-PDF/issues/6121): requests scale support so raw PDF or screen units can be converted into real-world dimensions.

## Decisions

- Keep the ruler calibrated to the fitted document preview bounds. This avoids letterboxing and orientation errors from using the raw viewport width.
- Keep the displayed ruler as a visual triangular architect scale. It does not claim to be a physically exact screen ruler.
- Keep imperial architect faces in scope for now. Metric and engineer scales need separate product decisions.
- Avoid adding a new package. The reviewed Flutter packages and examples are either narrower than our preview requirements or would still require custom document calibration and overlay UX.

## Implemented UX Checks

- The scale chip now says the ruler is document-calibrated and can be tapped to change scale.
- Scale selection opens a full list of architect scale faces instead of cycling blindly.
- The ruler remains draggable and rotatable through touch gestures.
- A reset affordance returns rotation and position to the fitted document center.
- Small viewports keep a usable ruler length where possible while clamping the center inside the preview.

## Known Limitation

The overlay is calibrated to the document preview, not to physical device inches. Browser zoom, Flutter web canvas scaling, PDF rendering differences, and device pixel density can all affect physical screen measurement.
