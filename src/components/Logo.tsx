/** The crow's-foot mark: a four-toed track, three toes forward and one back, claws out. */
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} role="img" aria-label="Crow's Foot">
      <defs>
        <linearGradient id="crows-foot-sheen" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c4dff" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>

      <g fill="url(#crows-foot-sheen)">
        <path d="M14 18.2Q14.55 13.2 14.78 11.08Q15 8.95 15.7 6.78Q16.4 4.6 16.4 4.6Q16.4 4.6 16.7 6.82Q17 9.05 17.22 11.12Q17.45 13.2 17.73 15.7L18 18.2Z" />
        <path d="M14.98 19.92Q10.85 16.84 9.03 15.42Q7.21 14.01 5.56 12Q3.9 10 3.9 10Q3.9 10 6.14 11.2Q8.39 12.39 10.37 13.38Q12.35 14.36 14.69 15.42L17.02 16.48Z" />
        <path d="M14.98 16.48Q19.65 14.36 21.63 13.38Q23.61 12.39 25.86 11.2Q28.1 10 28.1 10Q28.1 10 26.44 12Q24.79 14.01 22.97 15.42Q21.15 16.84 19.09 18.38L17.02 19.92Z" />
        <path d="M17.85 18.16Q17.4 22.87 16.96 24.56Q16.51 26.26 15.36 27.83Q14.2 29.4 14.2 29.4Q14.2 29.4 14.44 27.57Q14.69 25.74 14.74 24.24Q14.8 22.73 14.48 20.49L14.15 18.24Z" />
        <circle cx="16" cy="18.2" r="2.2" />
      </g>
    </svg>
  );
}
