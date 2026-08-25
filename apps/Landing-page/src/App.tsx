import { useEffect, useState, useRef } from 'react';
import type { ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneScene } from './components/PhoneScene';
import { EcosystemSection } from './components/EcosystemSection';
import { HowItWorksVideos } from './components/HowItWorksVideos';
import { Menu, X, MessageCircle, Zap, ShieldCheck, ChevronUp, Moon, Sun } from 'lucide-react';
import { HardDriveUploadIcon, TruckIcon, ListIcon, TimerIcon, MessageCircleIcon } from 'lucide-animated';
import { Link } from 'react-router-dom';
import { landingLinks, shouldRedirectToMobileWeb } from './utils/landingLinks';

function Navbar({ isDarkMode, toggleDarkMode }: { isDarkMode: boolean, toggleDarkMode: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      const featuresEl = document.getElementById('features');
      if (featuresEl) {
      }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0, filter: 'blur(10px)' }}
        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-[60] px-8 py-4 flex items-center justify-between"
      >
        {/* Logo */}
        <a href="#hero" className="flex items-center gap-3 cursor-pointer px-5 py-2.5 rounded-full border border-black/10 dark:border-white/10 bg-transparent backdrop-blur-md text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition duration-500">
          <div className="grid grid-cols-3 gap-1 shrink-0">
            <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
          </div>
          <span className="text-xl font-bold tracking-widest uppercase">
            GRID<span className="text-[var(--color-primary)]">GO</span>
          </span>
        </a>

        {/* Center Nav */}
        <div className={`hidden md:flex rounded-full px-6 py-2.5 items-center gap-8 text-sm font-medium absolute left-1/2 -translate-x-1/2 border transition duration-500 ${isScrolled ? 'bg-white dark:bg-black/60 backdrop-blur-md border-black/10 dark:border-white/10' : 'bg-transparent border-transparent backdrop-blur-none'}`}>
          <a href="#features" className="hover:text-[var(--color-primary)] transition-colors">Features</a>
          <a href="#process" className="hover:text-[var(--color-primary)] transition-colors">How it Works</a>
          <a href="#ecosystem" className="hover:text-[var(--color-primary)] transition-colors">Ecosystem</a>
          <a href="#support" className="hover:text-[var(--color-primary)] transition-colors">Support</a>
          <a href="#about" className="hover:text-[var(--color-primary)] transition-colors">About Us</a>
        </div>

        {/* Right Nav */}
        <div className="flex items-center gap-3 z-50">
          <Link to="/download" className="hidden md:flex items-center px-6 py-2 bg-[var(--color-primary)] text-black font-bold text-sm rounded-full hover:brightness-110 transition shadow-[0_0_15px_rgba(255,222,88,0.3)]">
            Download
          </Link>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-full relative border transition duration-500 ${isScrolled ? 'bg-white/80 dark:bg-black/60 backdrop-blur-md border-black/10 dark:border-white/10' : 'bg-transparent border-transparent backdrop-blur-none'}`}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {/* Mobile Hamburger Button */}
          <button
            className={`md:hidden p-2 rounded-full relative border transition duration-500 ${isScrolled ? 'bg-white dark:bg-black/60 backdrop-blur-md border-black/10 dark:border-white/10' : 'bg-transparent border-transparent backdrop-blur-none'}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            className="fixed inset-0 z-50 bg-white dark:bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center gap-8 md:hidden"
          >
            <a href="#features" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">Features</a>
            <a href="#process" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">How it Works</a>
            <a href="#ecosystem" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">Ecosystem</a>
            <a href="#support" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">Support</a>
            <a href="#about" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">About Us</a>
            <Link to="/download" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">Download</Link>
            {/* <div className="flex gap-4 mt-8">
              <button className="px-8 py-3 bg-white dark:bg-black/60 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-full transition-colors font-bold" onClick={() => setIsOpen(false)}>Log In</button>
              <button className="px-8 py-3 bg-[var(--color-primary)] text-black rounded-full hover:bg-yellow-400 transition-colors font-bold" onClick={() => setIsOpen(false)}>Sign Up</button>
            </div> */}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function HeroSection({ isDarkMode }: { isDarkMode?: boolean }) {
  return (
    <section id="hero" className="min-h-[100vh] flex flex-col items-center justify-center relative z-10 bg-map bg-cover bg-center overflow-hidden" style={{ backgroundImage: `url(${isDarkMode ? "/Dark_route_animation.gif" : "/Light-lights-route-animation.gif"})` }}>
      <div className="absolute inset-0 bg-white/60 dark:bg-black/40 backdrop-blur-sm dark:backdrop-blur-[3px] z-0 pointer-events-none" />

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 w-full h-full pt-24 md:pt-32">
        {/* Logo and Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center mb-6 md:mb-8"
        >
          {/* 3x3 Grid Logo */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <div className="w-2.5 h-2.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-[var(--color-primary)] rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-black dark:bg-white rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
          </div>
          <span className="text-4xl font-black tracking-widest uppercase mt-2">GRID<span className="text-[var(--color-primary)]">GO</span></span>
          <p className="text-[11px] md:text-sm tracking-[0.3em] uppercase mt-3 font-semibold text-gray-800 dark:text-gray-200">
            MAPPING THE FUTURE OF PRINTING.
          </p>
        </motion.div>

        {/* Main Headings */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-3xl flex flex-col items-center"
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-[var(--color-primary)] mb-6 tracking-tight">
            Design. Tap. Print.
          </h1>
          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto mb-8 md:mb-10 font-medium leading-relaxed">
            Send your files from the app straight to our printers. We'll handle the printing and deliver it to your door so you don't have to leave your seat.
          </p>
        </motion.div>

        {/* Phone Mockup at bottom */}
        <motion.div
          initial={{ opacity: 0, y: 100, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
          className="mt-auto relative w-[320px] md:w-[550px] lg:w-[750px] h-[400px] md:h-[600px] lg:h-[750px]"
        >
          <img
            src="/GIRDGO_PHONE.png"
            alt="GRIDGO App"
            className="absolute bottom-0 left-0 w-full h-full object-contain object-bottom drop-shadow-[0_0_40px_rgba(255,222,88,0.15)] scale-160 lg:scale-120 origin-bottom"
          />
        </motion.div>
      </div>
    </section>
  );
}

type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type AnimatedIconProps = HTMLAttributes<HTMLDivElement> & {
  size?: number;
  animateOnHover?: boolean;
};

type AnimatedIconComponent = ForwardRefExoticComponent<
  AnimatedIconProps & RefAttributes<AnimatedIconHandle>
>;

function FeatureCard({ icon: Icon, title, desc }: { icon: AnimatedIconComponent, title: string, desc: string }) {
  const iconRef = useRef<AnimatedIconHandle>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      iconRef.current?.startAnimation();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: 'blur(15px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      viewport={{ once: true, margin: '-50px' }}
      className="flex flex-col items-center text-center px-4 py-2 text-black"
    >
      <div className="w-20 h-20 mb-3 relative flex items-center justify-center text-black">
        <Icon ref={iconRef} size={56} />
      </div>
      <h3 className="font-heading text-[20px] font-bold mb-2 tracking-tight">{title}</h3>
      <p className="text-[13px] md:text-[14px] leading-relaxed max-w-[350px] font-medium text-black/90">{desc}</p>
    </motion.div>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="min-h-screen bg-[#FFDE58] text-black py-20 relative z-10 flex flex-col justify-center">
      <div className="max-w-6xl mx-auto px-4 w-full">
        <h2 className="font-heading text-[36px] md:text-[42px] tracking-tight font-bold text-center mb-16">Features</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 mb-10">
          <FeatureCard
            icon={HardDriveUploadIcon}
            title="One-Tap Upload"
            desc="No more carrying USB sticks or emailing files to yourself. Directly upload your documents or 3D designs from your phone or cloud storage in seconds."
          />
          <FeatureCard
            icon={TruckIcon}
            title="Live Order Tracking"
            desc="Watch your project move from the printer to the delivery rider in real-time. You'll know exactly when your package is arriving, just like a food delivery app."
          />
          <FeatureCard
            icon={ListIcon}
            title="The Queue"
            desc="Need a document and a 3D model at the same time? Add different types of prints to a single order and have them all delivered in one go to save on shipping."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 max-w-4xl mx-auto">
          <FeatureCard
            icon={TimerIcon}
            title="24/7 App Operations"
            desc="Inspiration doesn't have a closing time. Whether it's 2 PM or 2 AM, you can upload your files and start the process. Our system works 24/7 so your project never has to wait for a shop to open."
          />
          <FeatureCard
            icon={MessageCircleIcon}
            title="Live Support & Tracking"
            desc="From upload to doorstep, help is just a tap away. Chat live with your delivery rider for drop-off updates, or message our support team anytime. We bridge the gap to your print."
          />
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="process" className="min-h-screen bg-white dark:bg-black py-32 relative z-10 text-black dark:text-white flex flex-col justify-center">
      <div className="max-w-6xl mx-auto px-6 w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-24">How it Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center">

          <motion.div
            initial={{ opacity: 0, y: 30, filter: 'blur(15px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            viewport={{ once: true, margin: '-50px' }}
            className="flex flex-col items-center"
          >
            <div className="text-7xl md:text-8xl font-bold text-gray-500 mb-6 tracking-tighter">01</div>
            <h3 className="text-2xl font-bold mb-4">Upload</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-w-sm mx-auto">
              No more carrying USB sticks or emailing files to yourself. Directly upload your documents or 3D designs from your phone or cloud storage in seconds.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, filter: 'blur(15px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            viewport={{ once: true, margin: '-50px' }}
            className="flex flex-col items-center"
          >
            <div className="text-7xl md:text-8xl font-bold text-gray-500 mb-6 tracking-tighter">02</div>
            <h3 className="text-2xl font-bold mb-4">Print</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-w-sm mx-auto">
              Select your printing preferences, paper types, or 3D materials. Our system instantly routes your files directly to our high-quality printing hubs.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, filter: 'blur(15px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            viewport={{ once: true, margin: '-50px' }}
            className="flex flex-col items-center"
          >
            <div className="text-7xl md:text-8xl font-bold text-gray-500 mb-6 tracking-tighter">03</div>
            <h3 className="text-2xl font-bold mb-4">Deliver</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-w-sm mx-auto">
              Watch your project move from the printer to the delivery rider in real-time. You'll know exactly when your package is arriving at your door.
            </p>
          </motion.div>

        </div>

        <HowItWorksVideos />
      </div>
    </section>
  );
}

function SupportSection({ isDarkMode }: { isDarkMode?: boolean }) {
  return (
    <section id="support" className="min-h-screen bg-map py-24 relative z-10" style={{ backgroundImage: `url(${isDarkMode ? "/GRIDGO_BG.png" : "/GRIDGO_BG_WHITE.png"})` }}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-0 pointer-events-none dark:hidden" />
      <div className="max-w-6xl mx-auto px-6 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(15px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: 'easeOut' }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-20"
        >
          <p className="text-xs tracking-[0.35em] uppercase text-[var(--color-primary)] mb-3">We're here for you</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-5">Support &amp; Help</h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Get help with orders, delivery updates, account questions, or technical print concerns through one tracked support flow.
          </p>
        </motion.div>

        {/* Ticketing Support Box */}
        <motion.div
          initial={{ opacity: 0, y: 40, filter: 'blur(20px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          viewport={{ once: true, margin: '-80px' }}
          className="relative max-w-3xl mx-auto rounded-3xl border border-[var(--color-primary)]/20 bg-gray-100 dark:bg-[#0A0A0A] backdrop-blur-md p-10 md:p-14 flex flex-col items-center text-center gap-6 overflow-hidden shadow-2xl"
        >
          {/* accent glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[var(--color-primary)]/5 blur-[100px] pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/15 flex items-center justify-center mb-2 border border-[var(--color-primary)]/20 shadow-[0_0_20px_rgba(255,222,88,0.15)] relative z-10">
            <MessageCircle size={32} className="text-[var(--color-primary)]" strokeWidth={1.5} />
          </div>

          <div className="relative z-10 max-w-xl">
            <h3 className="text-3xl md:text-4xl font-bold mb-4 text-black dark:text-white">GRIDGO Ticketing Support</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-base md:text-lg">
              Experience seamless, human-led support. Submit a ticket with your order issues, delivery updates, or technical questions, and our dedicated admin team will get back to you with real-time solutions straight to your inbox.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-2 w-full sm:w-auto relative z-10">
            <div className="flex items-center justify-center gap-2 bg-black/5 dark:bg-white/5 rounded-full px-6 py-2.5 border border-black/10 dark:border-white/10">
              <ShieldCheck size={18} className="text-[var(--color-primary)]" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Human-led responses</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-black/5 dark:bg-white/5 rounded-full px-6 py-2.5 border border-black/10 dark:border-white/10">
              <Zap size={18} className="text-[var(--color-primary)]" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fast resolution</span>
            </div>
          </div>

          <Link to="/support" className="mt-4 w-full sm:w-auto px-10 py-3.5 rounded-full bg-[var(--color-primary)] text-black font-bold text-base hover:bg-[#FFE57F] hover:scale-105 hover:shadow-[0_0_25px_rgba(255,222,88,0.3)] transition-all duration-300 relative z-10">
            Submit a Ticket Now
          </Link>
        </motion.div>

        {/* Bottom stat row */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-3 gap-2 md:gap-4 mt-12 text-center"
        >
          {[
            { value: '< 5 min', label: 'Avg. response time' },
            { value: '24 / 7', label: 'Support availability' },
            { value: '99 %', label: 'Issue resolution rate' },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 py-4 px-2 md:py-6 md:px-4 flex flex-col items-center justify-center">
              <p className="text-[15px] sm:text-lg md:text-3xl font-bold text-[var(--color-primary)] mb-1">{value}</p>
              <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-600 dark:text-gray-400 uppercase tracking-normal md:tracking-widest break-words w-full">{label}</p>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}

function AboutSection({ isDarkMode }: { isDarkMode?: boolean }) {
  return (
    <section id="about" className="min-h-screen bg-map py-32 relative z-10 flex flex-col justify-center" style={{ backgroundImage: `url(${isDarkMode ? "/GRIDGO_BG.png" : "/GRIDGO_BG_WHITE.png"})` }}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-0 pointer-events-none dark:hidden" />
      <div className="max-w-[1100px] mx-auto px-8 w-full relative z-10">
        <h2 className="font-heading text-4xl md:text-[42px] font-bold text-center mb-24 tracking-tight">About Us</h2>

        <div className="grid grid-cols-1 md:grid-cols-[4.5fr_7.5fr] gap-10 md:gap-16 items-stretch">
          <motion.div
            initial={{ opacity: 0, x: -50, filter: 'blur(20px)' }}
            whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1, ease: 'easeOut' }}
            viewport={{ once: true, margin: '-100px' }}
            className="w-full flex justify-center h-full"
          >
            <img src="/office.png" alt="GRIDGO Office" className="w-full h-full object-cover aspect-[4/5]" />
          </motion.div>

          <div className="flex flex-col justify-between h-full py-1">
            <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.8, ease: 'easeOut' }}>
              <div className="mb-2 leading-tight">
                <span className="font-heading text-[16px] md:text-[18px] font-normal text-black dark:text-white block">the</span>
                <span className="font-heading text-[24px] md:text-[28px] font-bold text-black dark:text-white block tracking-tight">vision.</span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-[13px] md:text-[14px] font-light leading-relaxed">"To be the essential <span className="text-[var(--color-primary)] font-bold">digital printing partner in the global market</span>, making the transition from digital design to physical reality effortless and stress-free for every user."</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-50px' }} transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}>
              <div className="mb-2 leading-tight">
                <span className="font-heading text-[16px] md:text-[18px] font-normal text-black dark:text-white block">the</span>
                <span className="font-heading text-[24px] md:text-[28px] font-bold text-black dark:text-white block tracking-tight">mission.</span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-[13px] md:text-[14px] font-light leading-relaxed">"To <span className="text-[var(--color-primary)] font-bold">revolutionize the printing experience</span> by combining precision technology, high - quality output, and seamless logistics, empowering professionals and students to focus on their craft."</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-50px' }} transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}>
              <div className="mb-2 leading-tight">
                <span className="font-heading text-[16px] md:text-[18px] font-normal text-black dark:text-white block">the</span>
                <span className="font-heading text-[24px] md:text-[28px] font-bold text-black dark:text-white block tracking-tight">goal.</span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-[13px] md:text-[14px] font-light leading-relaxed">"To become and lead the digital printing industry within the Philippine market in the span of <span className="text-[var(--color-primary)] font-bold">three to five years</span>."</p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

type TeamMemberProps = {
  image: string;
  role: string;
  name: string;
  quote: string;
  delay?: number;
  reverse?: boolean;
};

function TeamMember({ image, role, name, quote, delay = 0, reverse = false }: TeamMemberProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, filter: 'blur(20px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 1, delay, ease: "easeOut" }}
      className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 max-w-5xl mx-auto mb-32`}
    >
      <div className="w-full md:w-1/2 flex justify-center">
        <img src={image} alt={name} className="w-64 h-64 object-cover rounded-full" />
      </div>
      <div className={`w-full md:w-1/2 ${reverse ? 'text-right' : 'text-left'}`}>
        <p className="text-[var(--color-primary)] font-semibold mb-1">Meet the {role}</p>
        <h3 className="text-4xl font-bold mb-4">{name}</h3>
        <p className="text-sm uppercase tracking-widest text-gray-600 dark:text-gray-400 mb-6">{role.toUpperCase()}</p>
        <p className="text-lg text-gray-700 dark:text-gray-300 italic border-l-4 border-[var(--color-primary)] pl-6">
          {quote}
        </p>
      </div>
    </motion.div>
  );
}

function TeamSection({ isDarkMode }: { isDarkMode?: boolean }) {
  return (
    <section className="min-h-screen bg-map py-20 relative z-10 overflow-hidden" style={{ backgroundImage: `url(${isDarkMode ? "/GRIDGO_BG.png" : "/GRIDGO_BG_WHITE.png"})` }}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-0 pointer-events-none dark:hidden" />
      <div className="px-8 relative z-10">
        <TeamMember
          image="/JR.png"
          role="founder"
          name="John Royce Frivaldo"
          quote="The future isn't about AI replacing our hands, but about humans using it as a catapult to reach new heights."
        />
        <TeamMember
          image="/Mark.png"
          role="Developer"
          name="Mark David Prado"
          quote='"Roses are red, violets are blue. My code might have bugs, but my love for you is true."'
          reverse={true}
        />
        <TeamMember
          image="/Ven.png"
          role="Developer"
          name="Rovenado Nesta Villotes"
          quote="People are not driven by past causes but move toward goals that they themselves set."
        />
        <TeamMember
          image="/Justin.png.png"
          role="Marketing Lead"
          name="Justin Vince Oroña"
          quote="Where my tendons have been torn, my psyche has been mended. This was a worthy trade"
          reverse={true}
        />
      </div>
    </section>
  );
}

function BetaSection() {
  const { mobileWebUrl, apkDownloadUrl, communityUrl } = landingLinks(window.location);

  return (
    <section id="download" className="min-h-[100vh] flex items-center justify-center relative z-10 py-20 px-8 overflow-hidden bg-gray-50 dark:bg-[#050505]">
      {/* Background Glow */}
      <div className="absolute left-[10%] bottom-[10%] w-[600px] h-[600px] bg-[#FFDE58]/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto w-full flex justify-end relative z-20">

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          viewport={{ once: true, margin: '-100px' }}
          className="w-full md:w-1/2 flex flex-col items-center text-center"
        >
          <div className="w-full max-w-[450px] flex flex-col items-center">
            <h2 className="font-heading text-[30px] md:text-[34px] font-bold mb-3 tracking-tight">
              Be part of <span className="text-[var(--color-primary)]">Beta Access</span>
            </h2>

            <p className="text-gray-800 dark:text-gray-200 text-[13px] md:text-[14px] mb-8 max-w-[380px] font-light leading-relaxed">
              Become a founding member of GRIDGO and have a <span className="text-[var(--color-primary)] font-medium">free printing service</span> delivered to your door step.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 w-[95%]">
              <a
                href={mobileWebUrl}
                className="bg-white text-black font-bold py-3 px-3 rounded-full hover:bg-gray-200 transition-colors text-[13px] md:text-[13px]"
              >
                Access Mobile Web
              </a>
              <a
                href={apkDownloadUrl}
                className="bg-[var(--color-primary)] text-black font-bold py-3 px-3 rounded-full hover:bg-yellow-400 transition-colors text-[13px] md:text-[14px]"
                rel="noopener noreferrer"
              >
                Download APK
              </a>
              <a
                href={communityUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-[var(--color-primary)] text-[var(--color-primary)] font-bold py-3 px-3 rounded-full hover:bg-[var(--color-primary)] hover:text-black transition-colors text-[13px] md:text-[14px]"
              >
                Join GRID Community
              </a>
            </div>

            <div className="flex flex-col items-center w-full">
              <p className="font-heading text-[16px] md:text-[18px] text-[var(--color-primary)] mb-0 tracking-wide font-normal">The future of printing is almost here.</p>
              <p className="font-heading text-[16px] md:text-[18px] text-black dark:text-white mb-6 tracking-wide font-normal">Launching soon.</p>

              <div className="flex gap-3">
                {/* App Store button */}
                <div className="border border-black/20 dark:border-white/20 bg-white dark:bg-black/10 dark:bg-black/40 rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors h-[44px]">
                  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.365 14.363c-.015-3.08 2.502-4.545 2.617-4.618-1.428-2.091-3.64-2.378-4.423-2.42-1.894-.19-3.693 1.115-4.654 1.115-.963 0-2.434-1.09-4.01-1.059-2.063.03-3.965 1.196-5.029 3.037-2.146 3.712-.55 9.206 1.543 12.235 1.025 1.48 2.235 3.134 3.84 3.076 1.531-.061 2.112-.99 3.94-.99 1.828 0 2.35.99 3.94 1.02 1.636.03 2.686-1.449 3.706-2.94 1.176-1.716 1.66-3.376 1.682-3.46-.035-.015-3.146-1.206-3.152-4.996zM14.935 5.568c.843-1.02 1.411-2.436 1.256-3.848-1.218.049-2.695.811-3.565 1.826-.701.815-1.383 2.264-1.198 3.645 1.364.105 2.663-.603 3.507-1.623z" />
                  </svg>
                  <div className="flex flex-col items-start justify-center">
                    {/* <span className="text-[9px] leading-[1] text-gray-700 dark:text-gray-300 mb-[2px]">Download on the</span> */}
                    <span className="text-[14px] font-semibold leading-[1]">App Store</span>
                  </div>
                </div>

                {/* Google Play button */}
                <div className="border border-black/20 dark:border-white/20 bg-white dark:bg-black/10 dark:bg-black/40 rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors h-[44px]">
                  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186c-.165-.133-.298-.3-.389-.49A1.737 1.737 0 013 20.854V3.146c0-.306.075-.596.221-.842.146-.246.353-.448.6-.58.058-.031.121-.059.188-.083v.173zm1.116-.503l9.96 5.75L15.3 7.644 4.725 1.311zm11.393 6.643L20.655 10.6a1.738 1.738 0 010 2.802l-4.537 2.645-1.572-1.571 1.572-1.572zM4.725 22.689l10.575-6.333-1.403-1.403-9.172 7.736z" />
                  </svg>
                  <div className="flex flex-col items-start justify-center">
                    {/* <span className="text-[9px] leading-[1] text-gray-700 dark:text-gray-300 mb-[2px]">GET IT ON</span> */}
                    <span className="text-[14px] font-semibold leading-[1]">Google Play</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer className="bg-[#050505] text-white pt-24 pb-12 px-8 relative z-20 border-t border-white/5 font-sans">
      <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row justify-between gap-16 mb-24">

        {/* Left Logo & Info */}
        <div className="flex-[1.5] max-w-sm">
          <a href="#hero" className="flex items-center gap-4 cursor-pointer mb-10">
            <div className="grid grid-cols-3 gap-1">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            </div>
            <span className="text-3xl font-black tracking-widest uppercase text-white">
              GRID<span className="text-[var(--color-primary)]">GO</span>
            </span>
          </a>

          <div className="text-gray-400 text-[13px] font-mono space-y-3 mb-12">
            <p>GRIDGO Team</p>
            <p className="leading-relaxed">The essential digital printing partner in the global market, making the transition from digital design to physical reality effortless.</p>
          </div>

          <p className="text-[#666] text-[11px] tracking-widest font-mono uppercase">SUPPORT@GRIDGO.APP</p>
        </div>

        {/* Links Columns */}
        <div className="flex-[2] flex flex-wrap md:flex-nowrap justify-between gap-12 border-l border-white/5 pl-0 md:pl-12">
          <div className="flex flex-col gap-6">
            <h4 className="text-[#666] text-[13px] lowercase font-mono">services</h4>
            <div className="flex flex-col gap-5">
              <a href="#features" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">DOCUMENT PRINTING</a>
              <a href="#features" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">3D PRINTING</a>
              <a href="#features" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">DELIVERY</a>
              <a href="#features" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">THE QUEUE</a>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <h4 className="text-[#666] text-[13px] lowercase font-mono">resources</h4>
            <div className="flex flex-col gap-5">
              <a href="#ecosystem" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">ECOSYSTEM</a>
              <a href="#support" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">SUPPORT</a>
              <a href="#process" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">HOW IT WORKS</a>
              <a href="#features" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">FEATURES</a>
              <Link to="/download" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">DOWNLOAD APP</Link>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <h4 className="text-[#666] text-[13px] lowercase font-mono">more</h4>
            <div className="flex flex-col gap-5">
              <a href="#about" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">ABOUT US</a>
              <a href="#" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">PRIVACY POLICY</a>
              <a href="#" className="text-white text-[12px] font-bold tracking-widest uppercase hover:text-[var(--color-primary)] transition-colors">TERMS OF SERVICE</a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row justify-between items-end gap-6 pt-10 text-[#666] text-[11px] font-mono tracking-wide">
        <p className="max-w-[400px] leading-relaxed">
          A modern platform for digital printing combining precision technology, high-quality output, and seamless logistics.
        </p>
        <div className="flex gap-8 uppercase tracking-widest">
          <span>&copy; 2026 GRIDGO</span>
          <span>ALL RIGHTS RESERVED</span>
        </div>
      </div>
    </footer>
  );
}

function App() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
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
    }
    const { mobileWebPort } = landingLinks(window.location);
    if (
      shouldRedirectToMobileWeb(
        window.location,
        window.navigator.userAgent,
        mobileWebPort,
      )
    ) {
      window.location.replace(landingLinks(window.location).mobileWebUrl);
      return;
    }



    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="w-full relative custom-scrollbar bg-white dark:bg-black text-black dark:text-white">
      <Navbar isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />

      {/* The 3D Parallax Canvas stays fixed in the background but is now hidden in the hero section */}
      <PhoneScene isDarkMode={isDarkMode} />

      {/* Scrollable Content */}
      <div className="relative w-full">
        <HeroSection isDarkMode={isDarkMode} />
        <FeaturesSection />
        <HowItWorksSection />
        <EcosystemSection isDarkMode={isDarkMode} />
        <SupportSection isDarkMode={isDarkMode} />
        <AboutSection isDarkMode={isDarkMode} />
        <TeamSection isDarkMode={isDarkMode} />
        <BetaSection />
        <FooterSection />
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 right-8 z-50 p-3 rounded-full bg-white dark:bg-black/60 backdrop-blur-md border border-black/10 dark:border-white/10 text-black dark:text-white hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] shadow-lg transition-all duration-300"
          >
            <ChevronUp size={24} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
