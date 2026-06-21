import React from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

interface StatItem {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
}

// Animated stat card: staggered entrance, pointer-tilt 3D, hover lift + sheen.
// Mirrors the admin Overview cards. All motion is disabled under prefers-reduced-motion.
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
      <div className="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-blue-light/0 group-hover:bg-blue-light/10 blur-2xl transition-colors duration-500" />
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-blue-deep shrink-0 transition-transform duration-300 group-hover:scale-105">
          <Icon className="w-5 h-5 text-white" />
        </span>
        <div>
          <p className="text-2xl font-display font-bold text-text-dark tabular-nums leading-none">{value}</p>
          <p className="text-sm text-text-mid mt-1">{label}</p>
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
