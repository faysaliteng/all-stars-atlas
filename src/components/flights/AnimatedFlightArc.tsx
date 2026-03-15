interface AnimatedFlightArcProps {
  height?: number;
  direction?: "departure" | "return";
  compact?: boolean;
}

export default function AnimatedFlightArc({ direction = "departure", compact = false }: AnimatedFlightArcProps) {
  const isReturn = direction === "return";
  const h = compact ? 28 : 36;
  const planeSize = compact ? 14 : 16;

  return (
    <div
      className="w-full relative flex items-center"
      style={{ height: `${h}px`, minWidth: compact ? 80 : 120 }}
    >
      <div
        className="flight-path-line relative flex-1 mx-1"
        data-direction={isReturn ? "return" : "departure"}
      >
        <span className="plane-icon" style={{ fontSize: planeSize }}>
          {/* FontAwesome fa-plane (right-facing) */}
          <svg
            viewBox="0 0 576 512"
            fill="currentColor"
            style={{ width: planeSize, height: planeSize, display: "block" }}
          >
            <path d="M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4-7.8 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.2-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z" />
          </svg>
        </span>
      </div>
    </div>
  );
}
