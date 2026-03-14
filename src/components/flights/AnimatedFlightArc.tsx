interface AnimatedFlightArcProps {
  height?: number;
  direction?: "departure" | "return";
  compact?: boolean;
}

export default function AnimatedFlightArc({ height = 12, direction = "departure", compact = false }: AnimatedFlightArcProps) {
  const isReturn = direction === "return";
  const h = compact ? 22 : 28;

  const planePath = "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z";
  const planeSize = compact ? 16 : 20;

  const departColor = "#2563eb";
  const returnColor = "#7c3aed";
  const color = isReturn ? returnColor : departColor;

  return (
    <div className="w-full relative flex items-center" style={{ height: `${h}px` }}>
      {/* Origin dot */}
      <div className="shrink-0 z-10">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}55` }} />
      </div>

      {/* Single continuous arrow track — no gap */}
      <div className="flex-1 relative overflow-hidden flex items-center" style={{ height: h }}>
        <div
          className="absolute inset-0 flex items-center"
          style={{
            animation: isReturn ? 'arrow-scroll-left 1.8s linear infinite' : 'arrow-scroll-right 1.8s linear infinite',
          }}
        >
          {Array.from({ length: 60 }).map((_, i) => (
            <span
              key={i}
              className="shrink-0 select-none font-black"
              style={{
                color,
                opacity: 0.2 + (i % 4) * 0.07,
                fontSize: compact ? 11 : 13,
                width: compact ? 7 : 9,
                letterSpacing: -2,
              }}
            >
              {isReturn ? "‹" : "›"}
            </span>
          ))}
        </div>
        {/* Fade edges */}
        <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none" />

        {/* Plane icon — centered overlay on the track */}
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full blur-md" style={{ backgroundColor: `${color}18` }} />
            <svg
              viewBox="0 0 24 24"
              fill={color}
              style={{
                width: planeSize,
                height: planeSize,
                transform: isReturn ? "scaleX(-1) rotate(-90deg)" : "rotate(90deg)",
                filter: `drop-shadow(0 0 5px ${color}66)`,
              }}
            >
              <path d={planePath} />
            </svg>
          </div>
        </div>
      </div>

      {/* Destination dot */}
      <div className="shrink-0 z-10">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}55` }} />
      </div>
    </div>
  );
}
