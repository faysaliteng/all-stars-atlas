interface AnimatedFlightArcProps {
  height?: number;
  direction?: "departure" | "return";
  compact?: boolean;
}

const PLANE_PATH = "M21 8v2l-8 5v5.5c0 .83-.67 1.5-1.5 1.5S10 21.33 10 20.5V15l-8-5V8l8 2.5V5l-2-1.5V2l3.5 1L15 2v1.5L13 5v5.5z";

export default function AnimatedFlightArc({ height = 12, direction = "departure", compact = false }: AnimatedFlightArcProps) {
  const isReturn = direction === "return";
  const h = compact ? 22 : Math.max(28, height + 16);
  const planeSize = compact ? 16 : 20;
  const colorVar = isReturn ? "--flight-return" : "--flight-departure";
  const color = `hsl(var(${colorVar}))`;

  return (
    <div className="w-full relative flex items-center" style={{ height: `${h}px` }}>
      {/* Origin dot */}
      <div className="shrink-0 z-10">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 6px hsl(var(${colorVar}) / 0.45)`,
          }}
        />
      </div>

      {/* Single continuous arrow track — no visual gap */}
      <div className="flex-1 relative overflow-hidden flex items-center" style={{ height: h }}>
        <div
          className="absolute inset-0 flex items-center w-max"
          style={{
            animation: isReturn ? "arrow-scroll-left 1.8s linear infinite" : "arrow-scroll-right 1.8s linear infinite",
          }}
        >
          {[0, 1].map((strip) => (
            <div key={strip} className="shrink-0 flex items-center">
              {Array.from({ length: compact ? 72 : 96 }).map((_, i) => (
                <span
                  key={`${strip}-${i}`}
                  className="shrink-0 select-none font-black leading-none"
                  style={{
                    color,
                    opacity: 0.2 + (i % 4) * 0.07,
                    fontSize: compact ? 11 : 13,
                    width: compact ? 6 : 8,
                    letterSpacing: -1,
                  }}
                >
                  {isReturn ? "‹" : "›"}
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Plane icon — centered overlay on the track */}
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full blur-md" style={{ backgroundColor: `hsl(var(${colorVar}) / 0.16)` }} />
            <svg
              viewBox="0 0 24 24"
              width={planeSize}
              height={planeSize}
              style={{ color, filter: `drop-shadow(0 0 5px hsl(var(${colorVar}) / 0.5))` }}
              aria-hidden="true"
            >
              {isReturn ? (
                <g transform="translate(24 0) scale(-1 1)">
                  <path d={PLANE_PATH} fill="currentColor" />
                </g>
              ) : (
                <path d={PLANE_PATH} fill="currentColor" />
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* Destination dot */}
      <div className="shrink-0 z-10">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 6px hsl(var(${colorVar}) / 0.45)`,
          }}
        />
      </div>
    </div>
  );
}
