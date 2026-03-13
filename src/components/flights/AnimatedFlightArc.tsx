import { useId } from "react";
import { motion } from "framer-motion";
import { Plane } from "lucide-react";

interface AnimatedFlightArcProps {
  height?: number;
  /** Use lighter animation for list cards (no motion plane, just dashed arc + pulsing dots) */
  compact?: boolean;
}

export default function AnimatedFlightArc({ height = 12, compact = false }: AnimatedFlightArcProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `arcGrad_${uid}`;
  const viewH = height === 10 ? 40 : 45;
  const baseY = height === 10 ? 34 : 38;
  const peakY = height === 10 ? 2 : 4;

  return (
    <div className={`w-full relative h-${height}`} style={{ height: `${height * 4}px` }}>
      <svg className="w-full h-full" viewBox={`0 0 200 ${viewH}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.4" />
            <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {/* Glow */}
        <path d={`M 8 ${baseY} Q 100 ${peakY} 192 ${baseY}`} fill="none" stroke="hsl(var(--accent))" strokeWidth="3" opacity="0.1" />
        {/* Animated dashed arc */}
        <path d={`M 8 ${baseY} Q 100 ${peakY} 192 ${baseY}`} fill="none" stroke={`url(#${gradId})`} strokeWidth="1.5" strokeDasharray="6 4">
          <animate attributeName="stroke-dashoffset" values="0;-20" dur="3s" repeatCount="indefinite" />
        </path>
        {/* Origin dot with pulse */}
        <circle cx="8" cy={baseY} r="3" className="fill-accent/70">
          <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="8" cy={baseY} r="6" fill="none" className="stroke-accent/20" strokeWidth="1" />
        {/* Destination dot with pulse */}
        <circle cx="192" cy={baseY} r="3" className="fill-accent/70">
          <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" begin="1s" />
        </circle>
        <circle cx="192" cy={baseY} r="6" fill="none" className="stroke-accent/20" strokeWidth="1" />
      </svg>
      {/* Animated plane */}
      {compact ? (
        <Plane className="w-3.5 h-3.5 text-accent absolute top-0.5 left-1/2 -translate-x-1/2 rotate-90 drop-shadow-sm" style={{ filter: 'drop-shadow(0 0 3px hsl(var(--accent) / 0.4))' }} />
      ) : (
        <motion.div
          className="absolute z-10"
          animate={{
            left: ['4%', '48%', '96%'],
            top: ['78%', '6%', '78%'],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' }}
        >
          <div className="relative -translate-x-1/2 -translate-y-1/2">
            <div className="absolute -inset-2 bg-accent/20 rounded-full blur-md" />
            <Plane className="w-4 h-4 text-accent rotate-[45deg] drop-shadow-md" style={{ filter: 'drop-shadow(0 0 4px hsl(var(--accent) / 0.5))' }} />
          </div>
        </motion.div>
      )}
    </div>
  );
}
