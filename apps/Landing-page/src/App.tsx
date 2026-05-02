import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { PhoneScene } from './components/PhoneScene';
import { UploadCloud, Truck, ListOrdered, Clock, Headphones, Menu, X, Phone, MessageCircle, Zap, ShieldCheck } from 'lucide-react';

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0, filter: 'blur(10px)' }}
        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-[60] px-8 py-4 flex items-center justify-between"
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
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
          <span className="text-xl font-bold tracking-widest uppercase">GRID</span>
        </div>

        {/* Center Nav */}
        <div className="hidden md:flex glass-nav rounded-full px-6 py-2 items-center gap-8 text-sm font-medium">
          <a href="#features" className="hover:text-[var(--color-primary)] transition-colors">Features</a>
          <a href="#process" className="hover:text-[var(--color-primary)] transition-colors">How it Works</a>
          <a href="#support" className="hover:text-[var(--color-primary)] transition-colors">Support</a>
          <a href="#about" className="hover:text-[var(--color-primary)] transition-colors">About Us</a>
          <a href="#download" className="hover:text-[var(--color-primary)] transition-colors">Download</a>
        </div>

        {/* Right Nav */}
        <div className="hidden md:flex glass-nav rounded-full items-center text-sm font-medium overflow-hidden p-1">
          <button className="px-6 py-2 hover:bg-white/10 rounded-full transition-colors">Log In</button>
          <button className="px-6 py-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors">Sign Up</button>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          className="md:hidden glass-nav p-2 rounded-full z-50 relative"
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
            <div className="flex gap-4 mt-8">
              <button className="px-8 py-3 glass-nav rounded-full transition-colors font-bold" onClick={() => setIsOpen(false)}>Log In</button>
              <button className="px-8 py-3 bg-[var(--color-primary)] text-black rounded-full hover:bg-yellow-400 transition-colors font-bold" onClick={() => setIsOpen(false)}>Sign Up</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function HeroSection() {
  return (
    <section className="h-[100vh] flex flex-col items-center justify-center relative z-10 pointer-events-none">
      {/* The Hero text is now fully rendered in 3D within PhoneScene.tsx */}
    </section>
  );
}

