/// Dark GRIDGO basemap style for Google Maps (JSON string).
/// Tuned for black UI chrome + yellow route contrast.
const String kGridGoogleMapDarkStyle = r'''
[
  {"elementType":"geometry","stylers":[{"color":"#1d1d1d"}]},
  {"elementType":"labels.text.fill","stylers":[{"color":"#8a8a8a"}]},
  {"elementType":"labels.text.stroke","stylers":[{"color":"#1d1d1d"}]},
  {"featureType":"administrative","elementType":"geometry","stylers":[{"color":"#2c2c2c"}]},
  {"featureType":"poi","elementType":"labels.text.fill","stylers":[{"color":"#757575"}]},
  {"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#181818"}]},
  {"featureType":"road","elementType":"geometry.fill","stylers":[{"color":"#2c2c2c"}]},
  {"featureType":"road","elementType":"labels.text.fill","stylers":[{"color":"#8a8a8a"}]},
  {"featureType":"road.arterial","elementType":"geometry","stylers":[{"color":"#373737"}]},
  {"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#3c3c3c"}]},
  {"featureType":"road.highway.controlled_access","elementType":"geometry","stylers":[{"color":"#4e4e4e"}]},
  {"featureType":"transit","elementType":"geometry","stylers":[{"color":"#2f2f2f"}]},
  {"featureType":"water","elementType":"geometry","stylers":[{"color":"#0e0e0e"}]},
  {"featureType":"water","elementType":"labels.text.fill","stylers":[{"color":"#3d3d3d"}]}
]
''';
