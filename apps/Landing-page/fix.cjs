const fs = require('fs');

// 1. App.tsx changes
let content = fs.readFileSync('c:/Mobile_App/printing_app/apps/Landing-page/src/App.tsx', 'utf-8');

const oldState = `  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#000';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#fff';
    }
  };

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#000';`;

const newState = `  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    if (newMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#000';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#fff';
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#000';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#fff';
    }`;

content = content.replace(oldState, newState);

const logoRegex = /<a href="#hero" className=\{`flex items-center gap-3 cursor-pointer px-5 py-2.5 rounded-full border transition-all duration-500 \$\{isLogoGlassy \? 'bg-white[^>]+>\s*<div className="grid grid-cols-3 gap-1">/s;
const newLogo = `<a href="#hero" className="flex items-center gap-3 cursor-pointer px-5 py-2.5 rounded-full border border-white/10 bg-black text-white shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:bg-black/80 transition-all duration-500">
          <div className="grid grid-cols-3 gap-1">`;
content = content.replace(logoRegex, newLogo);

fs.writeFileSync('c:/Mobile_App/printing_app/apps/Landing-page/src/App.tsx', content);
console.log('App.tsx updated');

// 2. index.css changes for bg-map
let cssContent = fs.readFileSync('c:/Mobile_App/printing_app/apps/Landing-page/src/index.css', 'utf-8');

const bgMapOld = `.bg-map {
  background-image: url('/GRIDGO_BG.png');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}`;

const bgMapNew = `.bg-map {
  background-image: url('/GRIDGO_BG_WHITE.png');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}

.dark .bg-map {
  background-image: url('/GRIDGO_BG.png');
}`;

cssContent = cssContent.replace(bgMapOld, bgMapNew);
fs.writeFileSync('c:/Mobile_App/printing_app/apps/Landing-page/src/index.css', cssContent);
console.log('index.css updated');
