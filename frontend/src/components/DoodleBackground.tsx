/**
 * Page background — soft drifting colour glows over a faint dot grid and
 * paper grain. Fixed behind everything (-z-10), decorative only.
 * (File name kept so App.tsx doesn't change.)
 */
export function DoodleBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* base wash: warm paper fading into a hint of green */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #fbfaf7 0%, #f6f6ef 45%, #eef3ee 100%)',
        }}
      />

      {/* drifting glows */}
      <div className="mb-blob mb-blob-a" />
      <div className="mb-blob mb-blob-b" />
      <div className="mb-blob mb-blob-c" />

      {/* dot grid, fading out toward the bottom */}
      <div className="mb-dots absolute inset-0" />

      {/* paper grain */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.035] mix-blend-multiply">
        <filter id="mb-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#mb-grain)" />
      </svg>
    </div>
  )
}
