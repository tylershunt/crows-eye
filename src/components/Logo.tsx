/** The crow's-eye mark: an almond eye with an iridescent iris and a gold catchlight. */
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} role="img" aria-label="Crow's Eye">
      <defs>
        <linearGradient id="crows-eye-iris" x1="4" y1="6" x2="28" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c4dff" />
          <stop offset="45%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>

      <path
        d="M1.5 16C6.5 7.5 25.5 7.5 30.5 16C25.5 24.5 6.5 24.5 1.5 16Z"
        fill="#0c0c14"
        stroke="url(#crows-eye-iris)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="5.4" fill="url(#crows-eye-iris)" />
      <circle cx="16" cy="16" r="2.9" fill="#0c0c14" />
      <circle cx="14.1" cy="14" r="1.3" fill="#f5c451" />
    </svg>
  );
}
