import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion, animate } from 'framer-motion';

interface StatItem {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
}

// Per-card accent: a single brand token plus a white gloss overlay, which reads
// as a 3D "bead" without resorting to off-brand multi-hue gradients. The same
// icon is echoed as a faint corner watermark for depth.
const ACCENT_BG = ['bg-blue-deep', 'bg-green-mid', 'bg-green-fresh', 'bg-gold'];
const ACCENT_GHOST = ['text-blue-deep', 'text-green-mid', 'text-green-fresh', 'text-gold'];

// Eases a number up from 0 on mount. Stays static under prefers-reduced-motion.
export function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setDisplay(value); return; }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <>{display.toLocaleString()}</>;
}

// Animated stat card: staggered entrance, pointer-tilt 3D, hover lift, glossy
// accent badge, count-up value, and a ghosted icon watermark. All motion is
// disabled under prefers-reduced-motion.
function StatCard({ icon: Icon, value, label, index }: StatItem & { index: number }) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 220, damping: 18 });
  const rotateY = useSpring(ry, { stiffness: 220, damping: 18 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * 8);
    rx.set(-py * 8);
  };
  const reset = () => { rx.set(0); ry.set(0); };

  const accentBg = ACCENT_BG[index % ACCENT_BG.length];
  const accentGhost = ACCENT_GHOST[index % ACCENT_GHOST.length];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      whileHover={reduce ? undefined : { y: -4 }}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className="group relative overflow-hidden bg-card border border-hairline rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 p-6 will-change-transform"
    >
      {/* Faint oversized echo of the icon, anchored bottom-right for depth */}
      <Icon
        aria-hidden
        className={`pointer-events-none absolute -bottom-5 -right-4 w-28 h-28 ${accentGhost} opacity-[0.06] group-hover:opacity-[0.1] transition-opacity duration-500`}
      />
      {/* Soft hover glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-blue-light/0 group-hover:bg-blue-light/15 blur-2xl transition-colors duration-500" />

      <div className="relative flex items-center gap-3.5">
        <span
          className={`relative inline-flex items-center justify-center w-12 h-12 rounded-2xl ${accentBg} shadow-lg ring-1 ring-white/15 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}
        >
          {/* white gloss highlight for the 3D bead look */}
          <span aria-hidden className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 to-transparent" />
          <Icon className="relative w-5 h-5 text-white" />
        </span>
        <div>
          <p className="text-3xl font-display font-bold text-text-dark tabular-nums leading-none">
            {typeof value === 'number' ? <CountUp value={value} /> : value}
          </p>
          <p className="text-sm text-text-mid mt-1.5">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function IconStatGrid({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((s, i) => (
        <StatCard key={i} index={i} {...s} />
      ))}
    </div>
  );
}
