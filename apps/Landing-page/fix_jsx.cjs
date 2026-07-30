const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf-8');

c = c.replace('className="text-center max-w-2xl px-4" relative z-10', 'className="text-center max-w-2xl px-4 relative z-10"');
c = c.replace('className="max-w-6xl mx-auto px-6" relative z-10', 'className="max-w-6xl mx-auto px-6 relative z-10"');
c = c.replace('className="max-w-[1100px] mx-auto px-8 w-full" relative z-10', 'className="max-w-[1100px] mx-auto px-8 w-full relative z-10"');
c = c.replace('className="px-8" relative z-10', 'className="px-8 relative z-10"');
c = c.replace('  const [isLogoGlassy, setIsLogoGlassy] = useState(false);\n', '');

fs.writeFileSync('src/App.tsx', c);
console.log('App.tsx syntax errors fixed');
