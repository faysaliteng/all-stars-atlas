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
      <div
        className="relative flex-1 mx-1"
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

        {/* Animated plane — flies left → right using left% animation */}
        <span
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
          {/* Right-facing plane (FA plane-departure style) */}
          <svg
            viewBox="0 0 640 512"
            fill="currentColor"
            style={{ width: planeSize, height: planeSize }}
          >
            <path d="M381 114.9L186.1 41.9c-16.7-6.2-35.2-5.3-51.1 2.7L89.1 67.4C78 73 77.2 88.5 87.6 95.2l85.6 55.2L115 192H43.8c-8.9 0-17.3 4.6-22.1 12.1l-23.4 36.4c-7.8 12.1 .5 28 14.8 29.8l98 12.2 189.7 118.6c5 3.1 10.8 4.8 16.7 4.8h27.3c12.8 0 21.3-13.2 16.1-24.9l-63.2-142.2L440 184.6c16.2-8.5 22.4-28.6 13.9-44.8S397.2 106.3 381 114.9z" />
          </svg>
        </span>
      </div>
    </div>
  );
}
