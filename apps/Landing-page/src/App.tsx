import { useEffect, useState, useRef } from 'react';
import type { ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneScene } from './components/PhoneScene';
import { Menu, X, Phone, MessageCircle, Zap, ShieldCheck, ChevronUp } from 'lucide-react';
import { HardDriveUploadIcon, TruckIcon, ListIcon, TimerIcon, MessageCircleIcon } from 'lucide-animated';
import { Link } from 'react-router-dom';
import { landingLinks, shouldRedirectToMobileWeb } from './utils/landingLinks';

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLogoGlassy, setIsLogoGlassy] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      const featuresEl = document.getElementById('features');
      if (featuresEl) {
        const rect = featuresEl.getBoundingClientRect();
        setIsLogoGlassy(rect.top <= 80 && rect.bottom >= 20);
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
        <a href="#hero" className={`flex items-center gap-3 cursor-pointer px-5 py-2.5 rounded-full border transition-all duration-500 ${isLogoGlassy ? 'bg-black/60 backdrop-blur-md border-white/10' : 'bg-transparent border-transparent backdrop-blur-none'}`}>
          <div className="grid grid-cols-3 gap-1">
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
          </div>
          <span className="text-xl font-bold tracking-widest uppercase">
            GRID<span className="text-[var(--color-primary)]">GO</span>
          </span>
        </a>

        {/* Center Nav */}
        <div className={`hidden md:flex rounded-full px-6 py-2.5 items-center gap-8 text-sm font-medium absolute left-1/2 -translate-x-1/2 border transition-all duration-500 ${isScrolled ? 'bg-black/60 backdrop-blur-md border-white/10' : 'bg-transparent border-transparent backdrop-blur-none'}`}>
          <a href="#features" className="hover:text-[var(--color-primary)] transition-colors">Features</a>
          <a href="#process" className="hover:text-[var(--color-primary)] transition-colors">How it Works</a>
          <a href="#support" className="hover:text-[var(--color-primary)] transition-colors">Support</a>
          <a href="#about" className="hover:text-[var(--color-primary)] transition-colors">About Us</a>
          <a href="#download" className="hover:text-[var(--color-primary)] transition-colors">Download</a>
        </div>

        {/* Right Nav */}
        {/* <div className={`hidden md:flex rounded-full items-center text-sm font-medium overflow-hidden p-1 border transition-all duration-500 ${isScrolled ? 'bg-black/60 backdrop-blur-md border-white/10' : 'bg-transparent border-transparent backdrop-blur-none'}`}>
          <button className="px-6 py-2 hover:bg-white/10 rounded-full transition-colors">Log In</button>
          <button className="px-6 py-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors">Sign Up</button>
        </div> */}

        {/* Mobile Hamburger Button */}
        <button
          className={`md:hidden p-2 rounded-full z-50 relative border transition-all duration-500 ${isScrolled ? 'bg-black/60 backdrop-blur-md border-white/10' : 'bg-transparent border-transparent backdrop-blur-none'}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center gap-8 md:hidden"
          >
            <a href="#features" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">Features</a>
            <a href="#process" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">How it Works</a>
            <a href="#support" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">Support</a>
            <a href="#about" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">About Us</a>
            <a href="#download" onClick={() => setIsOpen(false)} className="text-2xl font-bold hover:text-[var(--color-primary)] transition-colors">Download</a>
            {/* <div className="flex gap-4 mt-8">
              <button className="px-8 py-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full transition-colors font-bold" onClick={() => setIsOpen(false)}>Log In</button>
              <button className="px-8 py-3 bg-[var(--color-primary)] text-black rounded-full hover:bg-yellow-400 transition-colors font-bold" onClick={() => setIsOpen(false)}>Sign Up</button>
            </div> */}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function HeroSection() {
  return (
    <section id="hero" className="h-[100vh] flex flex-col items-center justify-center relative z-10 pointer-events-none">
      {/* The Hero text is now fully rendered in 3D within PhoneScene.tsx */}
    </section>
  );
}

function ProcessSection() {
  return (
    <section className="h-[100vh] flex flex-col items-center justify-end pb-32 relative z-10 bg-map">
      <motion.div
        initial={{ opacity: 0, y: 50, filter: 'blur(20px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 1, ease: 'easeOut' }}
        viewport={{ once: true, margin: "-100px" }}
        className="text-center max-w-2xl px-4"
      >
        <p className="text-xs md:text-sm tracking-[0.3em] uppercase text-gray-400 mb-2">
          MAPPING THE FUTURE OF PRINTING
        </p>
        <h2 className="text-5xl md:text-6xl font-bold text-[var(--color-primary)] mb-6">
          Design. Tap. Print.
        </h2>
        <p className="text-lg text-gray-300">
          Send your files from the app straight to our printers. We'll handle the printing and deliver it to your door so you don't have to leave your seat.
        </p>
      </motion.div>
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
    <section id="features" className="min-h-screen bg-[var(--color-primary)] text-black py-20 relative z-10 flex flex-col justify-center">
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
  const [hasVideoError, setHasVideoError] = useState(false);

  return (
    <section id="process" className="min-h-screen bg-black py-32 relative z-10 text-white flex flex-col justify-center">
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
            <p className="text-sm text-gray-300 leading-relaxed max-w-sm mx-auto">
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
            <p className="text-sm text-gray-300 leading-relaxed max-w-sm mx-auto">
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
            <h3 className="text-2xl font-bold mb-4">Receive</h3>
            <p className="text-sm text-gray-300 leading-relaxed max-w-sm mx-auto">
              Watch your project move from the printer to the delivery rider in real-time. You'll know exactly when your package is arriving at your door.
            </p>
          </motion.div>

        </div>

        {/* Full Wide Screen Video Container */}
        <motion.div
          initial={{ opacity: 0, y: 50, filter: 'blur(20px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1, delay: 0.6, ease: 'easeOut' }}
          viewport={{ once: true, margin: '-50px' }}
          className="mt-32 w-full relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(255,222,88,0.05)] aspect-[16/9] bg-white/5"
        >
          {hasVideoError ? (
            <div className="relative w-full h-full">
              <img
                src="/GRIDGO WEBSITE.png"
                alt="GRIDGO app preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center text-center px-6">
                <p className="text-xl md:text-2xl font-bold text-white mb-2">Video preview unavailable</p>
                <p className="text-sm md:text-base text-gray-300 max-w-md">
                  The GRIDGO walkthrough could not load. The preview image remains available while the video is retried on refresh.
                </p>
              </div>
            </div>
          ) : (
            <video
              autoPlay
              loop
              muted
              controls
              playsInline
              poster="/GRIDGO WEBSITE.png"
              preload="metadata"
              onError={() => setHasVideoError(true)}
              className="w-full h-full object-cover"
            >
              <source src="/demo.mp4" type="video/mp4" />
              Video preview unavailable
            </video>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function SupportSection() {
  return (
    <section id="support" className="min-h-screen bg-map py-24 relative z-10">
      <div className="max-w-6xl mx-auto px-6">

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
          <p className="text-gray-400 max-w-xl mx-auto">
            Get help with orders, delivery updates, account questions, or technical print concerns through one tracked support flow.
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Support center */}
          <motion.div
            initial={{ opacity: 0, x: -40, filter: 'blur(20px)' }}
            whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            viewport={{ once: true, margin: '-80px' }}
            className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-10 flex flex-col gap-6 overflow-hidden"
          >
            {/* accent glow */}
            <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-[var(--color-primary)]/10 blur-3xl pointer-events-none" />

            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/15 flex items-center justify-center mb-2 border border-[var(--color-primary)]/20 shadow-[0_0_20px_rgba(255,222,88,0.15)] relative z-10">
              <MessageCircle size={32} className="text-[var(--color-primary)]" strokeWidth={1.5} />
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-2">Support Center</h3>
              <p className="text-gray-400 leading-relaxed">
                Open a support request for order issues, delivery updates, payment concerns, or technical print questions. Your details stay organized so the GRIDGO team can respond with the right next step.
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-auto">
              <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <ShieldCheck size={18} className="text-[var(--color-primary)] shrink-0" />
                <span className="text-sm text-gray-300">Verified GRIDGO support portal</span>
              </div>
              <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <Zap size={18} className="text-[var(--color-primary)] shrink-0" />
                <span className="text-sm text-gray-300">Tracked ticket response by email</span>
              </div>
            </div>

            <Link to="/support" className="mt-2 w-full py-3 rounded-full border border-[var(--color-primary)] text-[var(--color-primary)] font-semibold text-sm hover:bg-[var(--color-primary)] hover:text-black transition-all duration-300 flex justify-center items-center">
              Open Support Center
            </Link>
          </motion.div>

          {/* Message support */}
          <motion.div
            initial={{ opacity: 0, x: 40, filter: 'blur(20px)' }}
            whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
            viewport={{ once: true, margin: '-80px' }}
            className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-10 flex flex-col gap-6 overflow-hidden"
          >
            {/* accent glow */}
            <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-[var(--color-primary)]/10 blur-3xl pointer-events-none" />

            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)]/15 flex items-center justify-center">
              <MessageCircle size={28} className="text-[var(--color-primary)]" strokeWidth={1.5} />
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-2">Message Support</h3>
              <p className="text-gray-400 leading-relaxed">
                Send the context once through the support portal and a GRIDGO admin will review your ticket. It is the best available path while live chat is being prepared.
              </p>
            </div>

            {/* Support ticket preview */}
            <div className="flex flex-col gap-2 bg-black/30 rounded-2xl p-4 border border-white/5">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/30 flex items-center justify-center shrink-0">
                  <Zap size={12} className="text-[var(--color-primary)]" />
                </div>
                <div className="bg-white/10 rounded-xl rounded-tl-none px-3 py-2 text-xs text-gray-300 max-w-[80%]">
                  Tell us what happened and include your order number if you have one.
                </div>
              </div>
              <div className="flex items-start gap-2 justify-end">
                <div className="bg-[var(--color-primary)]/20 rounded-xl rounded-tr-none px-3 py-2 text-xs text-[var(--color-primary)] max-w-[80%]">
                  I need help with order #1042.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/30 flex items-center justify-center shrink-0">
                  <ShieldCheck size={12} className="text-[var(--color-primary)]" />
                </div>
                <div className="bg-white/10 rounded-xl rounded-tl-none px-3 py-2 text-xs text-gray-300 max-w-[80%]">
                  Submit the ticket and our team will reply by email with an update.
                </div>
              </div>
            </div>

            <Link to="/support" className="mt-2 w-full py-3 rounded-full bg-[var(--color-primary)] text-black font-semibold text-sm hover:bg-yellow-400 transition-all duration-300 flex justify-center items-center">
              Start Support Ticket
            </Link>
          </motion.div>
        </div>

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
            <div key={label} className="rounded-2xl bg-white/5 border border-white/10 py-4 px-2 md:py-6 md:px-4 flex flex-col items-center justify-center">
              <p className="text-[15px] sm:text-lg md:text-3xl font-bold text-[var(--color-primary)] mb-1">{value}</p>
              <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 uppercase tracking-normal md:tracking-widest break-words w-full">{label}</p>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="about" className="min-h-screen bg-map py-32 relative z-10 flex flex-col justify-center">
      <div className="max-w-[1100px] mx-auto px-8 w-full">
        <h2 className="font-heading text-4xl md:text-[42px] font-bold text-center mb-24 tracking-tight">About Us</h2>

        <div className="grid grid-cols-1 md:grid-cols-[4.5fr_7.5fr] gap-10 md:gap-16 items-stretch">
          <motion.div
            initial={{ opacity: 0, x: -50, filter: 'blur(20px)' }}
            whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1, ease: 'easeOut' }}
            viewport={{ once: true, margin: '-100px' }}
            className="w-full flex justify-center h-full"
          >
            <img src="/office.png" alt="GRIDGO Office" className="w-full h-full object-cover grayscale aspect-[4/5]" />
          </motion.div>

          <div className="flex flex-col justify-between h-full py-1">
            <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.8, ease: 'easeOut' }}>
              <div className="mb-2 leading-tight">
                <span className="font-heading text-[16px] md:text-[18px] font-normal text-white block">the</span>
                <span className="font-heading text-[24px] md:text-[28px] font-bold text-white block tracking-tight">vision.</span>
              </div>
              <p className="text-gray-300 text-[13px] md:text-[14px] font-light leading-relaxed">"To be the essential <span className="text-[var(--color-primary)] font-bold">digital printing partner in the global market</span>, making the transition from digital design to physical reality effortless and stress-free for every user."</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-50px' }} transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}>
              <div className="mb-2 leading-tight">
                <span className="font-heading text-[16px] md:text-[18px] font-normal text-white block">the</span>
                <span className="font-heading text-[24px] md:text-[28px] font-bold text-white block tracking-tight">mission.</span>
              </div>
              <p className="text-gray-300 text-[13px] md:text-[14px] font-light leading-relaxed">"To <span className="text-[var(--color-primary)] font-bold">revolutionize the printing experience</span> by combining precision technology, high - quality output, and seamless logistics, empowering professionals and students to focus on their craft."</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-50px' }} transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}>
              <div className="mb-2 leading-tight">
                <span className="font-heading text-[16px] md:text-[18px] font-normal text-white block">the</span>
                <span className="font-heading text-[24px] md:text-[28px] font-bold text-white block tracking-tight">goal.</span>
              </div>
              <p className="text-gray-300 text-[13px] md:text-[14px] font-light leading-relaxed">"To become and lead the digital printing industry within the Philippine market in the span of <span className="text-[var(--color-primary)] font-bold">three to five years</span>."</p>
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
        <img src={image} alt={name} className="w-64 h-64 object-cover rounded-full grayscale" />
      </div>
      <div className={`w-full md:w-1/2 ${reverse ? 'text-right' : 'text-left'}`}>
        <p className="text-[var(--color-primary)] font-semibold mb-1">Meet the {role}</p>
        <h3 className="text-4xl font-bold mb-4">{name}</h3>
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-6">{role.toUpperCase()}</p>
        <p className="text-lg text-gray-300 italic border-l-4 border-[var(--color-primary)] pl-6">
          {quote}
        </p>
      </div>
    </motion.div>
  );
}

function TeamSection() {
  return (
    <section className="min-h-screen bg-map py-20 relative z-10 overflow-hidden">
      <div className="px-8">
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
      </div>
    </section>
  );
}

function BetaSection() {
  const { mobileWebUrl, apkDownloadUrl, communityUrl } = landingLinks(window.location);

  return (
    <section id="download" className="min-h-[100vh] flex items-center justify-center relative z-10 py-20 px-8 overflow-hidden bg-[#050505]">
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

            <p className="text-gray-200 text-[13px] md:text-[14px] mb-8 max-w-[380px] font-light leading-relaxed">
              Become a founding member of GRIDGO and have a <span className="text-[var(--color-primary)] font-medium">free printing service</span> delivered to your door step.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 w-[95%]">
              <a
                href={mobileWebUrl}
                className="bg-white text-black font-bold py-3 px-3 rounded-full hover:bg-gray-200 transition-colors text-[13px] md:text-[14px]"
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
              <p className="font-heading text-[16px] md:text-[18px] text-white mb-6 tracking-wide font-normal">Launching soon.</p>

              <div className="flex gap-3">
                {/* App Store button */}
                <div className="border border-white/20 bg-black/40 rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors h-[44px]">
                  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.365 14.363c-.015-3.08 2.502-4.545 2.617-4.618-1.428-2.091-3.64-2.378-4.423-2.42-1.894-.19-3.693 1.115-4.654 1.115-.963 0-2.434-1.09-4.01-1.059-2.063.03-3.965 1.196-5.029 3.037-2.146 3.712-.55 9.206 1.543 12.235 1.025 1.48 2.235 3.134 3.84 3.076 1.531-.061 2.112-.99 3.94-.99 1.828 0 2.35.99 3.94 1.02 1.636.03 2.686-1.449 3.706-2.94 1.176-1.716 1.66-3.376 1.682-3.46-.035-.015-3.146-1.206-3.152-4.996zM14.935 5.568c.843-1.02 1.411-2.436 1.256-3.848-1.218.049-2.695.811-3.565 1.826-.701.815-1.383 2.264-1.198 3.645 1.364.105 2.663-.603 3.507-1.623z" />
                  </svg>
                  <div className="flex flex-col items-start justify-center">
                    <span className="text-[9px] leading-[1] text-gray-300 mb-[2px]">Download on the</span>
                    <span className="text-[14px] font-semibold leading-[1]">App Store</span>
                  </div>
                </div>

                {/* Google Play button */}
                <div className="border border-white/20 bg-black/40 rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors h-[44px]">
                  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186c-.165-.133-.298-.3-.389-.49A1.737 1.737 0 013 20.854V3.146c0-.306.075-.596.221-.842.146-.246.353-.448.6-.58.058-.031.121-.059.188-.083v.173zm1.116-.503l9.96 5.75L15.3 7.644 4.725 1.311zm11.393 6.643L20.655 10.6a1.738 1.738 0 010 2.802l-4.537 2.645-1.572-1.571 1.572-1.572zM4.725 22.689l10.575-6.333-1.403-1.403-9.172 7.736z" />
                  </svg>
                  <div className="flex flex-col items-start justify-center">
                    <span className="text-[9px] leading-[1] text-gray-300 mb-[2px]">GET IT ON</span>
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

function App() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
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

    document.body.style.backgroundColor = '#000';
    document.body.style.color = '#fff';

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="w-full relative custom-scrollbar bg-black text-white">
      <Navbar />

      {/* The 3D Parallax Canvas stays fixed in the background */}
      <PhoneScene />

      {/* Scrollable Content */}
      <div className="relative w-full">
        <HeroSection />
        <ProcessSection />
        <FeaturesSection />
        <HowItWorksSection />
        <SupportSection />
        <AboutSection />
        <TeamSection />
        <BetaSection />
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 right-8 z-50 p-3 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] shadow-lg transition-all duration-300"
          >
            <ChevronUp size={24} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
