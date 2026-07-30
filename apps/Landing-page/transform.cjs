const fs = require('fs');
let content = fs.readFileSync('c:/Mobile_App/printing_app/apps/Landing-page/src/App_updated.tsx', 'utf-8');

if (!content.includes('Moon, Sun')) {
    content = content.replace("import { Menu, X, MessageCircle, Zap, ShieldCheck, ChevronUp } from 'lucide-react';", "import { Menu, X, MessageCircle, Zap, ShieldCheck, ChevronUp, Moon, Sun } from 'lucide-react';");
}

content = content.replace('function Navbar() {', 'function Navbar({ isDarkMode, toggleDarkMode }: { isDarkMode: boolean, toggleDarkMode: () => void }) {');

const toggleBtn = `
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className={\`md:flex p-2 rounded-full z-50 relative border transition-all duration-500 \${isScrolled ? 'bg-white/80 dark:bg-black/60 backdrop-blur-md border-black/10 dark:border-white/10' : 'bg-transparent border-transparent backdrop-blur-none'}\`}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
`;
content = content.replace('{/* Mobile Hamburger Button */}', toggleBtn + '        {/* Mobile Hamburger Button */}');

const appState = `function App() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

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

content = content.replace(/function App\(\) \{\s*const \[showScrollTop, setShowScrollTop\] = useState\(false\);\s*useEffect\(\(\) => \{/, appState);
content = content.replace(/document\.body\.style\.backgroundColor = '#000';\s*document\.body\.style\.color = '#fff';/g, '');

content = content.replace('<Navbar />', '<Navbar isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />');

// also replace hardcoded text-black which shouldn't be touched? Actually I didn't touch it. 
// However, in light mode we want things to look nice. The text inside feature cards is text-black which is good for light mode.
// The main background is dark by default but we replaced it with dark classes.

fs.writeFileSync('c:/Mobile_App/printing_app/apps/Landing-page/src/App_updated2.tsx', content);
console.log('Script done');
