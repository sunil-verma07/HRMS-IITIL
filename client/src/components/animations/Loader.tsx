import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoaderProps {
  onComplete: () => void;
}

export default function Loader({ onComplete }: LoaderProps) {
  const [visible, setVisible] = useState(true);
  // Detect dark mode without a theme context – respects <html class="dark">
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Read current dark class from <html>
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();

    // Optional: watch for class changes (if you toggle dark mode later)
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(false), 3000);
    const t2 = setTimeout(() => onComplete(), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  // Logos must be in your public folder (or imported)
  const logoSrc = isDark
    ? '/assets/enterprise_dark.png'
    : '/assets/enterprise_light.png';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'var(--background)' }}   // 👈 uses your CSS variable
        >
          {/* Ambient glow - optional */}
          <motion.div
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 0.6, scale: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="absolute pointer-events-none rounded-full"
            style={{
              width: 400,
              height: 400,
              background:
                'radial-gradient(circle, rgba(34,211,238,0.14) 0%, rgba(59,130,246,0.08) 45%, transparent 70%)',
              filter: 'blur(28px)',
            }}
          />

          {/* Logo + shimmer */}
          <motion.div
            initial={{ scale: 3.5, opacity: 0, filter: 'blur(18px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center gap-5"
          >
            <div style={{ width: 110, height: 110, position: 'relative' }}>
              <img
                src={logoSrc}
                alt="Crediple"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            {/* Shimmer progress bar */}
            <div
              className="rounded-full overflow-hidden"
              style={{ width: 80, height: 2, background: 'var(--border)' }}
            >
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.5,
                }}
                className="h-full w-1/2 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, var(--accent-color, #93c5fd), var(--accent-secondary, #818cf8), transparent)',
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}