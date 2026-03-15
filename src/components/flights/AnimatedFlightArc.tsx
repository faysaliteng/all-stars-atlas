interface AnimatedFlightArcProps {
  height?: number;
  direction?: "departure" | "return";
  compact?: boolean;
}

export default function AnimatedFlightArc({ direction = "departure", compact = false }: AnimatedFlightArcProps) {
  const isReturn = direction === "return";
  const h = compact ? 28 : 36;
  const planeSize = compact ? 14 : 16;

  // Deep blue for departure, deep amber/orange for return
  const trackColor = isReturn ? "hsl(25, 85%, 45%)" : "hsl(220, 70%, 35%)";

  return (
    <div
      className="w-full relative flex items-center"
      style={{ height: `${h}px`, minWidth: compact ? 80 : 120 }}
    >
      {/* The flight path line with dots via pseudo-elements is handled by the wrapper */}
      <div
        className="relative flex-1 mx-1 flight-path-line"
        style={{
          height: "2px",
          borderBottom: `2px dashed ${trackColor}`,
        }}
      >
        {/* Origin dot */}
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: -3,
            transform: "translateY(-50%)",
            width: 6,
            height: 6,
            backgroundColor: trackColor,
            borderRadius: "50%",
          }}
        />
        {/* Destination dot */}
        <span
          style={{
            position: "absolute",
            top: "50%",
            right: -3,
            transform: "translateY(-50%)",
            width: 6,
            height: 6,
            backgroundColor: trackColor,
            borderRadius: "50%",
          }}
        />

        {/* Animated plane — uses left % + translate for smooth L→R flight */}
        <span
          className="flight-plane-icon"
          style={{
            position: "absolute",
            top: "50%",
            fontSize: planeSize,
            color: trackColor,
            background: "hsl(var(--card))",
            padding: "0 3px",
            animation: "flyForward 3.5s ease-in-out infinite",
            zIndex: 10,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Right-facing plane SVG */}
          <svg
            viewBox="0 0 512 512"
            fill="currentColor"
            style={{ width: planeSize, height: planeSize }}
          >
            <path d="M186.62 464H160V337.18L36.63 368.32 24 304.43l123.37-31.14L100.73 48h40.57l103.88 225.29L368.56 48h40.57L362.49 273.29 485.87 304.43l-12.63 63.89-123.37-31.14V464h-26.62L271.62 339.2 238.25 464h-51.63z" transform="rotate(-45, 256, 256)" />
          </svg>
        </span>
      </div>
    </div>
  );
}