function ProcessSection() {
  return (
    <section id="process" className="h-[100vh] flex flex-col items-center justify-end pb-32 relative z-10 bg-map">
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

function FeatureCard({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: 'blur(15px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      viewport={{ once: true, margin: '-50px' }}
      whileHover={{ y: -10 }}
      className="flex flex-col items-center text-center p-6 text-black"
    >
      <div className="w-16 h-16 mb-4 relative flex items-center justify-center">
        <Icon size={48} strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-sm opacity-80 leading-relaxed">{desc}</p>
    </motion.div>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="min-h-screen bg-[var(--color-primary)] text-black py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-20">Features</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          <FeatureCard
            icon={UploadCloud}
            title="One-Tap Upload"
            desc="No more carrying USB sticks or emailing files to yourself. Directly upload your documents or 3D designs from your phone or cloud storage in seconds."
          />
          <FeatureCard
            icon={Truck}
            title="Live Order Tracking"
            desc="Watch your project move from the printer to the delivery rider in real-time. You'll know exactly when your package is arriving, just like a food delivery app."
          />
          <FeatureCard
            icon={ListOrdered}
            title="The Queue"
            desc="Need a document and a 3D model at the same time? Add different types of prints to a single order and have them all delivered in one go to save on shipping."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
          <FeatureCard
            icon={Clock}
            title="24/7 App Operations"
            desc="Inspiration doesn't have a closing time. Whether it's 2 PM or 2 AM, you can upload your files and start the process. Our system works 24/7 so your project never has to wait for a shop to open."
          />
          <FeatureCard
            icon={Headphones}
            title="Live Support & Tracking"
            desc="From the moment you upload to the second it hits your doorstep, help is just a tap away. Chat live with your delivery rider for drop-off updates or message our support team anytime for any questions. We bridge the gap between you and your print."
          />
        </div>
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
            Whether you need a quick answer or live human help, GRID has you covered — 24 hours a day.
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* ── Number Hub ── */}
          <motion.div
            initial={{ opacity: 0, x: -40, filter: 'blur(20px)' }}
            whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            viewport={{ once: true, margin: '-80px' }}
            className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-10 flex flex-col gap-6 overflow-hidden"
          >
            {/* accent glow */}
            <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-[var(--color-primary)]/10 blur-3xl pointer-events-none" />

            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)]/15 flex items-center justify-center">
              <Phone size={28} className="text-[var(--color-primary)]" strokeWidth={1.5} />
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-2">Number Hub</h3>
              <p className="text-gray-400 leading-relaxed">
                Call or message our dedicated support line directly. Our operators are on standby to handle order issues, delivery updates, and technical questions in real time.
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-auto">
              <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <ShieldCheck size={18} className="text-[var(--color-primary)] shrink-0" />
                <span className="text-sm text-gray-300">Verified GRID support line</span>
              </div>
              <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <Zap size={18} className="text-[var(--color-primary)] shrink-0" />
                <span className="text-sm text-gray-300">Instant callback within 5 minutes</span>
              </div>
            </div>

            <button className="mt-2 w-full py-3 rounded-full border border-[var(--color-primary)] text-[var(--color-primary)] font-semibold text-sm hover:bg-[var(--color-primary)] hover:text-black transition-all duration-300">
              Call Support Hub
            </button>
          </motion.div>

          {/* ── Live Chat ── */}
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
              <h3 className="text-2xl font-bold mb-2">Live Chat</h3>
              <p className="text-gray-400 leading-relaxed">
                Start a conversation instantly — our AI handles common questions in seconds. For anything more complex, a real GRID admin seamlessly takes over the chat.
              </p>
            </div>

            {/* mock chat bubble preview */}
            <div className="flex flex-col gap-2 bg-black/30 rounded-2xl p-4 border border-white/5">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/30 flex items-center justify-center shrink-0">
                  <Zap size={12} className="text-[var(--color-primary)]" />
                </div>
                <div className="bg-white/10 rounded-xl rounded-tl-none px-3 py-2 text-xs text-gray-300 max-w-[80%]">
                  Hi! I'm the GRID AI assistant. How can I help you today?
                </div>
              </div>
              <div className="flex items-start gap-2 justify-end">
                <div className="bg-[var(--color-primary)]/20 rounded-xl rounded-tr-none px-3 py-2 text-xs text-[var(--color-primary)] max-w-[80%]">
                  Where's my order?
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/30 flex items-center justify-center shrink-0">
                  <ShieldCheck size={12} className="text-[var(--color-primary)]" />
                </div>
                <div className="bg-white/10 rounded-xl rounded-tl-none px-3 py-2 text-xs text-gray-300 max-w-[80%]">
                  Your order #1042 is currently out for delivery! ETA: 15 minutes.
                </div>
              </div>
            </div>

            <button className="mt-2 w-full py-3 rounded-full bg-[var(--color-primary)] text-black font-semibold text-sm hover:bg-yellow-400 transition-all duration-300">
              Start a Chat
            </button>
          </motion.div>
        </div>

        {/* Bottom stat row */}
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-3 gap-4 mt-12 text-center"
        >
          {[
            { value: '< 5 min', label: 'Avg. response time' },
            { value: '24 / 7',  label: 'Support availability' },
            { value: '99 %',    label: 'Issue resolution rate' },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-2xl bg-white/5 border border-white/10 py-6 px-4">
              <p className="text-2xl md:text-3xl font-bold text-[var(--color-primary)] mb-1">{value}</p>
              <p className="text-xs text-gray-400 uppercase tracking-widest">{label}</p>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="about" className="min-h-screen bg-map py-32 relative z-10">
      <div className="max-w-6xl mx-auto px-8">
        <h2 className="text-4xl font-bold text-center mb-20">About Us</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50, filter: 'blur(20px)' }}
            whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1, ease: 'easeOut' }}
            viewport={{ once: true, margin: '-100px' }}
          >
            <img src="/office.png" alt="GRID Office" className="w-full rounded-2xl grayscale" />
          </motion.div>

          <div className="flex flex-col gap-8">
            <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.8, ease: 'easeOut' }}>
              <h3 className="text-2xl font-bold mb-2">the <br />vision.</h3>
              <p className="text-gray-300">"To be the essential <span className="text-[var(--color-primary)] font-bold">digital printing partner in the global market</span>, making the transition from digital design to physical reality effortless and stress-free for every user."</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-50px' }} transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}>
              <h3 className="text-2xl font-bold mb-2">the <br />mission.</h3>
              <p className="text-gray-300">"To <span className="text-[var(--color-primary)] font-bold">revolutionize the printing experience</span> by combining precision technology, high-quality output, and seamless logistics, empowering professionals and students to focus on their craft."</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-50px' }} transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}>
              <h3 className="text-2xl font-bold mb-2">the <br />goal.</h3>
              <p className="text-gray-300">"To become and lead the digital printing industry within the Philippine market in the span of <span className="text-[var(--color-primary)] font-bold">three to five years</span>."</p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TeamMember({ image, role, name, quote, delay = 0, reverse = false }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, filter: 'blur(20px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 1, delay, ease: "easeOut" }}
      className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 max-w-5xl mx-auto mb-32`}
    >
      <div className="w-full md:w-1/2 flex justify-center">
        <img src={image} alt={name} className="w-64 h-64 object-cover rounded-full grayscale hover:grayscale-0 transition-all duration-500" />
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
          quote="Programming is not about what you know; it is about what you can figure out. Therefore, I am a programmer."
          reverse={true}
        />
        <TeamMember
          image="/Ven.png"
          role="Developer"
          name="Rovenado Nesta Villotes"
          quote="Tools will come, Tools will go. Only the Vibe Coder remains."
        />
      </div>
    </section>
  );
}

function BetaSection() {
  return (
    <section id="download" className="h-[100vh] flex flex-col justify-center relative z-10 p-8 md:p-20 overflow-hidden bg-map">
      <div className="max-w-7xl mx-auto w-full flex justify-end">
        <motion.div
          initial={{ opacity: 0, x: 50, filter: 'blur(20px)' }}
          whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: 'easeOut' }}
          viewport={{ once: true, margin: '-100px' }}
          className="w-full md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Be part of <span className="text-[var(--color-primary)]">Beta Access</span>
          </h2>

          <p className="text-gray-300 mb-10 max-w-sm">
            Become a founding member of GRID and have a <span className="text-[var(--color-primary)]">free printing service</span> delivered to your door step.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-16 w-full max-w-sm">
            <button className="flex-1 bg-white text-black font-bold py-3 px-6 rounded-full hover:bg-gray-200 transition-colors text-sm">
              Access Mobile Web
            </button>
            <button className="flex-1 bg-[var(--color-primary)] text-black font-bold py-3 px-6 rounded-full hover:bg-yellow-400 transition-colors text-sm">
              Download APK
            </button>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <p className="text-lg text-[var(--color-primary)] mb-1">The future of printing is almost here.</p>
            <p className="text-lg mb-8">Launching soon.</p>

            <div className="flex gap-4">
              <div className="border border-white/30 rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.365 14.363c-.015-3.08 2.502-4.545 2.617-4.618-1.428-2.091-3.64-2.378-4.423-2.42-1.894-.19-3.693 1.115-4.654 1.115-.963 0-2.434-1.09-4.01-1.059-2.063.03-3.965 1.196-5.029 3.037-2.146 3.712-.55 9.206 1.543 12.235 1.025 1.48 2.235 3.134 3.84 3.076 1.531-.061 2.112-.99 3.94-.99 1.828 0 2.35.99 3.94 1.02 1.636.03 2.686-1.449 3.706-2.94 1.176-1.716 1.66-3.376 1.682-3.46-.035-.015-3.146-1.206-3.152-4.996zM14.935 5.568c.843-1.02 1.411-2.436 1.256-3.848-1.218.049-2.695.811-3.565 1.826-.701.815-1.383 2.264-1.198 3.645 1.364.105 2.663-.603 3.507-1.623z" />
                </svg>
                <div className="text-left">
                  <div className="text-[9px] leading-none text-gray-300">Download on the</div>
                  <div className="text-xs font-bold leading-none mt-1">App Store</div>
                </div>
              </div>

              <div className="border border-white/30 rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186c-.165-.133-.298-.3-.389-.49A1.737 1.737 0 013 20.854V3.146c0-.306.075-.596.221-.842.146-.246.353-.448.6-.58.058-.031.121-.059.188-.083v.173zm1.116-.503l9.96 5.75L15.3 7.644 4.725 1.311zm11.393 6.643L20.655 10.6a1.738 1.738 0 010 2.802l-4.537 2.645-1.572-1.571 1.572-1.572zM4.725 22.689l10.575-6.333-1.403-1.403-9.172 7.736z" />
                </svg>
                <div className="text-left">
                  <div className="text-[9px] leading-none text-gray-300">GET IT ON</div>
                  <div className="text-xs font-bold leading-none mt-1">Google Play</div>
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
  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.body.style.color = '#fff';
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
        <SupportSection />
        <AboutSection />
        <TeamSection />
        <BetaSection />
      </div>
    </div>
  );
}

export default App;
