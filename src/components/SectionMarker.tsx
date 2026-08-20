import type { SectionConfig } from "../../shared/types.js";
import { SNOOZED_SECTION } from "../../shared/snoozed.js";
import { CrowFootIcon } from "./icons.js";

interface SectionMarkerProps {
  config: SectionConfig;
  /** Sized for the surrounding row; the emoji marker reads the text size too. */
  className: string;
  glow?: boolean;
}

/** The badge that stands for a section wherever it is listed. */
export function SectionMarker({ config, className, glow = false }: SectionMarkerProps) {
  if (config.id === SNOOZED_SECTION.id) {
    return (
      <span role="img" aria-label="Snoozed" className={`flex items-center justify-center ${className}`}>
        &#128564;
      </span>
    );
  }

  return (
    <CrowFootIcon
      className={className}
      style={{
        color: config.color,
        ...(glow ? { filter: `drop-shadow(0 0 3px ${config.color}66)` } : {}),
      }}
    />
  );
}
