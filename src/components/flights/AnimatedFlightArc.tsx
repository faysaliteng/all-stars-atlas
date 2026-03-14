import { Plane } from "lucide-react";

interface AnimatedFlightArcProps {
  height?: number;
  /** "departure" = >>> ✈ >>> (left-to-right), "return" = <<< ✈ <<< (right-to-left) */
  direction?: "departure" | "return";
  /** Use lighter style for compact list cards */
  compact?: boolean;
}

export default function AnimatedFlightArc({ height = 12, direction = "departure", compact = false }: AnimatedFlightArcProps) {
  const isReturn = direction === "return";

  return (
    <div className="w-full relative flex items-center" style={{ height: `${compact ? 20 : 28}px` }}>
      {/* Origin dot */}
      <div className="relative shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-accent ring-[3px] ring-accent/20" />
      </div>

      {/* Chevron track */}
      <div className="flex-1 relative mx-1 overflow-hidden flex items-center" style={{ height: compact ? 16 : 20 }}>
        {/* Animated chevrons */}
        <div
          className="absolute inset-0 flex items-center chevron-track"
          style={{
            animation: isReturn ? 'chevron-scroll-left 2s linear infinite' : 'chevron-scroll-right 2s linear infinite',
          }}
        >
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className="text-accent/40 font-black shrink-0 select-none"
              style={{ fontSize: compact ? 10 : 12, letterSpacing: -1, width: compact ? 8 : 10 }}
            >
              {isReturn ? "‹" : "›"}
            </span>
          ))}
        </div>

        {/* Gradient fade edges */}
        <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none" />

        {/* Static plane in center */}
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="relative">
            <div className="absolute -inset-2 bg-accent/10 rounded-full blur-md" />
            <Plane
              className={`text-accent drop-shadow-sm ${isReturn ? "rotate-[270deg]" : "rotate-90"} ${compact ? "w-3.5 h-3.5" : "w-4.5 h-4.5"}`}
              style={{
                filter: 'drop-shadow(0 0 4px hsl(var(--accent) / 0.5))',
                width: compact ? 14 : 18,
                height: compact ? 14 : 18,
              }}
            />
          </div>
        </div>
      </div>

      {/* Destination dot */}
      <div className="relative shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-accent ring-[3px] ring-accent/20" />
      </div>
    </div>
  );
}
