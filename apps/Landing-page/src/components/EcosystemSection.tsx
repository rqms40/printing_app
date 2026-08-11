import { useEffect, useRef, useState } from 'react';
import type { ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from 'react';
import { motion } from 'framer-motion';
import { UserIcon, BriefcaseBusinessIcon, HammerIcon } from 'lucide-animated';

type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

type AnimatedIconProps = HTMLAttributes<HTMLDivElement> & {
  size?: number;
};

type AnimatedIconComponent = ForwardRefExoticComponent<
  AnimatedIconProps & RefAttributes<AnimatedIconHandle>
>;

function AnimatedEcosystemIcon({ icon: Icon, size = 28 }: { icon: AnimatedIconComponent, size?: number }) {
  const iconRef = useRef<AnimatedIconHandle>(null);

  useEffect(() => {
    // Add a slight random delay so they don't animate exactly at the same time
    const delay = Math.random() * 1000;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        iconRef.current?.startAnimation();
      }, 3500);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (interval !== undefined) clearInterval(interval);
    };
  }, []);

  return <Icon ref={iconRef} size={size} />;
}

export function EcosystemSection() {
  const [activeIndex, setActiveIndex] = useState(1);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, [isHovered]);

  return (
    <section id="ecosystem" className="min-h-screen bg-white dark:bg-[#050505] py-32 relative z-10 text-black dark:text-white flex flex-col justify-center">
      <div className="max-w-[1200px] mx-auto px-6 w-full">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(15px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          viewport={{ once: true, margin: '-50px' }}
          className="text-center mb-24"
        >
          <p className="text-xs tracking-[0.35em] uppercase text-[var(--color-primary)] mb-3 font-bold">One Platform. Dual Power.</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">The GRIDGO Ecosystem</h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Whether you're a student needing a quick print or a business managing multiple branches, our centralized platform ensures absolute quality assurance and effortless ease of use.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* B2C Card */}
          <motion.div
            initial={{ opacity: 0, x: -30, filter: 'blur(15px)' }}
            whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ 
              opacity: { duration: 0.8, ease: 'easeOut' },
              x: { duration: 0.8, ease: 'easeOut' },
              filter: { duration: 0.8, ease: 'easeOut' },
              scale: { duration: 0.4, ease: 'easeInOut' }
            }}
            viewport={{ once: true, margin: '-50px' }}
            animate={{ scale: activeIndex === 0 ? 1.05 : 1 }}
            onMouseEnter={() => { setIsHovered(true); setActiveIndex(0); }}
            onMouseLeave={() => setIsHovered(false)}
            className={`rounded-3xl border border-black/10 dark:border-white/10 p-10 md:p-14 bg-black/[0.02] dark:bg-white/[0.02] flex flex-col hover:border-black/20 dark:hover:border-white/20 transition-all duration-500 origin-center relative ${activeIndex === 0 ? 'shadow-2xl z-20' : 'z-10'}`}
          >
            <div className="w-16 h-16 rounded-2xl bg-black/10 dark:bg-white/10 flex items-center justify-center mb-8 border border-black/10 dark:border-white/10 text-black dark:text-white">
              <AnimatedEcosystemIcon icon={UserIcon} size={28} />
            </div>
            <h3 className="text-3xl font-bold mb-4 tracking-tight">GRIDGO</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed text-base">
              On-demand 2D/3D printing and custom merch for students and consumers.
            </p>
            <ul className="space-y-4 mt-4">
              <li className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 mt-0.5 flex-shrink-0 flex items-center justify-center border border-black/5 dark:border-white/5">
                  <div className="w-2 h-2 rounded-full bg-black dark:bg-white" />
                </div>
                <span className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-200"><strong>Express Delivery:</strong> Fast, on-demand fulfillment.</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 mt-0.5 flex-shrink-0 flex items-center justify-center border border-black/5 dark:border-white/5">
                  <div className="w-2 h-2 rounded-full bg-black dark:bg-white" />
                </div>
                <span className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-200"><strong>Batch Delivery:</strong> Scheduled, low-cost delivery runs.</span>
              </li>
            </ul>
          </motion.div>

          {/* B2B Card */}
          <motion.div
            initial={{ opacity: 0, y: 30, filter: 'blur(15px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ 
              opacity: { duration: 0.8, delay: 0.2, ease: 'easeOut' },
              y: { duration: 0.8, delay: 0.2, ease: 'easeOut' },
              filter: { duration: 0.8, delay: 0.2, ease: 'easeOut' },
              scale: { duration: 0.4, ease: 'easeInOut' }
            }}
            viewport={{ once: true, margin: '-50px' }}
            animate={{ scale: activeIndex === 1 ? 1.05 : 1 }}
            onMouseEnter={() => { setIsHovered(true); setActiveIndex(1); }}
            onMouseLeave={() => setIsHovered(false)}
            className={`rounded-3xl border p-10 md:p-14 bg-[var(--color-primary)]/[0.05] flex flex-col relative overflow-hidden group transition-all duration-500 origin-center ${activeIndex === 1 ? 'border-[var(--color-primary)]/80 shadow-[0_0_40px_rgba(255,222,88,0.15)] z-20' : 'border-[var(--color-primary)]/40 hover:border-[var(--color-primary)]/80 z-10'}`}
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-primary)]/10 blur-[100px] pointer-events-none rounded-full group-hover:bg-[var(--color-primary)]/20 transition-colors duration-700" />

            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(255,222,88,0.3)] text-black relative z-10">
              <AnimatedEcosystemIcon icon={BriefcaseBusinessIcon} size={28} />
            </div>
            <h3 className="text-3xl font-bold mb-4 tracking-tight relative z-10">GRIDGO Businesses</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed text-base relative z-10">
              One centralized platform for all corporate printing needs—from signages to apparel.
            </p>
            <ul className="space-y-4 mt-4 relative z-10">
              <li className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 mt-0.5 flex-shrink-0 flex items-center justify-center border border-[var(--color-primary)]/30">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                </div>
                <span className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-200"><strong>One-Stop Management:</strong> Single dashboard & BIR invoicing.</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 mt-0.5 flex-shrink-0 flex items-center justify-center border border-[var(--color-primary)]/30">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                </div>
                <span className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-200"><strong>Quality Assurance:</strong> Automated pre-flight & QA checks.</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 mt-0.5 flex-shrink-0 flex items-center justify-center border border-[var(--color-primary)]/30">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                </div>
                <span className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-200"><strong>Zero-Risk Guarantee:</strong> Escrow protection & free reprints.</span>
              </li>
            </ul>
          </motion.div>

          {/* Supplier Card */}
          <motion.div
            initial={{ opacity: 0, x: 30, filter: 'blur(15px)' }}
            whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ 
              opacity: { duration: 0.8, delay: 0.4, ease: 'easeOut' },
              x: { duration: 0.8, delay: 0.4, ease: 'easeOut' },
              filter: { duration: 0.8, delay: 0.4, ease: 'easeOut' },
              scale: { duration: 0.4, ease: 'easeInOut' }
            }}
            viewport={{ once: true, margin: '-50px' }}
            animate={{ scale: activeIndex === 2 ? 1.05 : 1 }}
            onMouseEnter={() => { setIsHovered(true); setActiveIndex(2); }}
            onMouseLeave={() => setIsHovered(false)}
            className={`rounded-3xl border border-black/10 dark:border-white/10 p-10 bg-black/[0.02] dark:bg-white/[0.02] flex flex-col hover:border-black/20 dark:hover:border-white/20 transition-all duration-500 origin-center relative ${activeIndex === 2 ? 'shadow-2xl z-20' : 'z-10'}`}
          >
            <div className="w-16 h-16 rounded-2xl bg-black/10 dark:bg-white/10 flex items-center justify-center mb-8 border border-black/10 dark:border-white/10 text-black dark:text-white">
              <AnimatedEcosystemIcon icon={HammerIcon} size={28} />
            </div>
            <h3 className="text-3xl font-bold mb-4 tracking-tight">GRIDGO Suppliers</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed text-base">
              Join our vetted network of print shops and fabricators to power the ecosystem.
            </p>
            <ul className="space-y-4 mt-4">
              <li className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 mt-0.5 flex-shrink-0 flex items-center justify-center border border-black/5 dark:border-white/5">
                  <div className="w-2 h-2 rounded-full bg-black dark:bg-white" />
                </div>
                <span className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-200"><strong>Streamlined Pipeline:</strong> Ready-to-print, verified orders.</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 mt-0.5 flex-shrink-0 flex items-center justify-center border border-black/5 dark:border-white/5">
                  <div className="w-2 h-2 rounded-full bg-black dark:bg-white" />
                </div>
                <span className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-200"><strong>Automated Logistics:</strong> We handle delivery dispatch.</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 mt-0.5 flex-shrink-0 flex items-center justify-center border border-black/5 dark:border-white/5">
                  <div className="w-2 h-2 rounded-full bg-black dark:bg-white" />
                </div>
                <span className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-200"><strong>Guaranteed Payouts:</strong> Secure, automatic payments.</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
