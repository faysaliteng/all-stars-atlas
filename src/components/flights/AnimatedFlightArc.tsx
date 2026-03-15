interface AnimatedFlightArcProps {
  height?: number;
  direction?: "departure" | "return";
  compact?: boolean;
}

export default function AnimatedFlightArc({ direction = "departure", compact = false }: AnimatedFlightArcProps) {
  const isReturn = direction === "return";
  const h = compact ? 28 : 36;
  const planeSize = compact ? 18 : 22;

  const trackColor = isReturn ? "hsl(var(--secondary))" : "hsl(var(--primary))";

  return (
    <div className="w-full relative flex items-center" style={{ height: `${h}px`, minWidth: compact ? 80 : 120 }}>
      <div className="relative flex-1 mx-1" style={{ height: `${h}px` }}>
        <div className="absolute left-0 right-0 border-b-2 border-dashed" style={{ top: "50%", borderColor: trackColor }} />

        <div
          className="absolute rounded-full z-10"
          style={{
            width: 8,
            height: 8,
            top: "50%",
            left: -4,
            transform: "translateY(-50%)",
            backgroundColor: trackColor,
            boxShadow: "0 0 0 2px hsl(var(--card))",
          }}
        />

        <div
          className="absolute rounded-full z-10"
          style={{
            width: 8,
            height: 8,
            top: "50%",
            right: -4,
            transform: "translateY(-50%)",
            backgroundColor: trackColor,
            boxShadow: "0 0 0 2px hsl(var(--card))",
          }}
        />

        <div
          className="absolute z-20"
          style={{
            width: planeSize,
            height: planeSize,
            top: `calc(50% - ${planeSize / 2}px)`,
            left: 0,
            "--plane-size": `${planeSize}px`,
            animation: "flight-fly 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite",
            willChange: "transform, opacity",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              width: "100%",
              height: "100%",
              color: trackColor,
              filter: "drop-shadow(0px 2px 2px rgba(0,0,0,0.15))",
            }}
          >
            <path
              d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
