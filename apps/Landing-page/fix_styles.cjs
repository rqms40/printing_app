const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf-8');

// Add isDarkMode to PhoneScene
c = c.replace('<PhoneScene />', '<PhoneScene isDarkMode={isDarkMode} />');

// ProcessSection
c = c.replace('function ProcessSection() {', 'function ProcessSection({ isDarkMode }: { isDarkMode?: boolean }) {');
c = c.replace('relative z-10 bg-map\">', 'relative z-10 bg-map\" style={{ backgroundImage: `url(${isDarkMode ? \"/GRIDGO_BG.png\" : \"/GRIDGO_BG_WHITE.png\"})` }}>');

// SupportSection
c = c.replace('function SupportSection() {', 'function SupportSection({ isDarkMode }: { isDarkMode?: boolean }) {');
c = c.replace('className=\"min-h-screen bg-map py-24 relative z-10\">', 'className=\"min-h-screen bg-map py-24 relative z-10\" style={{ backgroundImage: `url(${isDarkMode ? \"/GRIDGO_BG.png\" : \"/GRIDGO_BG_WHITE.png\"})` }}>');

// AboutSection
c = c.replace('function AboutSection() {', 'function AboutSection({ isDarkMode }: { isDarkMode?: boolean }) {');
c = c.replace('className=\"min-h-screen bg-map py-32 relative z-10 flex flex-col justify-center\">', 'className=\"min-h-screen bg-map py-32 relative z-10 flex flex-col justify-center\" style={{ backgroundImage: `url(${isDarkMode ? \"/GRIDGO_BG.png\" : \"/GRIDGO_BG_WHITE.png\"})` }}>');

// TeamSection
c = c.replace('function TeamSection() {', 'function TeamSection({ isDarkMode }: { isDarkMode?: boolean }) {');
c = c.replace('className=\"min-h-screen bg-map py-20 relative z-10 overflow-hidden\">', 'className=\"min-h-screen bg-map py-20 relative z-10 overflow-hidden\" style={{ backgroundImage: `url(${isDarkMode ? \"/GRIDGO_BG.png\" : \"/GRIDGO_BG_WHITE.png\"})` }}>');

// Pass props
c = c.replace('<ProcessSection />', '<ProcessSection isDarkMode={isDarkMode} />');
c = c.replace('<SupportSection />', '<SupportSection isDarkMode={isDarkMode} />');
c = c.replace('<AboutSection />', '<AboutSection isDarkMode={isDarkMode} />');
c = c.replace('<TeamSection />', '<TeamSection isDarkMode={isDarkMode} />');

fs.writeFileSync('src/App.tsx', c);
console.log('App.tsx inline styles applied');
