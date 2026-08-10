const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf-8');

// Fix dark mode navbar bg colors
c = c.replace(/dark:bg-white\/80 dark:bg-black\/60/g, 'dark:bg-black/60');
c = c.replace(/dark:bg-white\/95 dark:bg-black\/90/g, 'dark:bg-black/90');

// Remove isLogoGlassy completely using regex
c = c.replace(/.*?const \[isLogoGlassy, setIsLogoGlassy\] = useState\(false\);.*?\n/g, '');
c = c.replace(/.*?setIsLogoGlassy\(rect\.top <= 80 && rect\.bottom >= 20\);.*?\n/g, '');

// Add backdrop blur overlays
const target1 = 'className="h-[100vh] flex flex-col items-center justify-end pb-32 relative z-10 bg-map" style={{ backgroundImage: `url(${isDarkMode ? "/GRIDGO_BG.png" : "/GRIDGO_BG_WHITE.png"})` }}>';
const target2 = 'className="text-center max-w-2xl px-4"';
const target3 = 'id="support" className="min-h-screen bg-map py-24 relative z-10" style={{ backgroundImage: `url(${isDarkMode ? "/GRIDGO_BG.png" : "/GRIDGO_BG_WHITE.png"})` }}>';
const target4 = 'className="max-w-6xl mx-auto px-6"';
const target5 = 'id="about" className="min-h-screen bg-map py-32 relative z-10 flex flex-col justify-center" style={{ backgroundImage: `url(${isDarkMode ? "/GRIDGO_BG.png" : "/GRIDGO_BG_WHITE.png"})` }}>';
const target6 = 'className="max-w-[1100px] mx-auto px-8 w-full"';
const target7 = 'className="min-h-screen bg-map py-20 relative z-10 overflow-hidden" style={{ backgroundImage: `url(${isDarkMode ? "/GRIDGO_BG.png" : "/GRIDGO_BG_WHITE.png"})` }}>';
const target8 = 'className="px-8"';

const overlay = '\n      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-0 pointer-events-none dark:hidden" />';

c = c.replace(target1, target1 + overlay);
c = c.replace(target2, 'className="text-center max-w-2xl px-4 relative z-10"');
c = c.replace(target3, target3 + overlay);
c = c.replace(target4, 'className="max-w-6xl mx-auto px-6 relative z-10"');
c = c.replace(target5, target5 + overlay);
c = c.replace(target6, 'className="max-w-[1100px] mx-auto px-8 w-full relative z-10"');
c = c.replace(target7, target7 + overlay);
c = c.replace(target8, 'className="px-8 relative z-10"');

fs.writeFileSync('src/App.tsx', c);
console.log('App.tsx final fixes applied securely with regex!');
