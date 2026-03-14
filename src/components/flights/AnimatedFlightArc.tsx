import { Plane } from "lucide-react";

interface AnimatedFlightArcProps {
  height?: number;
  direction?: "departure" | "return";
  compact?: boolean;
}

export default function AnimatedFlightArc({ height = 12, direction = "departure", compact = false }: AnimatedFlightArcProps) {
  const isReturn = direction === "return";
  const arcH = compact ? 28 : 36;

  return (
    <div className="w-full relative flex items-center justify-center" style={{ height: `${arcH}px` }}>
      {/* Origin dot */}
      <div className="absolute left-0 bottom-1 z-10">
        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
      </div>

      {/* SVG arc path + animated arrows */}
      <svg
        viewBox="0 0 200 50"
        className="w-full"
        style={{ height: arcH }}
        preserveAspectRatio="none"
      >
        {/* Dashed arc path */}
        <path
          d={isReturn ? "M 195 40 Q 100 -10 5 40" : "M 5 40 Q 100 -10 195 40"}
          fill="none"
          stroke="hsl(var(--primary) / 0.15)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />

        {/* Animated arrow group 1 */}
        <g className={isReturn ? "flight-arrows-return" : "flight-arrows-depart"}>
          {Array.from({ length: 8 }).map((_, i) => {
            const t = (i + 1) / 10;
            // Quadratic bezier point calculation
            const cx = isReturn ? 195 : 5;
            const cy = 40;
            const mx = 100;
            const my = -10;
            const ex = isReturn ? 5 : 195;
            const ey = 40;
            const x = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex;
            const y = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ey;
            // Tangent for rotation
            const dx = 2 * (1 - t) * (mx - cx) + 2 * t * (ex - mx);
            const dy = 2 * (1 - t) * (my - cy) + 2 * t * (ey - my);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            return (
              <text
                key={i}
                x={x}
                y={y}
                fill="hsl(var(--primary))"
                fontSize={compact ? 7 : 8}
                fontWeight="900"
                opacity={0.35 + i * 0.06}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${angle}, ${x}, ${y})`}
              >
                ›
              </text>
            );
          })}
        </g>

        {/* Animated arrow group 2 (offset for continuous feel) */}
        <g className={isReturn ? "flight-arrows-return-2" : "flight-arrows-depart-2"}>
          {Array.from({ length: 8 }).map((_, i) => {
            const t = (i + 0.5) / 10;
            const cx = isReturn ? 195 : 5;
            const cy = 40;
            const mx = 100;
            const my = -10;
            const ex = isReturn ? 5 : 195;
            const ey = 40;
            const x = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex;
            const y = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ey;
            const dx = 2 * (1 - t) * (mx - cx) + 2 * t * (ex - mx);
            const dy = 2 * (1 - t) * (my - cy) + 2 * t * (ey - my);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            return (
              <text
                key={i}
                x={x}
                y={y}
                fill="hsl(var(--primary))"
                fontSize={compact ? 7 : 8}
                fontWeight="900"
                opacity={0.2 + i * 0.05}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${angle}, ${x}, ${y})`}
              >
                ›
              </text>
            );
          })}
        </g>
      </svg>

      {/* Plane icon at arc peak */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="relative">
          <div className="absolute -inset-2 bg-primary/10 rounded-full blur-md" />
          <Plane
            className={`text-primary drop-shadow-md ${isReturn ? "-scale-x-100" : ""}`}
            style={{
              width: compact ? 16 : 20,
              height: compact ? 16 : 20,
              filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.4))',
              transform: `${isReturn ? "scaleX(-1)" : ""} rotate(-20deg)`,
            }}
          />
        </div>
      </div>

      {/* Destination dot */}
      <div className="absolute right-0 bottom-1 z-10">
        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
      </div>
    </div>
  );
}
