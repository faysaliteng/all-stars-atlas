interface AnimatedFlightArcProps {
  height?: number;
  direction?: "departure" | "return";
  compact?: boolean;
}

export default function AnimatedFlightArc({ direction = "departure", compact = false }: AnimatedFlightArcProps) {
  const isReturn = direction === "return";
  const h = compact ? 28 : 36;
  const planeSize = compact ? 18 : 22;

  // Dark blue for departure, dark orange for return
  const trackColor = isReturn ? "hsl(25, 85%, 45%)" : "hsl(220, 70%, 35%)";

  return (
    <div
      className="w-full relative flex items-center"
      style={{ height: `${h}px`, minWidth: compact ? 80 : 120 }}
    >
      <div className="relative flex-1 mx-1" style={{ height: `${h}px` }}>
        {/* Dashed line */}
        <div
          className="absolute left-0 right-0 border-b-2 border-dashed"
          style={{ top: '50%', borderColor: trackColor }}
        />

        {/* Origin dot */}
        <div
          className="absolute rounded-full z-10"
          style={{
            width: 8,
            height: 8,
            top: '50%',
            left: -4,
            transform: 'translateY(-50%)',
            backgroundColor: trackColor,
            boxShadow: '0 0 0 2px hsl(var(--card))',
          }}
        />

        {/* Destination dot */}
        <div
          className="absolute rounded-full z-10"
          style={{
            width: 8,
            height: 8,
            top: '50%',
            right: -4,
            transform: 'translateY(-50%)',
            backgroundColor: trackColor,
            boxShadow: '0 0 0 2px hsl(var(--card))',
          }}
        />

        {/* Animated plane — right-facing SVG, flies left → right */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute z-20"
          style={{
            width: planeSize,
            height: planeSize,
            top: '50%',
            marginTop: -(planeSize / 2),
            color: trackColor,
            filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.15))',
            animation: `flightMoveRight 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
          }}
        >
          {/* Right-facing airplane — no rotation needed */}
          <path
            d="M22 12l-4-4v3H3v2h15v3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0"
          />
          <path
            d="M16 2v2l5 8-5 8v2l8-5v-2l-8 2.5V14l8 2.5v-2L16 9.5V6.5l8 2.5v-2L16 2z"
            fill="currentColor"
            transform="scale(-1,1) translate(-24,0)"
          />
        </svg>
      </div>
    </div>
  );
}
